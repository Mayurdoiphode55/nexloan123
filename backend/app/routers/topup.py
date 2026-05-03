"""
NexLoan Top-Up Router — Loan Top-Up Module
GET /{loan_id}/eligibility, GET /{loan_id}/quote, POST /{loan_id}/apply
"""

import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, Loan, LoanStatus, AuditLog
from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.services.emi_engine import calculate_emi

logger = logging.getLogger("nexloan.topup")
router = APIRouter()


class TopUpApplyRequest(BaseModel):
    additional_amount: float
    new_tenure_months: int


@router.get("/{loan_id}/eligibility", summary="Check top-up eligibility")
async def check_eligibility(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != LoanStatus.ACTIVE:
        return {"eligible": False, "reason": "Loan must be ACTIVE for top-up"}

    # Check on-time payments (min 6)
    paid_emis = [e for e in loan.emi_schedule if e.status.value == "PAID"]
    on_time = [e for e in paid_emis if e.paid_at and e.due_date and e.paid_at <= e.due_date]

    if len(on_time) < 6:
        return {"eligible": False, "reason": f"Minimum 6 on-time payments required. You have {len(on_time)}."}

    # Check no existing active top-up
    existing_topup = await db.execute(
        select(Loan).where(
            Loan.parent_loan_id == loan.id,
            Loan.is_topup == True,
            Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED, LoanStatus.APPROVED]),
        )
    )
    if existing_topup.scalar_one_or_none():
        return {"eligible": False, "reason": "An active top-up already exists for this loan"}

    # Calculate max top-up amount (50% of original approved amount)
    max_topup = (loan.approved_amount or loan.loan_amount or 0) * 0.5

    # Outstanding principal
    pending_emis = sorted(
        [e for e in loan.emi_schedule if e.status.value == "PENDING"],
        key=lambda x: x.installment_no,
    )
    outstanding = pending_emis[0].outstanding_balance if pending_emis else 0

    return {
        "eligible": True,
        "max_topup_amount": max_topup,
        "outstanding_principal": outstanding,
        "on_time_payments": len(on_time),
        "current_rate": loan.interest_rate,
    }


@router.get("/{loan_id}/quote", summary="Get top-up calculation quote")
async def get_topup_quote(
    loan_id: str,
    additional_amount: float = 100000,
    new_tenure_months: int = 36,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    pending_emis = sorted(
        [e for e in loan.emi_schedule if e.status.value == "PENDING"],
        key=lambda x: x.installment_no,
    )
    outstanding = pending_emis[0].outstanding_balance if pending_emis else 0
    new_principal = outstanding + additional_amount
    rate = loan.interest_rate or 12.0
    new_emi = calculate_emi(new_principal, rate, new_tenure_months)

    return {
        "outstanding_from_original": outstanding,
        "additional_amount": additional_amount,
        "new_principal": new_principal,
        "new_tenure_months": new_tenure_months,
        "new_emi": new_emi,
        "interest_rate": rate,
        "original_loan_will_close": True,
    }


@router.post("/{loan_id}/apply", summary="Apply for a top-up loan")
async def apply_topup(
    loan_id: str,
    body: TopUpApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify eligibility first
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan.status != LoanStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Loan must be ACTIVE for top-up")

    pending_emis = sorted(
        [e for e in loan.emi_schedule if e.status.value == "PENDING"],
        key=lambda x: x.installment_no,
    )
    outstanding = pending_emis[0].outstanding_balance if pending_emis else 0
    new_principal = outstanding + body.additional_amount
    rate = loan.interest_rate or 12.0
    new_emi = calculate_emi(new_principal, rate, body.new_tenure_months)

    # Generate new loan number
    count_result = await db.execute(select(Loan))
    count = len(count_result.scalars().all()) + 1
    loan_number = f"NL-{datetime.utcnow().year}-{count:05d}"

    # Create top-up loan record
    topup_loan = Loan(
        user_id=current_user.id,
        loan_number=loan_number,
        status=LoanStatus.APPROVED,
        loan_amount=new_principal,
        tenure_months=body.new_tenure_months,
        purpose=loan.purpose,
        monthly_income=loan.monthly_income,
        employment_type=loan.employment_type,
        existing_emi=loan.existing_emi,
        credit_score=loan.credit_score,
        interest_rate=rate,
        approved_amount=new_principal,
        emi_amount=new_emi,
        is_topup=True,
        parent_loan_id=loan.id,
        topup_previous_outstanding=outstanding,
    )
    db.add(topup_loan)

    # Audit log
    audit = AuditLog(
        loan_id=loan.id,
        action="TOPUP_APPLIED",
        from_status=loan.status.value,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={"additional_amount": body.additional_amount, "new_principal": new_principal},
    )
    db.add(audit)

    await db.commit()
    await db.refresh(topup_loan)

    return {
        "topup_loan_id": str(topup_loan.id),
        "loan_number": topup_loan.loan_number,
        "new_principal": new_principal,
        "new_emi": new_emi,
        "interest_rate": rate,
        "tenure_months": body.new_tenure_months,
        "message": "Top-up loan created successfully. Pending disbursement.",
    }
