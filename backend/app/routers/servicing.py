"""
NexLoan Servicing Router
Handles EMI schedule fetching, payments, and loan summaries.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, asc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.loan import User, Loan, LoanStatus, EMISchedule, PaymentStatus

logger = logging.getLogger("nexloan.servicing")

router = APIRouter()


class PaymentResponse(BaseModel):
    message: str
    installment_no: int
    amount_paid: float


@router.get(
    "/{loan_id}/schedule",
    summary="Get full EMI schedule with statuses"
)
async def get_schedule(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all EMI rows ordered by installment_no."""
    # Verify ownership
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Loan not found")

    sched_stmt = select(EMISchedule).where(EMISchedule.loan_id == loan_id).order_by(asc(EMISchedule.installment_no))
    sched_result = await db.execute(sched_stmt)
    
    return sched_result.scalars().all()


@router.post(
    "/{loan_id}/pay/{installment_no}",
    response_model=PaymentResponse,
    summary="Simulate EMI payment"
)
async def pay_emi(
    loan_id: str,
    installment_no: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates a successful EMI payment.
    Updates EMISchedule row to PAID and increments Loan total_paid.
    """
    # Verify ownership and status
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan or loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Loan not active or not found")

    # Fetch specific installment
    sched_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.installment_no == installment_no
    )
    sched_result = await db.execute(sched_stmt)
    installment = sched_result.scalars().first()
    
    if not installment:
        raise HTTPException(status_code=404, detail="Installment not found")
        
    if installment.status == PaymentStatus.PAID:
        raise HTTPException(status_code=400, detail="Installment already paid")
        
    # Update Installment
    installment.status = PaymentStatus.PAID
    installment.paid_at = datetime.utcnow()
    installment.paid_amount = installment.emi_amount
    
    # Update Loan total_paid
    loan.total_paid = (loan.total_paid or 0.0) + installment.emi_amount
    
    await db.commit()
    logger.info(f"💰 Payment received: ₹{installment.emi_amount} for Loan {loan.loan_number} (Installment #{installment_no})")
    
    return PaymentResponse(
        message="Payment successful",
        installment_no=installment_no,
        amount_paid=installment.emi_amount
    )


@router.get(
    "/{loan_id}/summary",
    summary="Get outstanding balance, next due date, and paid count"
)
async def get_summary(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns a high-level summary of the loan's servicing state."""
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    # Find next pending installment
    next_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PENDING
    ).order_by(asc(EMISchedule.installment_no))
    next_result = await db.execute(next_stmt)
    next_installment = next_result.scalars().first()
    
    # Count total paid installments
    paid_stmt = select(func.count(EMISchedule.id)).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PAID
    )
    paid_result = await db.execute(paid_stmt)
    paid_count = paid_result.scalar()
    
    return {
        "loan_id": loan_id,
        "loan_number": loan.loan_number,
        "status": loan.status.value,
        "total_paid": loan.total_paid or 0.0,
        "paid_installments": paid_count,
        "total_installments": loan.tenure_months,
        "next_due_date": next_installment.due_date if next_installment else None,
        "next_emi_amount": next_installment.emi_amount if next_installment else 0.0,
        "outstanding_principal_on_schedule": next_installment.outstanding_balance if next_installment else 0.0
    }


# ─── EMI PAUSE ────────────────────────────────────────────────────────────────


class PauseRequest(BaseModel):
    reason: str = ""


