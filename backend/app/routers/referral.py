"""
NexLoan Referral Router — Refer & Earn System
Endpoints: /api/referral — generate code, invite, history
"""

import logging
import random
import string

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, Referral
from app.utils.database import get_db
from app.utils.auth import get_current_user

logger = logging.getLogger("nexloan.referral")

router = APIRouter()


class InviteRequest(BaseModel):
    email: EmailStr


def _generate_referral_code(name: str) -> str:
    """Generate a referral code: FIRSTNAME_XXXX"""
    first = name.split()[0].upper()[:6]
    digits = ''.join(random.choices(string.digits, k=4))
    return f"{first}_{digits}"


@router.get("/code")
async def get_referral_code(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get or generate the user's referral code."""
    # Check if user already has a referral code
    stmt = select(Referral).where(
        Referral.referrer_id == current_user.id,
        Referral.referred_email == None,  # The "master" referral record
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        code = existing.referral_code
    else:
        # Generate a new code
        code = _generate_referral_code(current_user.full_name)
        # Ensure uniqueness
        for _ in range(10):
            check = await db.execute(select(Referral).where(Referral.referral_code == code))
            if not check.scalar_one_or_none():
                break
            code = _generate_referral_code(current_user.full_name)

        master = Referral(
            referrer_id=current_user.id,
            referral_code=code,
        )
        db.add(master)
        await db.commit()

    # Get stats
    stats_stmt = select(
        func.count(Referral.id).filter(Referral.referrer_id == current_user.id, Referral.referred_email != None),
    )
    total_result = await db.execute(
        select(func.count(Referral.id)).where(
            Referral.referrer_id == current_user.id,
            Referral.referred_email != None,
        )
    )
    total_invited = total_result.scalar() or 0

    signup_result = await db.execute(
        select(func.count(Referral.id)).where(
            Referral.referrer_id == current_user.id,
            Referral.status.in_(["SIGNED_UP", "LOAN_APPROVED", "REWARDED"]),
        )
    )
    total_signups = signup_result.scalar() or 0

    reward_result = await db.execute(
        select(func.coalesce(func.sum(Referral.reward_amount), 0)).where(
            Referral.referrer_id == current_user.id,
            Referral.status == "REWARDED",
        )
    )
    total_earned = reward_result.scalar() or 0

    return {
        "referral_code": code,
        "stats": {
            "invited": total_invited,
            "signed_up": total_signups,
            "earned": float(total_earned),
        },
    }


@router.post("/invite")
async def send_invite(
    req: InviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a referral invite to a friend's email."""
    # Get the user's referral code
    code_stmt = select(Referral).where(
        Referral.referrer_id == current_user.id,
    )
    code_result = await db.execute(code_stmt)
    existing = code_result.scalars().first()

    if not existing:
        raise HTTPException(status_code=400, detail="Generate your referral code first")

    # Check if already invited
    dup_stmt = select(Referral).where(
        Referral.referrer_id == current_user.id,
        Referral.referred_email == req.email,
    )
    dup_result = await db.execute(dup_stmt)
    if dup_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You've already invited this email")

    # Create referral record
    referral = Referral(
        referrer_id=current_user.id,
        referral_code=existing.referral_code,
        referred_email=req.email,
    )
    db.add(referral)
    await db.commit()

    logger.info(f"✅ Referral invite sent: {req.email} by {current_user.email}")

    return {
        "message": f"Referral invite sent to {req.email}",
        "referral_code": existing.referral_code,
    }


@router.get("/history")
async def get_referral_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all referrals and their statuses."""
    stmt = select(Referral).where(
        Referral.referrer_id == current_user.id,
        Referral.referred_email != None,
    ).order_by(Referral.created_at.desc())

    result = await db.execute(stmt)
    referrals = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "referred_email": r.referred_email[:3] + "***" + r.referred_email[r.referred_email.index("@"):] if r.referred_email else None,
            "status": r.status,
            "reward_amount": r.reward_amount,
            "created_at": r.created_at.isoformat(),
        }
        for r in referrals
    ]
