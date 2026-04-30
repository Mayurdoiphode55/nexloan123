"""
NexLoan Dashboard API — Phase 2
Provides aggregated dashboard data: pending tasks, KPIs, pipeline, repayment health.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_, case
from datetime import datetime, timedelta

from app.utils.auth import get_current_user
from app.utils.database import AsyncSessionLocal
from app.models.loan import (
    Loan, LoanStatus, User, KYCDocument, SupportTicket,
    CallbackRequest, EMISchedule, PaymentStatus, PreClosureRequest,
)
from app.utils.permissions import require_permission, Permission

router = APIRouter()


@router.get("/pending-tasks")
async def get_pending_tasks(current_user=Depends(require_permission(Permission.VIEW_DASHBOARD_OPS))):
    """Get all pending tasks for officer/admin dashboard."""
    async with AsyncSessionLocal() as db:
        tasks = []

        # 1. KYC documents awaiting review
        kyc_result = await db.execute(
            select(Loan, User).join(User, Loan.user_id == User.id).where(
                Loan.status == LoanStatus.KYC_PENDING
            ).order_by(Loan.created_at.desc()).limit(10)
        )
        for loan, user in kyc_result.all():
            tasks.append({
                "type": "KYC_REVIEW",
                "icon": "document",
                "label": "KYC Review Pending",
                "customer_name": user.full_name,
                "loan_id": str(loan.id),
                "loan_number": loan.loan_number,
                "time_elapsed": _time_ago(loan.created_at),
                "cta": "Review",
                "cta_url": f"/officer?loan={loan.id}",
            })

        # 2. Callback requests awaiting response
        cb_result = await db.execute(
            select(CallbackRequest, User).join(User, CallbackRequest.user_id == User.id).where(
                CallbackRequest.status == "pending"
            ).order_by(CallbackRequest.created_at.desc()).limit(10)
        )
        for cb, user in cb_result.all():
            tasks.append({
                "type": "CALLBACK",
                "icon": "phone",
                "label": "Callback Request",
                "customer_name": user.full_name,
                "loan_id": str(cb.loan_id) if cb.loan_id else None,
                "time_elapsed": _time_ago(cb.created_at),
                "cta": "Call",
                "cta_url": f"/admin?tab=callbacks",
            })

        # 3. Support tickets assigned and unresolved
        ticket_result = await db.execute(
            select(SupportTicket, User).join(User, SupportTicket.user_id == User.id).where(
                SupportTicket.status.in_(["OPEN", "IN_PROGRESS"])
            ).order_by(SupportTicket.created_at.desc()).limit(10)
        )
        for ticket, user in ticket_result.all():
            tasks.append({
                "type": "SUPPORT_TICKET",
                "icon": "ticket",
                "label": f"Ticket: {ticket.subject[:40]}",
                "customer_name": user.full_name,
                "time_elapsed": _time_ago(ticket.created_at),
                "cta": "Respond",
                "cta_url": f"/admin?tab=support",
            })

        # 4. Loans stuck at UNDERWRITING for > 48 hours
        cutoff_48h = datetime.utcnow() - timedelta(hours=48)
        stuck_result = await db.execute(
            select(Loan, User).join(User, Loan.user_id == User.id).where(
                Loan.status == LoanStatus.UNDERWRITING,
                Loan.updated_at < cutoff_48h,
            ).order_by(Loan.updated_at.asc()).limit(10)
        )
        for loan, user in stuck_result.all():
            tasks.append({
                "type": "STUCK_UNDERWRITING",
                "icon": "alert",
                "label": "Underwriting > 48h",
                "customer_name": user.full_name,
                "loan_id": str(loan.id),
                "loan_number": loan.loan_number,
                "time_elapsed": _time_ago(loan.updated_at),
                "cta": "Review",
                "cta_url": f"/officer?loan={loan.id}",
            })

        # 5. Pre-closure requests pending approval
        try:
            pc_result = await db.execute(
                select(PreClosureRequest, User).join(User, PreClosureRequest.user_id == User.id).where(
                    PreClosureRequest.status == "PENDING"
                ).order_by(PreClosureRequest.created_at.desc()).limit(10)
            )
            for pc, user in pc_result.all():
                tasks.append({
                    "type": "PRECLOSURE",
                    "icon": "closure",
                    "label": "Pre-closure Request",
                    "customer_name": user.full_name,
                    "loan_id": str(pc.loan_id),
                    "time_elapsed": _time_ago(pc.created_at),
                    "cta": "View Loan",
                    "cta_url": f"/officer?loan={pc.loan_id}",
                })
        except Exception:
            pass

        return tasks


@router.get("/kpis")
async def get_kpis(current_user=Depends(require_permission(Permission.VIEW_DASHBOARD_OPS))):
    """Get key performance indicators for the admin/officer dashboard."""
    async with AsyncSessionLocal() as db:
        # Active loans count
        active_count = (await db.execute(
            select(func.count(Loan.id)).where(Loan.status == LoanStatus.ACTIVE)
        )).scalar() or 0

        # Total disbursed amount
        total_disbursed = (await db.execute(
            select(func.coalesce(func.sum(Loan.disbursed_amount), 0)).where(
                Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.CLOSED, LoanStatus.PRE_CLOSED])
            )
        )).scalar() or 0

        # Total loans
        total_loans = (await db.execute(
            select(func.count(Loan.id))
        )).scalar() or 0

        # NPA rate — loans with overdue EMIs / active loans
        overdue_loan_ids = (await db.execute(
            select(func.count(func.distinct(EMISchedule.loan_id))).where(
                EMISchedule.status == PaymentStatus.OVERDUE
            )
        )).scalar() or 0
        npa_rate = round((overdue_loan_ids / max(active_count, 1)) * 100, 1)

        # Pending KYC count
        pending_kyc = (await db.execute(
            select(func.count(Loan.id)).where(Loan.status == LoanStatus.KYC_PENDING)
        )).scalar() or 0

        # Pending callbacks
        pending_callbacks = (await db.execute(
            select(func.count(CallbackRequest.id)).where(CallbackRequest.status == "pending")
        )).scalar() or 0

        return {
            "active_loans": active_count,
            "total_disbursed": total_disbursed,
            "total_loans": total_loans,
            "npa_rate": npa_rate,
            "pending_kyc": pending_kyc,
            "pending_callbacks": pending_callbacks,
        }


@router.get("/pipeline")
async def get_pipeline(current_user=Depends(require_permission(Permission.VIEW_DASHBOARD_OPS))):
    """Loan origination pipeline — funnel count per stage."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                Loan.status,
                func.count(Loan.id).label("count"),
            ).group_by(Loan.status)
        )
        breakdown = {row.status.value if hasattr(row.status, 'value') else str(row.status): row.count for row in result.all()}

        # Order them in the pipeline stages
        pipeline_order = [
            "INQUIRY", "APPLICATION", "KYC_PENDING", "KYC_VERIFIED",
            "UNDERWRITING", "APPROVED", "COUNTER_OFFERED", "REJECTED",
            "DISBURSED", "ACTIVE", "PRE_CLOSED", "CLOSED"
        ]
        stages = [
            {"stage": stage, "count": breakdown.get(stage, 0)}
            for stage in pipeline_order
        ]

        return {"stages": stages}


