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


# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: Pre-Closure Token Flow
# ═══════════════════════════════════════════════════════════════════════════════

import secrets
from datetime import timedelta
from app.models.loan import PreClosureRequest


@router.post(
    "/{loan_id}/request-preclosure",
    summary="Generate a tokenized 24-hour pre-closure link",
)
async def request_preclosure(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a pre-closure request with a secure 24-hour token."""
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only ACTIVE loans can be pre-closed")

    # Check for existing pending request
    existing = await db.execute(
        select(PreClosureRequest).where(
            PreClosureRequest.loan_id == loan_id,
            PreClosureRequest.status == "PENDING",
            PreClosureRequest.token_expires_at > datetime.utcnow(),
        )
    )
    existing_pcr = existing.scalars().first()
    if existing_pcr:
        logger.info(f"Returning existing pre-closure token for loan {loan.loan_number}")
        return {
            "message": "Existing pending request found. Redirecting to secure link.",
            "token": existing_pcr.token,
            "expires_at": existing_pcr.token_expires_at.isoformat(),
            "total_settlement_amount": existing_pcr.total_settlement_amount,
        }

    # Calculate settlement
    sched_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan_id,
        EMISchedule.status == PaymentStatus.PENDING,
    ).order_by(asc(EMISchedule.installment_no))
    sched_result = await db.execute(sched_stmt)
    pending = sched_result.scalars().all()

    quote = calculate_preclosure(pending)
    token = secrets.token_urlsafe(64)
    token_expires_at = datetime.utcnow() + timedelta(hours=24)

    from sqlalchemy import text
    insert_stmt = text("""
        INSERT INTO pre_closure_requests 
        (id, loan_id, user_id, token, token_expires_at, outstanding_principal, 
         pre_closure_charge_percent, pre_closure_charge, total_settlement_amount, 
         terms_accepted, status, created_at)
        VALUES 
        (gen_random_uuid(), :loan_id, :user_id, :token, :token_expires_at, 
         :outstanding_principal, 2.0, :pre_closure_charge, :total_settlement_amount, 
         false, 'PENDING', now())
    """)
    await db.execute(insert_stmt, {
        "loan_id": loan.id,
        "user_id": current_user.id,
        "token": token,
        "token_expires_at": token_expires_at,
        "outstanding_principal": quote["outstanding_principal"],
        "pre_closure_charge": quote["preclosure_charge"],
        "total_settlement_amount": quote["total_payable"]
    })
    await db.commit()

    logger.info(f"Pre-closure token generated for loan {loan.loan_number}")

    return {
        "message": "Pre-closure request created. Token valid for 24 hours.",
        "token": token,
        "expires_at": token_expires_at.isoformat(),
        "total_settlement_amount": quote["total_payable"],
    }


@router.get(
    "/preclosure/{token}",
    summary="Validate a pre-closure token and return settlement details",
)
async def get_preclosure_by_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — validates token and returns settlement breakdown."""
    result = await db.execute(
        select(PreClosureRequest).where(PreClosureRequest.token == token)
    )
    pcr = result.scalars().first()

    if not pcr:
        raise HTTPException(status_code=404, detail="Invalid or expired pre-closure token")

    if pcr.token_expires_at < datetime.utcnow():
        pcr.status = "EXPIRED"
        await db.commit()
        raise HTTPException(status_code=410, detail="Pre-closure token has expired")

    if pcr.status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Pre-closure already completed")

    # Fetch loan info
    loan = (await db.execute(select(Loan).where(Loan.id == pcr.loan_id))).scalars().first()

    return {
        "token": pcr.token,
        "loan_number": loan.loan_number if loan else "N/A",
        "outstanding_principal": pcr.outstanding_principal,
        "preclosure_charge": pcr.pre_closure_charge,
        "total_payable": pcr.total_settlement_amount,
        "charge_rate": pcr.pre_closure_charge_percent,
        "valid_until": pcr.token_expires_at.isoformat(),
        "terms_accepted": pcr.terms_accepted,
        "status": pcr.status,
    }


@router.post(
    "/preclosure/{token}/confirm",
    summary="Accept pre-closure T&C",
)
async def confirm_preclosure(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Borrower accepts terms and conditions for pre-closure."""
    result = await db.execute(
        select(PreClosureRequest).where(PreClosureRequest.token == token)
    )
    pcr = result.scalars().first()

    if not pcr:
        raise HTTPException(status_code=404, detail="Invalid token")
    if pcr.token_expires_at < datetime.utcnow():
        pcr.status = "EXPIRED"
        await db.commit()
        raise HTTPException(status_code=410, detail="Token expired")
    if pcr.status != "PENDING":
        raise HTTPException(status_code=400, detail=f"Cannot confirm — status is {pcr.status}")

    pcr.terms_accepted = True
    pcr.terms_accepted_at = datetime.utcnow()
    pcr.status = "ACCEPTED"
    await db.commit()

    return {"message": "Terms accepted. Proceed to payment.", "status": "ACCEPTED"}


@router.post(
    "/preclosure/{token}/complete",
    summary="Complete pre-closure payment and close loan",
)
async def complete_preclosure(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Finalizes the pre-closure: marks all pending EMIs paid, closes loan."""
    from app.models.loan import AuditLog

    result = await db.execute(
        select(PreClosureRequest).where(PreClosureRequest.token == token)
    )
    pcr = result.scalars().first()

    if not pcr:
        raise HTTPException(status_code=404, detail="Invalid token")
    if pcr.status != "ACCEPTED":
        raise HTTPException(status_code=400, detail="Terms must be accepted first")

    # Fetch and close loan
    loan = (await db.execute(select(Loan).where(Loan.id == pcr.loan_id))).scalars().first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Mark all pending EMIs as paid
    pending_stmt = select(EMISchedule).where(
        EMISchedule.loan_id == loan.id,
        EMISchedule.status == PaymentStatus.PENDING,
    )
    pending_result = await db.execute(pending_stmt)
    for inst in pending_result.scalars().all():
        inst.status = PaymentStatus.PAID
        inst.paid_at = datetime.utcnow()
        inst.paid_amount = inst.emi_amount

    loan.status = LoanStatus.PRE_CLOSED
    loan.closed_at = datetime.utcnow()
    loan.total_paid = (loan.total_paid or 0) + pcr.total_settlement_amount

    pcr.status = "COMPLETED"

    # Audit
    audit = AuditLog(
        loan_id=loan.id,
        action="PRE_CLOSURE_COMPLETED",
        from_status=LoanStatus.ACTIVE.value,
        to_status=LoanStatus.PRE_CLOSED.value,
        actor=str(pcr.user_id),
        metadata_={
            "token": token[:8] + "...",
            "settlement_amount": pcr.total_settlement_amount,
        },
    )
    db.add(audit)
    await db.commit()

    logger.info(f"🔒 Pre-closure completed for loan {loan.loan_number} via token")

    return {
        "message": "Loan pre-closed successfully",
        "loan_number": loan.loan_number,
        "status": "PRE_CLOSED",
        "settlement_amount": pcr.total_settlement_amount,
    }


