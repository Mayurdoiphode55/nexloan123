"""
NexLoan Closure Router
Handles pre-closure quotes and final loan closure.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.loan import User, Loan, LoanStatus, EMISchedule, PaymentStatus
from app.services.emi_engine import calculate_preclosure
from app.services.email_service import send_no_dues_certificate

logger = logging.getLogger("nexloan.closure")

router = APIRouter()


@router.get(
    "/{loan_id}/preclosure-quote",
    summary="Get settlement amount and fee breakdown"
)
async def get_preclosure_quote(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calculates the cost to pre-close an active loan today."""
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only ACTIVE loans can be pre-closed")

    # Fetch all PENDING installments
    sched_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PENDING
    ).order_by(asc(EMISchedule.installment_no))
    sched_result = await db.execute(sched_stmt)
    pending_installments = sched_result.scalars().all()
    
    quote = calculate_preclosure(pending_installments)
    
    return {
        "loan_id": loan.id,
        "loan_number": loan.loan_number,
        "quote_date": datetime.utcnow().isoformat(),
        **quote
    }


class CloseLoanResponse(BaseModel):
    message: str
    status: str
    amount_settled: float


@router.post(
    "/{loan_id}/close",
    summary="Close loan — calculate journey stats, send celebration email, generate re-offer",
)
async def close_loan(
    loan_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Closes the loan and:
    1. Calculates journey stats (total_paid, interest_saved, early payments)
    2. Generates instant pre-approved re-offer (1.5x amount, loyalty rate)
    3. Sends closure celebration email via Brevo
    """
    from app.models.loan import AuditLog
    from app.services.email_service import send_closure_celebration_email

    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only ACTIVE loans can be closed")

    # Fetch all installments
    sched_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
    ).order_by(asc(EMISchedule.installment_no))
    sched_result = await db.execute(sched_stmt)
    all_installments = sched_result.scalars().all()

    pending_installments = [i for i in all_installments if i.status == PaymentStatus.PENDING]
    paid_installments = [i for i in all_installments if i.status == PaymentStatus.PAID]

    is_preclosure = len(pending_installments) > 0
    amount_settled = 0.0

    if is_preclosure:
        quote = calculate_preclosure(pending_installments)
        amount_settled = quote["total_payable"]
        loan.status = LoanStatus.PRE_CLOSED
        loan.preclosure_charge = quote["preclosure_charge"]

        for inst in pending_installments:
            inst.status = PaymentStatus.PAID
            inst.paid_at = datetime.utcnow()
            inst.paid_amount = inst.emi_amount

        loan.total_paid = (loan.total_paid or 0.0) + amount_settled
    else:
        loan.status = LoanStatus.CLOSED

    loan.closed_at = datetime.utcnow()

    # ── Journey Stats ──
    total_paid = loan.total_paid or 0.0
    original_amount = loan.approved_amount or loan.loan_amount or 0
    interest_paid = round(total_paid - original_amount, 2) if total_paid > original_amount else 0

    # Early payments count (paid before due date)
    early_payments = sum(
        1 for i in paid_installments
        if i.paid_at and i.due_date and i.paid_at < i.due_date
    )

    # Interest saved from early payments (rough estimate)
    monthly_rate = (loan.interest_rate or 12.0) / (12 * 100)
    interest_saved = round(early_payments * original_amount * monthly_rate * 0.1, 2)

    # Score improvement estimate (10 points per 12 on-time payments)
    on_time_count = len(paid_installments)
    score_improvement = (on_time_count // 12) * 10 + min(on_time_count % 12, 5)

    # ── Re-offer (loyalty pricing) ──
    reapply_amount = round(original_amount * 1.5, 2)
    reapply_rate = round(max((loan.interest_rate or 12.0) - 0.5, 10.0), 2)

    # Send celebration email
    try:
        background_tasks.add_task(
            send_closure_celebration_email,
            to_email=current_user.email,
            name=current_user.full_name,
            loan_number=loan.loan_number,
            original_amount=original_amount,
            total_paid=total_paid,
            interest_saved=interest_saved,
            score_improvement=score_improvement,
            reapply_offer_amount=reapply_amount,
            reapply_offer_rate=reapply_rate,
        )
        loan.closure_celebration_sent = True
        loan.no_dues_sent = True
    except Exception as e:
        logger.error(f"Failed to send closure email: {e}")

    # Audit
    audit = AuditLog(
        loan_id=loan.id,
        action="LOAN_CLOSED",
        from_status=LoanStatus.ACTIVE.value,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={
            "is_preclosure": is_preclosure,
            "total_paid": total_paid,
            "interest_saved": interest_saved,
            "score_improvement": score_improvement,
            "reapply_amount": reapply_amount,
            "reapply_rate": reapply_rate,
        },
    )
    db.add(audit)
    await db.commit()

    logger.info(f"🔒 Loan {loan.loan_number} closed. Pre-closure={is_preclosure}")

    return {
        "message": "Loan closed successfully. Celebration email sent.",
        "status": loan.status.value,
        "amount_settled": amount_settled,
        "total_paid": total_paid,
        "interest_saved": interest_saved,
        "score_improvement": score_improvement,
        "reapply_offer_amount": reapply_amount,
        "reapply_offer_rate": reapply_rate,
    }


@router.get(
    "/{loan_id}/closure-stats",
    summary="Get journey stats for the closure celebration screen",
)
async def get_closure_stats(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns journey stats for the closure celebration page."""
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status not in [LoanStatus.CLOSED, LoanStatus.PRE_CLOSED]:
        raise HTTPException(status_code=400, detail="Loan is not closed")

    # Fetch paid installments
    paid_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PAID,
    )
    paid_result = await db.execute(paid_stmt)
    paid = paid_result.scalars().all()

    original_amount = loan.approved_amount or loan.loan_amount or 0
    total_paid = loan.total_paid or 0.0
    interest_paid = round(total_paid - original_amount, 2) if total_paid > original_amount else 0

    early_payments = sum(
        1 for i in paid
        if i.paid_at and i.due_date and i.paid_at < i.due_date
    )

    monthly_rate = (loan.interest_rate or 12.0) / (12 * 100)
    interest_saved = round(early_payments * original_amount * monthly_rate * 0.1, 2)
    score_improvement = (len(paid) // 12) * 10 + min(len(paid) % 12, 5)

    reapply_amount = round(original_amount * 1.5, 2)
    reapply_rate = round(max((loan.interest_rate or 12.0) - 0.5, 10.0), 2)

    return {
        "total_paid": total_paid,
        "original_amount": original_amount,
        "interest_paid": interest_paid,
        "early_payments_count": early_payments,
        "interest_saved": interest_saved,
        "estimated_score_improvement": score_improvement,
        "reapply_offer_amount": reapply_amount,
        "reapply_offer_rate": reapply_rate,
    }

