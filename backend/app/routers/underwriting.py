"""
NexLoan Underwriting Router — v2.0
Endpoints: evaluate, accept-counter, decline-counter
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.loan import User, Loan, LoanStatus, AuditLog
from app.services.underwriting_engine import evaluate_loan, calculate_emi
from app.services.email_service import send_approval_email
from app.services.milestone_service import advance_milestone

logger = logging.getLogger("nexloan.underwriting")

router = APIRouter()


class UnderwritingResponse(BaseModel):
    loan_id: str
    status: str
    credit_score: int | None = None
    credit_tier: str | None = None
    dti_ratio: float | None = None
    interest_rate: float | None = None
    approved_amount: float | None = None
    counter_offer_amount: float | None = None
    counter_offer_rate: float | None = None
    rejection_reason: str | None = None
    improvement_plan: str | None = None
    reapply_reminder_date: str | None = None


@router.post(
    "/{loan_id}/evaluate",
    response_model=UnderwritingResponse,
    summary="Trigger the automated underwriting engine for a loan",
)
async def trigger_evaluation(
    loan_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates a loan based on Theoremlabs Credit Score, DTI, and internal policies.
    May result in APPROVED, COUNTER_OFFERED, or REJECTED.
    """
    try:
        result = await evaluate_loan(db, loan_id, str(current_user.id), background_tasks)
        # Advance milestone based on result
        await advance_milestone(loan_id, "UNDERWRITING_COMPLETE", db)
        decision_status = result.get("status", "") if isinstance(result, dict) else getattr(result, 'status', '')
        if decision_status in ["APPROVED", "COUNTER_OFFERED", "REJECTED"]:
            await advance_milestone(loan_id, "LOAN_DECISION", db)
        if decision_status == "APPROVED":
            await advance_milestone(loan_id, "DISBURSEMENT_PROCESSING", db)
        await db.commit()
        return result
    except ValueError as e:
        logger.warning(f"Validation error during underwriting: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to evaluate loan {loan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during underwriting evaluation.",
        )


@router.post(
    "/{loan_id}/accept-counter",
    summary="Accept a counter offer",
)
async def accept_counter_offer(
    loan_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts the counter offer — sets approved_amount to counter_offer_amount,
    moves loan to APPROVED status.
    """
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.COUNTER_OFFERED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot accept counter offer for loan in {loan.status.value} status.",
        )

    old_status = loan.status
    loan.approved_amount = loan.counter_offer_amount
    loan.interest_rate = loan.counter_offer_rate
    loan.counter_accepted = True
    loan.status = LoanStatus.APPROVED
    loan.emi_amount = calculate_emi(
        loan.counter_offer_amount,
        loan.counter_offer_rate,
        loan.tenure_months or 36,
    )

    audit = AuditLog(
        loan_id=loan.id,
        action="COUNTER_OFFER_ACCEPTED",
        from_status=old_status.value,
        to_status=LoanStatus.APPROVED.value,
        actor=str(current_user.id),
        metadata_={
            "accepted_amount": loan.approved_amount,
            "accepted_rate": loan.interest_rate,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(loan)

    # Advance milestone: counter accepted = approved
    await advance_milestone(loan_id, "LOAN_DECISION", db)
    await advance_milestone(loan_id, "DISBURSEMENT_PROCESSING", db)
    await db.commit()

    # Send approval email
    background_tasks.add_task(
        send_approval_email,
        email=current_user.email,
        full_name=current_user.full_name,
        loan_number=loan.loan_number,
        loan_amount=loan.approved_amount,
        interest_rate=loan.interest_rate,
        emi_amount=loan.emi_amount,
        tenure_months=loan.tenure_months,
    )

    logger.info(f"✅ Counter offer accepted for {loan.loan_number}: ₹{loan.approved_amount}")

    return {
        "loan_id": str(loan.id),
        "loan_number": loan.loan_number,
        "new_status": loan.status.value,
        "approved_amount": loan.approved_amount,
        "interest_rate": loan.interest_rate,
        "emi_amount": loan.emi_amount,
        "message": "Counter offer accepted. Loan approved.",
    }


@router.post(
    "/{loan_id}/decline-counter",
    summary="Decline a counter offer",
)
async def decline_counter_offer(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Declines the counter offer — moves loan to REJECTED.
    """
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.COUNTER_OFFERED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot decline counter offer for loan in {loan.status.value} status.",
        )

    old_status = loan.status
    loan.status = LoanStatus.REJECTED
    loan.counter_accepted = False

    audit = AuditLog(
        loan_id=loan.id,
        action="COUNTER_OFFER_DECLINED",
        from_status=old_status.value,
        to_status=LoanStatus.REJECTED.value,
        actor=str(current_user.id),
    )
    db.add(audit)
    await db.commit()

    logger.info(f"❌ Counter offer declined for {loan.loan_number}")

    return {
        "loan_id": str(loan.id),
        "loan_number": loan.loan_number,
        "new_status": loan.status.value,
        "message": "Counter offer declined. Loan rejected.",
    }
