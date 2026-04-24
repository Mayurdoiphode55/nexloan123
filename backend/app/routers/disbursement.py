"""
NexLoan Disbursement Router
Handles loan disbursement and amortization schedule creation.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.loan import User, Loan, LoanStatus, EMISchedule, AuditLog
from app.services.emi_engine import generate_amortization_schedule
from app.services.milestone_service import advance_milestone

logger = logging.getLogger("nexloan.disbursement")

router = APIRouter()


class DisburseResponse(BaseModel):
    loan_id: str
    status: str
    message: str


@router.post(
    "/{loan_id}/disburse",
    response_model=DisburseResponse,
    summary="Disburse an approved loan and generate EMI schedule (Phase 5)"
)
async def disburse_loan(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simulates disbursing funds to the borrower's account.
    Moves loan from APPROVED -> ACTIVE and generates the full amortization schedule.
    In a real system, this would make an API call to a payment gateway (e.g. RazorpayX).
    """
    stmt = select(Loan).where(Loan.id == loan_id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    if loan.status != LoanStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot disburse loan. Current status is {loan.status.value}"
        )
        
    if not loan.approved_amount or not loan.interest_rate or not loan.tenure_months:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan missing critical terms (amount, rate, or tenure)"
        )

    old_status = loan.status
    now = datetime.utcnow()
    
    # 1. Update Loan Record
    loan.status = LoanStatus.ACTIVE
    loan.disbursed_at = now
    loan.disbursed_amount = loan.approved_amount
    loan.account_number = "MOCK-ACCT-9999" # Mocking Bank Account
    
    # 2. Generate Schedule
    schedule_dicts = generate_amortization_schedule(
        loan_id=loan.id,
        principal=loan.approved_amount,
        annual_rate=loan.interest_rate,
        tenure_months=loan.tenure_months,
        disbursement_date=now
    )
    
    # 3. Bulk Insert Schedule
    emi_objects = [EMISchedule(**item) for item in schedule_dicts]
    db.add_all(emi_objects)
    
    # 4. Audit Log
    audit = AuditLog(
        loan_id=loan.id,
        action="LOAN_DISBURSED",
        from_status=old_status.value,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={
            "disbursed_amount": loan.disbursed_amount,
            "installments_created": len(emi_objects)
        }
    )
    db.add(audit)
    
    await db.commit()

    # Advance milestones: disbursed + active
    await advance_milestone(loan_id, "DISBURSED", db)
    await advance_milestone(loan_id, "ACTIVE", db)
    await db.commit()

    logger.info(f"💸 Loan {loan.loan_number} disbursed successfully. {len(emi_objects)} EMIs created.")
    
    return DisburseResponse(
        loan_id=str(loan.id),
        status=loan.status.value,
        message=f"Loan disbursed successfully. Added {len(emi_objects)} EMI installments."
    )