@router.post(
    "/{loan_id}/pause-emi",
    summary="Pause next pending EMI (max 1 per year)",
)
async def pause_emi(
    loan_id: str,
    req: PauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Business rules:
    - User can pause maximum 1 EMI per calendar year
    - Only PENDING installments can be paused
    - The paused EMI is deferred — added as a new installment at the end
    - All subsequent due dates shift by 1 month
    - Audit log entry created
    """
    from dateutil.relativedelta import relativedelta
    from app.services.email_service import send_emi_pause_confirmation
    from app.models.loan import AuditLog

    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan or loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Loan not active or not found")

    if loan.emi_pauses_used >= 1:
        raise HTTPException(status_code=400, detail="You've already used your EMI pause for this year.")

    # Find next PENDING installment
    next_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PENDING,
    ).order_by(asc(EMISchedule.installment_no))
    next_result = await db.execute(next_stmt)
    next_installment = next_result.scalars().first()

    if not next_installment:
        raise HTTPException(status_code=400, detail="No pending installment to pause.")

    # Mark it as PAUSED
    next_installment.status = PaymentStatus.PAUSED
    next_installment.pause_reason = req.reason or "User requested pause"

    # Shift all subsequent PENDING installments by 1 month
    subsequent_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.installment_no > next_installment.installment_no,
        EMISchedule.status == PaymentStatus.PENDING,
    ).order_by(asc(EMISchedule.installment_no))
    subsequent_result = await db.execute(subsequent_stmt)
    subsequent = subsequent_result.scalars().all()

    for inst in subsequent:
        inst.due_date = inst.due_date + relativedelta(months=1)

    # Add a new installment at the end (copy of last row + 1 month)
    all_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
    ).order_by(EMISchedule.installment_no.desc())
    all_result = await db.execute(all_stmt)
    last_inst = all_result.scalars().first()

    if last_inst:
        new_inst = EMISchedule(
            loan_id=loan.id,
            installment_no=last_inst.installment_no + 1,
            due_date=last_inst.due_date + relativedelta(months=1),
            emi_amount=next_installment.emi_amount,
            principal=next_installment.principal,
            interest=next_installment.interest,
            outstanding_balance=next_installment.outstanding_balance,
            status=PaymentStatus.PENDING,
        )
        db.add(new_inst)

    loan.emi_pauses_used += 1

    # Audit
    audit = AuditLog(
        loan_id=loan.id,
        action="EMI_PAUSED",
        from_status=loan.status.value,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={
            "paused_installment": next_installment.installment_no,
            "reason": req.reason,
        },
    )
    db.add(audit)
    await db.commit()

    # Determine new final date
    new_final_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
    ).order_by(EMISchedule.installment_no.desc())
    new_final_result = await db.execute(new_final_stmt)
    new_final = new_final_result.scalars().first()
    new_final_date = new_final.due_date.strftime("%d %b %Y") if new_final else "N/A"

    logger.info(f"⏸️ EMI #{next_installment.installment_no} paused for loan {loan.loan_number}")

    return {
        "message": "EMI paused successfully.",
        "paused_installment_no": next_installment.installment_no,
        "new_final_payment_date": new_final_date,
        "pauses_remaining": max(0, 1 - loan.emi_pauses_used),
    }


# ─── FINANCIAL HEALTH ─────────────────────────────────────────────────────────


@router.get(
    "/{loan_id}/health",
    summary="Get financial health data for the borrower",
)
async def financial_health(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculates prepayment impact, on-time payment count, score trajectory,
    and returns a cached Groq-generated weekly financial tip.
    """
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan or loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Loan not active or not found")

    # Get all schedule rows
    sched_stmt = select(EMISchedule).where(EMISchedule.loan_id == loan_id).order_by(asc(EMISchedule.installment_no))
    sched_result = await db.execute(sched_stmt)
    schedule = sched_result.scalars().all()

    # On-time payments
    on_time = sum(1 for s in schedule if s.status == PaymentStatus.PAID)

    # Remaining interest
    remaining_interest = sum(s.interest for s in schedule if s.status == PaymentStatus.PENDING)
    remaining_principal = sum(s.principal for s in schedule if s.status == PaymentStatus.PENDING)
    remaining_months = sum(1 for s in schedule if s.status == PaymentStatus.PENDING)

    # Interest saved if prepay ₹10k / ₹25k
    rate = (loan.interest_rate or 12.0) / 100.0
    monthly_rate = rate / 12

    def calc_interest_saved(prepay_amount: float) -> dict:
        if remaining_principal <= 0 or prepay_amount <= 0:
            return {"interest_saved": 0, "months_saved": 0}
        new_principal = max(0, remaining_principal - prepay_amount)
        # Rough estimate: interest saved = prepay * monthly_rate * remaining_months
        saved = round(prepay_amount * monthly_rate * remaining_months, 2)
        # Months saved: prepay / emi_amount
        emi = loan.emi_amount or 1
        months_saved = max(0, int(prepay_amount / emi))
        return {"interest_saved": saved, "months_saved": months_saved}

    impact_10k = calc_interest_saved(10000)
    impact_25k = calc_interest_saved(25000)

    # Score trajectory
    if on_time >= 6:
        trajectory = "improving"
    elif on_time >= 3:
        trajectory = "stable"
    else:
        trajectory = "stable"

    # Next milestone
    if on_time < 12:
        needed = 12 - on_time
        milestone = f"{needed} more on-time payments = +10 score points"
    elif on_time < 24:
        needed = 24 - on_time
        milestone = f"{needed} more on-time payments = +20 score points"
    else:
        milestone = "Excellent repayment history! You're a top-tier borrower."

    # Groq weekly tip (try Redis cache first — 7 day TTL)
    groq_tip = "Paying even ₹500 extra per month on top of your EMI can reduce your tenure significantly and save thousands in interest."
    try:
        from app.utils.redis_client import get_redis
        redis = await get_redis()
        if redis:
            cache_key = f"health_tip:{loan_id}"
            cached = await redis.get(cache_key)
            if cached:
                groq_tip = cached.decode() if isinstance(cached, bytes) else cached
            else:
                try:
                    from groq import AsyncGroq
                    from app.config import settings
                    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
                    resp = await client.chat.completions.create(
                        messages=[{
                            "role": "user",
                            "content": f"Give a single concise financial tip (max 30 words) for someone with a ₹{loan.approved_amount or loan.loan_amount:,.0f} personal loan at {loan.interest_rate}% with {remaining_months} months remaining. Be specific and actionable. No preamble.",
                        }],
                        model=settings.GROQ_TEXT_MODEL,
                        temperature=0.7,
                        max_tokens=60,
                    )
                    groq_tip = resp.choices[0].message.content.strip()
                    await redis.setex(cache_key, 7 * 24 * 3600, groq_tip)
                except Exception:
                    pass
    except Exception:
        pass

    return {
        "interest_saved_if_prepay_10k": impact_10k["interest_saved"],
        "tenure_reduction_if_prepay_10k": impact_10k["months_saved"],
        "interest_saved_if_prepay_25k": impact_25k["interest_saved"],
        "tenure_reduction_if_prepay_25k": impact_25k["months_saved"],
        "on_time_payments": on_time,
        "credit_score_trajectory": trajectory,
        "next_milestone": milestone,
        "groq_tip": groq_tip,
    }

