"""
NexLoan Offer Engine — Cross-Sell & Upsell Generation
Triggered after EMI payments. Creates contextual offers for borrowers.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, Offer, EMISchedule

logger = logging.getLogger("nexloan.offer_engine")


async def evaluate_and_generate_offers(
    user_id: str,
    loan: Loan,
    db: AsyncSession,
) -> list[dict]:
    """
    Runs after every EMI payment. Checks conditions and creates offers.
    Returns list of generated offer dicts.
    """
    generated = []
    now = datetime.utcnow()

    # Count paid and on-time payments
    paid_emis = [e for e in loan.emi_schedule if e.status.value == "PAID"]
    on_time = [e for e in paid_emis if e.paid_at and e.due_date and e.paid_at <= e.due_date]
    pending_emis = [e for e in loan.emi_schedule if e.status.value == "PENDING"]

    # Rule 1: Top-up offer after 6 on-time payments
    if len(on_time) == 6:
        top_up_amount = (loan.approved_amount or loan.loan_amount or 0) * 0.5
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="TOP_UP",
            title="You're eligible for a Top-Up Loan!",
            description=f"Based on your excellent repayment track record, "
                        f"you're pre-approved for an additional ₹{top_up_amount:,.0f}.",
            offered_amount=top_up_amount,
            offered_rate=max((loan.interest_rate or 12.0) - 0.5, 8.0),
            valid_until=now + timedelta(days=30),
            triggered_by="6_ONTIME_PAYMENTS",
        )
        generated.append(offer)

    # Rule 2: Rate reduction after 12 on-time payments
    if len(on_time) == 12 and (loan.interest_rate or 0) > 12.0:
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="RATE_REDUCTION",
            title="Congratulations! You've earned a rate reduction.",
            description=f"Your interest rate has been reduced from "
                        f"{loan.interest_rate}% to {loan.interest_rate - 1.0}% p.a. "
                        f"Your future EMIs will be recalculated.",
            offered_rate=loan.interest_rate - 1.0,
            valid_until=now + timedelta(days=15),
            triggered_by="12_ONTIME_PAYMENTS",
        )
        generated.append(offer)

    # Rule 3: Renewal offer when 3 EMIs remain
    if len(pending_emis) == 3:
        renewal_amount = (loan.approved_amount or loan.loan_amount or 0) * 1.25
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="LOAN_RENEWAL",
            title="Your loan is almost complete. Ready for more?",
            description=f"You're pre-approved for ₹{renewal_amount:,.0f} at "
                        f"{max((loan.interest_rate or 12.0) - 0.5, 10.5)}% p.a. — "
                        f"your loyalty rate.",
            offered_amount=renewal_amount,
            offered_rate=max((loan.interest_rate or 12.0) - 0.5, 10.5),
            valid_until=now + timedelta(days=45),
            triggered_by="3_EMIS_REMAINING",
        )
        generated.append(offer)

    # Save all generated offers to DB (avoid duplicates)
    for offer in generated:
        existing = await db.execute(
            select(Offer).where(
                Offer.loan_id == loan.id,
                Offer.offer_type == offer.offer_type,
                Offer.status == "PENDING",
            )
        )
        if not existing.scalar_one_or_none():
            db.add(offer)
            logger.info(f"🎁 Created {offer.offer_type} offer for loan {loan.loan_number}")

    return [
        {
            "offer_type": o.offer_type,
            "title": o.title,
            "offered_amount": o.offered_amount,
            "offered_rate": o.offered_rate,
        }
        for o in generated
    ]


async def expire_old_offers(db: AsyncSession):
    """Daily job: expire offers past valid_until."""
    now = datetime.utcnow()
    result = await db.execute(
        select(Offer).where(
            Offer.status == "PENDING",
            Offer.valid_until != None,
            Offer.valid_until < now,
        )
    )
    expired = result.scalars().all()
    for offer in expired:
        offer.status = "EXPIRED"
    if expired:
        await db.commit()
        logger.info(f"⏰ Expired {len(expired)} offers")