@router.get("/repayment-health")
async def get_repayment_health(current_user=Depends(require_permission(Permission.VIEW_DASHBOARD_OPS))):
    """EMI status breakdown for current month — on-time vs overdue."""
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if now.month == 12:
            month_end = now.replace(year=now.year + 1, month=1, day=1)
        else:
            month_end = now.replace(month=now.month + 1, day=1)

        result = await db.execute(
            select(
                EMISchedule.status,
                func.count(EMISchedule.id).label("count"),
            ).where(
                EMISchedule.due_date >= month_start,
                EMISchedule.due_date < month_end,
            ).group_by(EMISchedule.status)
        )
        breakdown = {str(row.status.value) if hasattr(row.status, 'value') else str(row.status): row.count for row in result.all()}

        return {
            "month": now.strftime("%B %Y"),
            "paid": breakdown.get("PAID", 0),
            "pending": breakdown.get("PENDING", 0),
            "overdue": breakdown.get("OVERDUE", 0),
            "paused": breakdown.get("PAUSED", 0),
            "total": sum(breakdown.values()),
        }


def _time_ago(dt: datetime) -> str:
    """Human-readable time ago string."""
    if not dt:
        return "Unknown"
    diff = datetime.utcnow() - dt
    if diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    hours = diff.seconds // 3600
    if hours > 0:
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    minutes = diff.seconds // 60
    return f"{max(minutes, 1)} minute{'s' if minutes > 1 else ''} ago"
