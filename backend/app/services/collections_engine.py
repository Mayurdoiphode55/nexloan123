"""
NexLoan Collections Engine — Overdue Loan Management
Daily APScheduler job that identifies overdue loans and triggers collections workflow.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import (
    Loan, LoanStatus, EMISchedule, PaymentStatus, User,
    CollectionsCase, CollectionsActivity,
)
from app.utils.database import AsyncSessionLocal

logger = logging.getLogger("nexloan.collections")


def get_dpd_bucket(days: int) -> str:
    """Get DPD bucket label from days past due."""
    if days <= 0:
        return "CURRENT"
    if days <= 30:
        return "1-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


async def run_collections_engine():
    """
    Daily job (6 AM): identifies overdue loans and triggers collections workflow.
    """
    logger.info("🔄 Running collections engine...")

    async with AsyncSessionLocal() as db:
        try:
            today = datetime.utcnow().date()

            # Get all active/disbursed loans
            result = await db.execute(
                select(Loan)
                .where(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED]))
            )
            active_loans = result.scalars().all()

            cases_created = 0
            cases_updated = 0

            for loan in active_loans:
                # Find overdue EMIs
                overdue = [
                    e for e in loan.emi_schedule
                    if e.status == PaymentStatus.PENDING and e.due_date and e.due_date.date() < today
                ]
                if not overdue:
                    continue

                days_past_due = (today - overdue[0].due_date.date()).days
                overdue_amount = sum(e.emi_amount for e in overdue)
                dpd_bucket = get_dpd_bucket(days_past_due)

                # Check if case already exists
                case_result = await db.execute(
                    select(CollectionsCase).where(CollectionsCase.loan_id == loan.id)
                )
                case = case_result.scalar_one_or_none()

                if not case:
                    case = CollectionsCase(
                        loan_id=loan.id,
                        user_id=loan.user_id,
                        days_past_due=days_past_due,
                        overdue_amount=overdue_amount,
                        overdue_installments=len(overdue),
                        dpd_bucket=dpd_bucket,
                    )
                    db.add(case)
                    await db.flush()

                    # Log activity
                    activity = CollectionsActivity(
                        case_id=case.id,
                        activity_type="CASE_OPENED",
                        description=f"Collections case opened. {len(overdue)} EMIs overdue, "
                                    f"₹{overdue_amount:,.0f} outstanding, {days_past_due} DPD.",
                        performed_by="system",
                    )
                    db.add(activity)
                    cases_created += 1
                else:
                    # Update existing case
                    case.days_past_due = days_past_due
                    case.overdue_amount = overdue_amount
                    case.overdue_installments = len(overdue)
                    case.dpd_bucket = dpd_bucket
                    cases_updated += 1

                # Trigger escalation actions based on DPD
                await trigger_collections_action(case, days_past_due, loan, db)

            await db.commit()
            logger.info(f"✅ Collections engine: {cases_created} new cases, {cases_updated} updated")

        except Exception as e:
            logger.error(f"❌ Collections engine error: {e}")
            await db.rollback()


async def trigger_collections_action(
    case: CollectionsCase,
    days_past_due: int,
    loan: Loan,
    db: AsyncSession,
):
    """Trigger appropriate collections action based on DPD."""
    if days_past_due == 1:
        await log_activity(case, "EMAIL_SENT", "Day 1 soft reminder sent", db)

    elif days_past_due == 3:
        await log_activity(case, "EMAIL_SENT", "Day 3 urgent reminder sent", db)

    elif days_past_due == 7:
        if not case.assigned_officer_id:
            case.status = "IN_PROGRESS"
            await log_activity(case, "STATUS_CHANGED", "Case escalated — awaiting officer assignment", db)

    elif days_past_due == 15:
        if not case.settlement_offered:
            outstanding = case.overdue_amount
            settlement_amount = outstanding * 0.90
            case.settlement_offered = True
            case.settlement_amount = settlement_amount
            case.settlement_discount_pct = 10.0
            case.settlement_valid_until = datetime.utcnow() + timedelta(days=15)
            case.status = "SETTLEMENT_OFFERED"
            await log_activity(
                case, "SETTLEMENT_OFFERED",
                f"Settlement offer: ₹{settlement_amount:,.0f} (10% discount)",
                db,
            )

    elif days_past_due == 30:
        if not case.legal_notice_sent:
            case.legal_notice_sent = True
            case.legal_notice_date = datetime.utcnow()
            case.status = "LEGAL_NOTICE_SENT"
            await log_activity(case, "LEGAL_NOTICE", "Legal notice flagged — 30 DPD threshold", db)


async def log_activity(
    case: CollectionsCase,
    activity_type: str,
    description: str,
    db: AsyncSession,
    performed_by: str = "system",
):
    """Log an activity entry for a collections case."""
    activity = CollectionsActivity(
        case_id=case.id,
        activity_type=activity_type,
        description=description,
        performed_by=performed_by,
    )
    db.add(activity)
