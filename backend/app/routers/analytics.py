"""
NexLoan Analytics Router — Cohort Analytics, Trends, and Performers
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    User, Loan, LoanStatus, EMISchedule, PaymentStatus, CollectionsCase,
)
from app.utils.database import get_db
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.analytics")
router = APIRouter()


@router.get("/cohorts", summary="Cohort analytics grouped by various dimensions")
async def get_cohorts(
    group_by: str = "acquisition_month",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    result = await db.execute(select(Loan).where(Loan.disbursed_at != None))
    loans = result.scalars().all()

    cohorts = {}
    for loan in loans:
        if group_by == "acquisition_month":
            key = loan.disbursed_at.strftime("%b %Y") if loan.disbursed_at else "Unknown"
        elif group_by == "score_band":
            score = loan.credit_score or 0
            if score >= 750: key = "750+"
            elif score >= 650: key = "650-749"
            elif score >= 550: key = "550-649"
            elif score >= 450: key = "450-549"
            else: key = "<450"
        elif group_by == "purpose":
            key = loan.purpose or "Other"
        else:
            key = loan.disbursed_at.strftime("%b %Y") if loan.disbursed_at else "Unknown"

        if key not in cohorts:
            cohorts[key] = {
                "cohort_label": key,
                "total_loans": 0,
                "total_disbursed": 0,
                "avg_credit_score": [],
                "on_time_count": 0,
                "total_emis": 0,
                "npa_count": 0,
                "closed_count": 0,
                "active_count": 0,
            }

        c = cohorts[key]
        c["total_loans"] += 1
        c["total_disbursed"] += loan.disbursed_amount or loan.approved_amount or 0
        if loan.credit_score:
            c["avg_credit_score"].append(loan.credit_score)

        if loan.status in [LoanStatus.ACTIVE, LoanStatus.DISBURSED]:
            c["active_count"] += 1
        elif loan.status in [LoanStatus.CLOSED, LoanStatus.PRE_CLOSED]:
            c["closed_count"] += 1

        for emi in loan.emi_schedule:
            if emi.status == PaymentStatus.PAID:
                c["total_emis"] += 1
                if emi.paid_at and emi.due_date and emi.paid_at <= emi.due_date:
                    c["on_time_count"] += 1

    # Calculate averages and rates
    result_list = []
    for key, c in cohorts.items():
        avg_score = sum(c["avg_credit_score"]) / len(c["avg_credit_score"]) if c["avg_credit_score"] else 0
        on_time_rate = c["on_time_count"] / c["total_emis"] if c["total_emis"] > 0 else 0
        npa_rate = c["npa_count"] / c["total_loans"] if c["total_loans"] > 0 else 0

        result_list.append({
            "cohort_label": key,
            "total_loans": c["total_loans"],
            "total_disbursed": c["total_disbursed"],
            "avg_credit_score": round(avg_score),
            "on_time_rate": round(on_time_rate, 3),
            "npa_count": c["npa_count"],
            "npa_rate": round(npa_rate, 4),
            "closed_count": c["closed_count"],
            "active_count": c["active_count"],
        })

    return result_list


@router.get("/trends", summary="Monthly trends — disbursements, collections, NPA")
async def get_trends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    from datetime import timedelta

    months = []
    now = datetime.utcnow()

    for i in range(5, -1, -1):
        date = (now.replace(day=1) - timedelta(days=30 * i))
        month_start = date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if date.month == 12:
            month_end = datetime(date.year + 1, 1, 1)
        else:
            month_end = datetime(date.year, date.month + 1, 1)

        # New loans disbursed
        disbursed = await db.scalar(
            select(func.count(Loan.id)).where(
                Loan.disbursed_at >= month_start,
                Loan.disbursed_at < month_end,
            )
        ) or 0

        # EMIs collected
        collected = await db.scalar(
            select(func.count(EMISchedule.id)).where(
                EMISchedule.paid_at >= month_start,
                EMISchedule.paid_at < month_end,
                EMISchedule.status == PaymentStatus.PAID,
            )
        ) or 0

        # New collections cases
        new_cases = await db.scalar(
            select(func.count(CollectionsCase.id)).where(
                CollectionsCase.opened_at >= month_start,
                CollectionsCase.opened_at < month_end,
            )
        ) or 0

        months.append({
            "month": month_start.strftime("%b %Y"),
            "disbursed": disbursed,
            "emis_collected": collected,
            "new_npa_cases": new_cases,
        })

    return months


@router.get("/performers", summary="Top and bottom performers")
async def get_performers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    # Top purposes by repayment
    purpose_result = await db.execute(
        select(Loan.purpose, func.count(Loan.id))
        .where(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.CLOSED]))
        .group_by(Loan.purpose)
        .order_by(func.count(Loan.id).desc())
        .limit(5)
    )
    top_purposes = [
        {"purpose": row[0] or "Other", "count": row[1]}
        for row in purpose_result.all()
    ]

    return {
        "top_purposes": top_purposes,
    }
