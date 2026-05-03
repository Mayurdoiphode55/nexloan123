"""
NexLoan Portfolio Router — Portfolio Risk Dashboard API
Summary, DPD distribution, vintage analysis, geographic, product mix, recovery.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, Loan, LoanStatus, EMISchedule, PaymentStatus, CollectionsCase,
)
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.portfolio")
router = APIRouter()


@router.get("/summary", summary="Portfolio risk summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Total AUM (sum of outstanding across active loans)
    active_loans = await db.execute(
        select(Loan).where(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED]))
    )
    loans = active_loans.scalars().all()
    total_aum = sum(
        (e.outstanding_balance or 0)
        for loan in loans
        for e in loan.emi_schedule
        if e.status == PaymentStatus.PENDING
    ) if loans else 0

    active_count = len(loans)

    # NPA (90+ DPD)
    npa_result = await db.execute(
        select(func.count(CollectionsCase.id), func.sum(CollectionsCase.overdue_amount))
        .where(CollectionsCase.dpd_bucket == "90+")
    )
    npa_row = npa_result.first()
    npa_count = npa_row[0] or 0
    npa_amount = npa_row[1] or 0
    npa_rate = npa_count / active_count if active_count > 0 else 0

    # Avg credit score
    avg_score = await db.scalar(
        select(func.avg(Loan.credit_score)).where(
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED])
        )
    ) or 0

    # Collection efficiency (EMIs paid on time this month)
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total_due = await db.scalar(
        select(func.count(EMISchedule.id)).where(
            EMISchedule.due_date >= month_start,
            EMISchedule.due_date <= now,
        )
    ) or 0
    paid_due = await db.scalar(
        select(func.count(EMISchedule.id)).where(
            EMISchedule.due_date >= month_start,
            EMISchedule.due_date <= now,
            EMISchedule.status == PaymentStatus.PAID,
        )
    ) or 0
    collection_efficiency = paid_due / total_due if total_due > 0 else 0

    # PAR (Portfolio at Risk — 30+ DPD)
    par_result = await db.scalar(
        select(func.count(CollectionsCase.id)).where(
            CollectionsCase.days_past_due >= 30,
            CollectionsCase.status != "RESOLVED",
        )
    ) or 0
    par_rate = par_result / active_count if active_count > 0 else 0

    return {
        "total_aum": round(total_aum, 2),
        "active_loans": active_count,
        "npa_amount": npa_amount,
        "npa_rate": round(npa_rate, 4),
        "npa_count": npa_count,
        "avg_credit_score": round(avg_score),
        "collection_efficiency": round(collection_efficiency, 4),
        "portfolio_at_risk": round(par_rate, 4),
    }


@router.get("/dpd-distribution", summary="DPD bucket distribution")
async def dpd_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Current (no overdue)
    active_count = await db.scalar(
        select(func.count(Loan.id)).where(
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED])
        )
    ) or 0

    bucket_result = await db.execute(
        select(
            CollectionsCase.dpd_bucket,
            func.count(CollectionsCase.id),
            func.sum(CollectionsCase.overdue_amount),
        )
        .where(CollectionsCase.status != "RESOLVED")
        .group_by(CollectionsCase.dpd_bucket)
    )
    buckets = {row[0]: {"count": row[1], "amount": row[2] or 0} for row in bucket_result.all()}

    overdue_count = sum(b["count"] for b in buckets.values())
    current_count = max(0, active_count - overdue_count)

    return {
        "current": {"count": current_count, "label": "Current"},
        "1-30": buckets.get("1-30", {"count": 0, "amount": 0}),
        "31-60": buckets.get("31-60", {"count": 0, "amount": 0}),
        "61-90": buckets.get("61-90", {"count": 0, "amount": 0}),
        "90+": buckets.get("90+", {"count": 0, "amount": 0}),
        "total_active": active_count,
    }


@router.get("/vintage-analysis", summary="Vintage analysis by disbursement month")
async def vintage_analysis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Get loans grouped by disbursement month
    result = await db.execute(
        select(Loan).where(
            Loan.disbursed_at != None,
        ).order_by(Loan.disbursed_at)
    )
    loans = result.scalars().all()

    cohorts = {}
    for loan in loans:
        month_key = loan.disbursed_at.strftime("%Y-%m")
        if month_key not in cohorts:
            cohorts[month_key] = {
                "month": month_key,
                "disbursed_count": 0,
                "disbursed_amount": 0,
                "still_active": 0,
                "closed": 0,
                "npa_count": 0,
            }
        cohorts[month_key]["disbursed_count"] += 1
        cohorts[month_key]["disbursed_amount"] += loan.disbursed_amount or loan.approved_amount or 0

        if loan.status in [LoanStatus.ACTIVE, LoanStatus.DISBURSED]:
            cohorts[month_key]["still_active"] += 1
        elif loan.status in [LoanStatus.CLOSED, LoanStatus.PRE_CLOSED]:
            cohorts[month_key]["closed"] += 1

    # Add NPA counts from collections
    for month_key, data in cohorts.items():
        if data["disbursed_count"] > 0:
            data["npa_rate"] = round(data["npa_count"] / data["disbursed_count"], 4)
        else:
            data["npa_rate"] = 0

    return list(cohorts.values())


@router.get("/product-mix", summary="Breakdown by loan purpose and amount band")
async def product_mix(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # By purpose
    purpose_result = await db.execute(
        select(
            Loan.purpose,
            func.count(Loan.id),
            func.sum(Loan.approved_amount),
        )
        .where(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.CLOSED]))
        .group_by(Loan.purpose)
    )
    by_purpose = [
        {"purpose": row[0] or "Other", "count": row[1], "amount": row[2] or 0}
        for row in purpose_result.all()
    ]

    # By amount band
    all_loans = await db.execute(
        select(Loan.approved_amount).where(
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.CLOSED]),
            Loan.approved_amount != None,
        )
    )
    amounts = [row[0] for row in all_loans.all()]

    bands = {"< 1L": 0, "1-3L": 0, "3-5L": 0, "5-10L": 0, "10L+": 0}
    for amt in amounts:
        if amt < 100000:
            bands["< 1L"] += 1
        elif amt < 300000:
            bands["1-3L"] += 1
        elif amt < 500000:
            bands["3-5L"] += 1
        elif amt < 1000000:
            bands["5-10L"] += 1
        else:
            bands["10L+"] += 1

    return {"by_purpose": by_purpose, "by_amount_band": bands}
