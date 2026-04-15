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
    response_model=CloseLoanResponse,
    summary="Close loan and email No-Dues Certificate"
)
async def close_loan(
    loan_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates the final payment/settlement of a loan.
    Moves status to PRE_CLOSED (if pending EMIs exist) or CLOSED.
    Sends No-Dues certificate to user.
    """
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only ACTIVE loans can be closed")

    # Determine if it's normal closure or pre-closure
    sched_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PENDING
    )
    sched_result = await db.execute(sched_stmt)
    pending_installments = sched_result.scalars().all()
    
    is_preclosure = len(pending_installments) > 0
    amount_settled = 0.0
    
    if is_preclosure:
        quote = calculate_preclosure(pending_installments)
        amount_settled = quote["total_payable"]
        loan.status = LoanStatus.PRE_CLOSED
        loan.preclosure_charge = quote["preclosure_charge"]
        
        # Mark all pending as PAID (simulating settlement payment)
        for inst in pending_installments:
            inst.status = PaymentStatus.PAID
            inst.paid_at = datetime.utcnow()
            inst.paid_amount = inst.emi_amount
            
        loan.total_paid = (loan.total_paid or 0.0) + amount_settled
    else:
        loan.status = LoanStatus.CLOSED

    loan.closed_at = datetime.utcnow()
    
    try:
        # Send No-Dues Certificate email in background
        background_tasks.add_task(
            send_no_dues_certificate,
            email=current_user.email,
            full_name=current_user.full_name,
            loan_number=loan.loan_number,
            loan_amount=loan.approved_amount or loan.loan_amount,
            total_paid=loan.total_paid or 0.0
        )
        loan.no_dues_sent = True
    except Exception as e:
        logger.error(f"Failed to send No-Dues email for Loan {loan.loan_number}: {e}")
        loan.no_dues_sent = False
        
    await db.commit()
    logger.info(f"🔒 Loan {loan.loan_number} closed successfully. (Pre-closure: {is_preclosure})")
    
    return CloseLoanResponse(
        message="Loan closed successfully. No-Dues Certificate emailed.",
        status=loan.status.value,
        amount_settled=amount_settled
    )
