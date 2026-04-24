"""
NexLoan Admin Router — KYC Manual Review Queue
Endpoints: /kyc-queue, /kyc/{loan_id}/approve, /kyc/{loan_id}/reject

NOTE: These endpoints have NO authentication guard.
      This is intentional for the prototype. In production,
      add role-based auth (e.g., admin JWT claim) before deploying.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, LoanStatus, KYCDocument, AuditLog, User
from app.utils.database import get_db

logger = logging.getLogger("nexloan.admin")

router = APIRouter()


# ─── Response Models ────────────────────────────────────────────────────────────


class KYCQueueItem(BaseModel):
    loan_id: str
    loan_number: str
    applicant_name: str
    applicant_email: str
    loan_amount: float
    tenure_months: int
    purpose: str | None
    created_at: str

    # KYC details
    pan_doc_url: str | None
    pan_name_extracted: str | None
    pan_legible: bool | None
    aadhaar_doc_url: str | None
    aadhaar_name_extracted: str | None
    aadhaar_legible: bool | None
    aadhaar_photo_present: bool | None

    # AI verdict
    ai_verdict: str | None
    ai_remarks: str | None
    ai_raw_response: dict | None


class AdminActionResponse(BaseModel):
    loan_id: str
    loan_number: str
    new_status: str
    message: str

class AnalyticsResponse(BaseModel):
    total_loans: int
    total_revenue: float
    approval_rate: float
    status_breakdown: dict[str, int]


# ─── Endpoints ──────────────────────────────────────────────────────────────────

from sqlalchemy import func

@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Get admin analytics dashboard data"
)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    # Total loans
    total_loans_result = await db.execute(select(func.count(Loan.id)))
    total_loans = total_loans_result.scalar() or 0

    # Total revenue (sum of interest paid + preclosure charges)
    # For prototype, we'll just sum all paid interest + preclosure charges
    
    # 1. Total paid interest
    from app.models.loan import PaymentStatus, EMISchedule
    total_interest_result = await db.execute(
        select(func.sum(EMISchedule.interest)).where(EMISchedule.status == PaymentStatus.PAID)
    )
    total_interest = total_interest_result.scalar() or 0.0

    # 2. Total preclosure charges
    total_preclosure_result = await db.execute(select(func.sum(Loan.preclosure_charge)))
    total_preclosure = total_preclosure_result.scalar() or 0.0

    total_revenue = float(total_interest) + float(total_preclosure)

    # Status breakdown
    status_counts_result = await db.execute(
        select(Loan.status, func.count(Loan.id)).group_by(Loan.status)
    )
    status_breakdown = {status.value: count for status, count in status_counts_result.all()}

    # Approval rate (Approved + Disbursed + Active + Pre-closed + Closed) / Total processed
    approved_statuses = [
        LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.PRE_CLOSED, LoanStatus.CLOSED
    ]
    rejected_statuses = [LoanStatus.REJECTED]
    
    approved_count = sum(status_breakdown.get(s.value, 0) for s in approved_statuses)
    rejected_count = sum(status_breakdown.get(s.value, 0) for s in rejected_statuses)
    processed_count = approved_count + rejected_count
    
    approval_rate = (approved_count / processed_count) * 100 if processed_count > 0 else 0.0

    return AnalyticsResponse(
        total_loans=total_loans,
        total_revenue=total_revenue,
        approval_rate=round(approval_rate, 2),
        status_breakdown=status_breakdown
    )

@router.get(
    "/kyc-queue",
    response_model=list[KYCQueueItem],
    summary="Get all loans pending KYC manual review",
)
async def get_kyc_queue(db: AsyncSession = Depends(get_db)):
    """
    Returns all loans with KYC_PENDING status along with their
    KYC document details and applicant information.
    No auth guard — prototype only.
    """
    stmt = (
        select(Loan)
        .options(
            selectinload(Loan.kyc_document),
            selectinload(Loan.user),
        )
        .where(Loan.status == LoanStatus.KYC_PENDING)
        .order_by(Loan.created_at.desc())
    )

    result = await db.execute(stmt)
    loans = result.scalars().all()

    queue_items = []
    for loan in loans:
        kyc = loan.kyc_document
        user = loan.user

        queue_items.append(
            KYCQueueItem(
                loan_id=str(loan.id),
                loan_number=loan.loan_number,
                applicant_name=user.full_name if user else "Unknown",
                applicant_email=user.email if user else "Unknown",
                loan_amount=loan.loan_amount or 0,
                tenure_months=loan.tenure_months or 0,
                purpose=loan.purpose,
                created_at=loan.created_at.isoformat() if loan.created_at else "",
                pan_doc_url=kyc.pan_doc_url if kyc else None,
                pan_name_extracted=kyc.pan_name_extracted if kyc else None,
                pan_legible=kyc.pan_legible if kyc else None,
                aadhaar_doc_url=kyc.aadhaar_doc_url if kyc else None,
                aadhaar_name_extracted=kyc.aadhaar_name_extracted if kyc else None,
                aadhaar_legible=kyc.aadhaar_legible if kyc else None,
                aadhaar_photo_present=kyc.aadhaar_photo_present if kyc else None,
                ai_verdict=kyc.ai_verdict if kyc else None,
                ai_remarks=kyc.ai_remarks if kyc else None,
                ai_raw_response=kyc.ai_raw_response if kyc else None,
            )
        )

    logger.info(f"📋 Admin KYC queue: {len(queue_items)} items pending review")
    return queue_items


@router.post(
    "/kyc/{loan_id}/approve",
    response_model=AdminActionResponse,
    summary="Approve KYC for a pending loan",
)
async def approve_kyc(loan_id: str, db: AsyncSession = Depends(get_db)):
    """
    Approves a KYC_PENDING loan → sets status to KYC_VERIFIED.
    Updates the KYC document verdict to PASS.
    Creates an audit log entry with actor 'admin'.
    """
    stmt = (
        select(Loan)
        .options(selectinload(Loan.kyc_document))
        .where(Loan.id == loan_id)
    )
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.KYC_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve KYC for loan in {loan.status.value} status. Must be KYC_PENDING.",
        )

    # Update loan status
    old_status = loan.status
    loan.status = LoanStatus.KYC_VERIFIED

    # Update KYC document verdict
    if loan.kyc_document:
        loan.kyc_document.ai_verdict = "PASS"
        loan.kyc_document.ai_remarks = "Manually approved by admin reviewer."
        loan.kyc_document.verified_at = datetime.utcnow()

    # Audit log
    audit = AuditLog(
        loan_id=loan.id,
        action="ADMIN_KYC_APPROVED",
        from_status=old_status.value,
        to_status=LoanStatus.KYC_VERIFIED.value,
        actor="admin",
        metadata_={"action": "manual_approval"},
    )
    db.add(audit)

    await db.commit()

    logger.info(f"✅ Admin approved KYC for loan {loan.loan_number}")

    return AdminActionResponse(
        loan_id=str(loan.id),
        loan_number=loan.loan_number,
        new_status=LoanStatus.KYC_VERIFIED.value,
        message=f"KYC approved for {loan.loan_number}. Loan is now ready for underwriting.",
    )


@router.post(
    "/kyc/{loan_id}/reject",
    response_model=AdminActionResponse,
    summary="Reject KYC for a pending loan",
)
async def reject_kyc(loan_id: str, db: AsyncSession = Depends(get_db)):
    """
    Rejects a KYC_PENDING loan → sets status to REJECTED.
    Creates an audit log entry with actor 'admin'.
    """
    stmt = select(Loan).where(Loan.id == loan_id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.KYC_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject KYC for loan in {loan.status.value} status. Must be KYC_PENDING.",
        )

    # Update loan status
    old_status = loan.status
    loan.status = LoanStatus.REJECTED
    loan.rejection_reason = "KYC documents rejected by admin after manual review."

    # Audit log
    audit = AuditLog(
        loan_id=loan.id,
        action="ADMIN_KYC_REJECTED",
        from_status=old_status.value,
        to_status=LoanStatus.REJECTED.value,
        actor="admin",
        metadata_={"action": "manual_rejection"},
    )
    db.add(audit)

    await db.commit()

    logger.info(f"❌ Admin rejected KYC for loan {loan.loan_number}")

    return AdminActionResponse(
        loan_id=str(loan.id),
        loan_number=loan.loan_number,
        new_status=LoanStatus.REJECTED.value,
        message=f"KYC rejected for {loan.loan_number}. Loan application has been closed.",
    )


# ─── ADMIN METRICS ────────────────────────────────────────────────────────────


@router.get(
    "/metrics",
    summary="Dashboard metrics — total loans, approval rate, revenue, daily volume",
)
async def get_admin_metrics(
    db: AsyncSession = Depends(get_db),
):
    """
    NOTE: No auth guard for prototype. Add role-based auth before production.
    Returns aggregate metrics for the admin dashboard.
    """
    from sqlalchemy import func, cast, Date
    from datetime import timedelta

    # Total loans
    total_stmt = select(func.count(Loan.id))
    total_result = await db.execute(total_stmt)
    total_loans = total_result.scalar() or 0

    # Approved count
    approved_stmt = select(func.count(Loan.id)).where(
        Loan.status.in_([LoanStatus.APPROVED, LoanStatus.DISBURSED, LoanStatus.ACTIVE, LoanStatus.CLOSED, LoanStatus.PRE_CLOSED])
    )
    approved_result = await db.execute(approved_stmt)
    approved_count = approved_result.scalar() or 0

    approval_rate = round((approved_count / total_loans * 100), 1) if total_loans > 0 else 0

    # Total revenue (sum of total_paid across all loans)
    revenue_stmt = select(func.sum(Loan.total_paid))
    revenue_result = await db.execute(revenue_stmt)
    total_revenue = round(revenue_result.scalar() or 0, 2)

    # Active loans
    active_stmt = select(func.count(Loan.id)).where(Loan.status == LoanStatus.ACTIVE)
    active_result = await db.execute(active_stmt)
    active_loans = active_result.scalar() or 0

    # Status breakdown
    all_loans_stmt = select(Loan.status, func.count(Loan.id)).group_by(Loan.status)
    all_loans_result = await db.execute(all_loans_stmt)
    status_breakdown = {row[0].value: row[1] for row in all_loans_result.all()}

    # Average credit score of approved loans
    avg_score_stmt = select(func.avg(Loan.credit_score)).where(
        Loan.status.in_([LoanStatus.APPROVED, LoanStatus.ACTIVE, LoanStatus.DISBURSED])
    )
    avg_score_result = await db.execute(avg_score_stmt)
    avg_credit_score = round(avg_score_result.scalar() or 0, 0)

    # Daily loan volume (last 7 days)
    daily_volume = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_stmt = select(func.count(Loan.id)).where(
            cast(Loan.created_at, Date) == day
        )
        day_result = await db.execute(day_stmt)
        daily_volume.append({
            "date": day.strftime("%d %b"),
            "count": day_result.scalar() or 0,
        })

    return {
        "total_loans": total_loans,
        "approval_rate": approval_rate,
        "total_revenue": total_revenue,
        "active_loans": active_loans,
        "status_breakdown": status_breakdown,
        "avg_credit_score": avg_credit_score,
        "daily_volume": daily_volume,
    }


# ─── REAPPLY REMINDERS ────────────────────────────────────────────────────────


@router.get(
    "/reapply-reminders",
    summary="Loans due for 90-day reapply reminder",
)
async def get_reapply_reminders(
    db: AsyncSession = Depends(get_db),
):
    """
    NOTE: No auth guard for prototype.
    Returns rejected loans where reapply_reminder_date <= now.
    """
    stmt = select(Loan).options(
        selectinload(Loan.user)
    ).where(
        Loan.status == LoanStatus.REJECTED,
        Loan.reapply_reminder_date != None,
        Loan.reapply_reminder_date <= datetime.utcnow(),
    ).order_by(Loan.reapply_reminder_date.asc())

    result = await db.execute(stmt)
    loans = result.scalars().all()

    reminders = []
    for loan in loans:
        reminders.append({
            "loan_id": str(loan.id),
            "loan_number": loan.loan_number,
            "applicant_name": loan.user.full_name if loan.user else "Unknown",
            "applicant_email": loan.user.email if loan.user else "",
            "rejection_date": loan.updated_at.strftime("%d %b %Y") if loan.updated_at else "",
            "reapply_date": loan.reapply_reminder_date.strftime("%d %b %Y") if loan.reapply_reminder_date else "",
            "improvement_plan": loan.improvement_plan or "",
        })

    return reminders


@router.post(
    "/remind/{loan_id}",
    summary="Manually send reapply reminder email",
)
async def send_reapply_reminder(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    NOTE: No auth guard for prototype.
    Sends the 90-day reminder email to the rejected applicant.
    """
    from app.services.email_service import send_reapply_reminder_email

    stmt = select(Loan).options(selectinload(Loan.user)).where(Loan.id == loan_id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Loan is not in REJECTED status")

    user = loan.user
    if not user:
        raise HTTPException(status_code=400, detail="No user found for this loan")

    await send_reapply_reminder_email(
        to_email=user.email,
        name=user.full_name,
        loan_number=loan.loan_number,
        improvement_plan=loan.improvement_plan or "",
    )

    logger.info(f"📧 Reapply reminder sent for loan {loan.loan_number}")

    return {"message": f"Reapply reminder email sent to {user.email}"}

