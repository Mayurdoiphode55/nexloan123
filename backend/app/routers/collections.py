"""
NexLoan Collections Router — Collections Officer Dashboard API
Cases, assignments, settlements, notes, legal notices, stats.
"""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, Loan, CollectionsCase, CollectionsActivity, LoanStatus,
)
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.collections")
router = APIRouter()


class SettlementRequest(BaseModel):
    discount_pct: float = 10.0
    valid_days: int = 15


class NoteRequest(BaseModel):
    note: str


class ResolveRequest(BaseModel):
    resolution_note: str = ""


@router.get("/cases", summary="List all collections cases")
async def list_cases(
    dpd_bucket: str = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    query = select(CollectionsCase).order_by(CollectionsCase.days_past_due.desc())
    if dpd_bucket:
        query = query.where(CollectionsCase.dpd_bucket == dpd_bucket)
    if status:
        query = query.where(CollectionsCase.status == status)

    result = await db.execute(query)
    cases = result.scalars().all()

    items = []
    for c in cases:
        # Get loan and user info
        loan_result = await db.execute(
            select(Loan).options(selectinload(Loan.user)).where(Loan.id == c.loan_id)
        )
        loan = loan_result.scalar_one_or_none()

        items.append({
            "id": str(c.id),
            "loan_id": str(c.loan_id),
            "loan_number": loan.loan_number if loan else "",
            "borrower_name": loan.user.full_name if loan and loan.user else "",
            "borrower_email": loan.user.email if loan and loan.user else "",
            "days_past_due": c.days_past_due,
            "overdue_amount": c.overdue_amount,
            "overdue_installments": c.overdue_installments,
            "dpd_bucket": c.dpd_bucket,
            "status": c.status,
            "assigned_officer_id": str(c.assigned_officer_id) if c.assigned_officer_id else None,
            "settlement_offered": c.settlement_offered,
            "settlement_amount": c.settlement_amount,
            "legal_notice_sent": c.legal_notice_sent,
            "opened_at": c.opened_at.isoformat() if c.opened_at else None,
        })
    return items


@router.get("/cases/{case_id}", summary="Case detail with activity log")
async def get_case_detail(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(
        select(CollectionsCase).where(CollectionsCase.id == case_id)
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Get loan info
    loan_result = await db.execute(
        select(Loan).options(selectinload(Loan.user)).where(Loan.id == case.loan_id)
    )
    loan = loan_result.scalar_one_or_none()

    # Get activity log
    activities_result = await db.execute(
        select(CollectionsActivity)
        .where(CollectionsActivity.case_id == case.id)
        .order_by(CollectionsActivity.created_at.desc())
    )
    activities = activities_result.scalars().all()

    return {
        "id": str(case.id),
        "loan_id": str(case.loan_id),
        "loan_number": loan.loan_number if loan else "",
        "borrower_name": loan.user.full_name if loan and loan.user else "",
        "borrower_email": loan.user.email if loan and loan.user else "",
        "loan_amount": loan.approved_amount or loan.loan_amount if loan else 0,
        "days_past_due": case.days_past_due,
        "overdue_amount": case.overdue_amount,
        "overdue_installments": case.overdue_installments,
        "dpd_bucket": case.dpd_bucket,
        "status": case.status,
        "settlement_offered": case.settlement_offered,
        "settlement_amount": case.settlement_amount,
        "settlement_discount_pct": case.settlement_discount_pct,
        "settlement_valid_until": case.settlement_valid_until.isoformat() if case.settlement_valid_until else None,
        "legal_notice_sent": case.legal_notice_sent,
        "legal_notice_date": case.legal_notice_date.isoformat() if case.legal_notice_date else None,
        "notes": case.notes,
        "opened_at": case.opened_at.isoformat() if case.opened_at else None,
        "last_contact_at": case.last_contact_at.isoformat() if case.last_contact_at else None,
        "activities": [
            {
                "id": str(a.id),
                "activity_type": a.activity_type,
                "description": a.description,
                "performed_by": a.performed_by,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities
        ],
    }


@router.put("/cases/{case_id}/assign", summary="Assign to collections officer")
async def assign_case(
    case_id: str,
    officer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(CollectionsCase).where(CollectionsCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.assigned_officer_id = officer_id
    case.status = "IN_PROGRESS"

    activity = CollectionsActivity(
        case_id=case.id,
        activity_type="OFFICER_ASSIGNED",
        description=f"Case assigned to officer",
        performed_by=str(current_user.id),
    )
    db.add(activity)
    await db.commit()

    return {"message": "Case assigned successfully"}


@router.post("/cases/{case_id}/settlement", summary="Create settlement offer")
async def create_settlement(
    case_id: str,
    body: SettlementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(CollectionsCase).where(CollectionsCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    settlement_amount = case.overdue_amount * (1 - body.discount_pct / 100)
    case.settlement_offered = True
    case.settlement_amount = settlement_amount
    case.settlement_discount_pct = body.discount_pct
    case.settlement_valid_until = datetime.utcnow() + timedelta(days=body.valid_days)
    case.status = "SETTLEMENT_OFFERED"

    activity = CollectionsActivity(
        case_id=case.id,
        activity_type="SETTLEMENT_OFFERED",
        description=f"Settlement: ₹{settlement_amount:,.0f} ({body.discount_pct}% discount, valid {body.valid_days} days)",
        performed_by=str(current_user.id),
    )
    db.add(activity)
    await db.commit()

    return {"message": "Settlement offer created", "settlement_amount": settlement_amount}


@router.post("/cases/{case_id}/note", summary="Add note to case")
async def add_note(
    case_id: str,
    body: NoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(CollectionsCase).where(CollectionsCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    activity = CollectionsActivity(
        case_id=case.id,
        activity_type="NOTE_ADDED",
        description=body.note,
        performed_by=str(current_user.id),
    )
    db.add(activity)
    case.last_contact_at = datetime.utcnow()
    await db.commit()

    return {"message": "Note added"}


@router.post("/cases/{case_id}/resolve", summary="Resolve collections case")
async def resolve_case(
    case_id: str,
    body: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(CollectionsCase).where(CollectionsCase.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.status = "RESOLVED"
    case.resolved_at = datetime.utcnow()
    case.notes = body.resolution_note

    activity = CollectionsActivity(
        case_id=case.id,
        activity_type="CASE_RESOLVED",
        description=f"Case resolved: {body.resolution_note}",
        performed_by=str(current_user.id),
    )
    db.add(activity)
    await db.commit()

    return {"message": "Case resolved"}


@router.get("/stats", summary="Collections statistics")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Total overdue
    total_overdue = await db.scalar(
        select(func.sum(CollectionsCase.overdue_amount)).where(
            CollectionsCase.status != "RESOLVED"
        )
    ) or 0

    # By DPD bucket
    bucket_results = await db.execute(
        select(
            CollectionsCase.dpd_bucket,
            func.count(CollectionsCase.id),
            func.sum(CollectionsCase.overdue_amount),
        )
        .where(CollectionsCase.status != "RESOLVED")
        .group_by(CollectionsCase.dpd_bucket)
    )
    buckets = [
        {"bucket": row[0], "count": row[1], "amount": row[2] or 0}
        for row in bucket_results.all()
    ]

    # Resolution stats
    resolved = await db.scalar(
        select(func.count(CollectionsCase.id)).where(CollectionsCase.status == "RESOLVED")
    ) or 0
    total_cases = await db.scalar(select(func.count(CollectionsCase.id))) or 0
    recovery_rate = resolved / total_cases if total_cases > 0 else 0

    return {
        "total_overdue": total_overdue,
        "dpd_buckets": buckets,
        "total_cases": total_cases,
        "resolved_cases": resolved,
        "recovery_rate": round(recovery_rate, 4),
    }
