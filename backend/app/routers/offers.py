"""
NexLoan Offers Router — Cross-Sell & Upsell Endpoints
GET /my-offers, POST /{id}/accept, POST /{id}/decline
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, Loan, Offer, EMISchedule
from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.services.emi_engine import calculate_emi

logger = logging.getLogger("nexloan.offers")
router = APIRouter()


@router.get("/my-offers", summary="Get all pending offers for the current user")
async def get_my_offers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Offer).where(
            Offer.user_id == current_user.id,
            Offer.status == "PENDING",
        ).order_by(Offer.created_at.desc())
    )
    offers = result.scalars().all()
    return [
        {
            "id": str(o.id),
            "offer_type": o.offer_type,
            "title": o.title,
            "description": o.description,
            "offered_amount": o.offered_amount,
            "offered_rate": o.offered_rate,
            "valid_until": o.valid_until.isoformat() if o.valid_until else None,
            "status": o.status,
            "triggered_by": o.triggered_by,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in offers
    ]


@router.post("/{offer_id}/accept", summary="Accept an offer")
async def accept_offer(
    offer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Offer).where(Offer.id == offer_id, Offer.user_id == current_user.id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != "PENDING":
        raise HTTPException(status_code=400, detail="Offer is no longer pending")

    offer.status = "ACCEPTED"
    offer.responded_at = datetime.utcnow()

    response = {"offer_id": str(offer.id), "status": "ACCEPTED", "message": ""}

    if offer.offer_type == "RATE_REDUCTION" and offer.loan_id and offer.offered_rate:
        # Update loan interest rate and recalculate future EMIs
        loan_result = await db.execute(select(Loan).where(Loan.id == offer.loan_id))
        loan = loan_result.scalar_one_or_none()
        if loan:
            old_rate = loan.interest_rate
            loan.interest_rate = offer.offered_rate
            # Recalculate remaining EMIs
            pending_emis = [e for e in loan.emi_schedule if e.status.value == "PENDING"]
            if pending_emis and pending_emis[0].outstanding_balance:
                new_emi = calculate_emi(
                    pending_emis[0].outstanding_balance,
                    offer.offered_rate,
                    len(pending_emis),
                )
                loan.emi_amount = new_emi
            response["message"] = f"Rate reduced from {old_rate}% to {offer.offered_rate}%. Future EMIs recalculated."
    elif offer.offer_type in ("TOP_UP", "LOAN_RENEWAL"):
        response["message"] = f"Offer accepted! Please proceed to apply for ₹{offer.offered_amount:,.0f}."
        response["next_action"] = "apply"
    else:
        response["message"] = "Offer accepted."

    await db.commit()
    return response


@router.post("/{offer_id}/decline", summary="Decline an offer")
async def decline_offer(
    offer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Offer).where(Offer.id == offer_id, Offer.user_id == current_user.id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer.status != "PENDING":
        raise HTTPException(status_code=400, detail="Offer is no longer pending")

    offer.status = "DECLINED"
    offer.responded_at = datetime.utcnow()
    await db.commit()

    return {"offer_id": str(offer.id), "status": "DECLINED", "message": "Offer declined."}
