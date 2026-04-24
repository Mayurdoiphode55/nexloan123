"""
NexLoan Co-Applicant Router
Endpoints: /api/application/{loan_id}/co-applicant
Allows borrowers to add a co-applicant to increase approval chances.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.models.loan import Loan, User, CoApplicant, AuditLog, LoanStatus
from app.utils.database import get_db
from app.utils.auth import get_current_user

logger = logging.getLogger("nexloan.co_applicant")
router = APIRouter()


class CoApplicantRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    relationship: str = Field(..., description="SPOUSE, PARENT, SIBLING, OTHER")
    phone: str = Field(..., min_length=10, max_length=15)
    email: Optional[str] = None
    monthly_income: float = Field(..., gt=0)
    employment_type: str = "SALARIED"
    existing_emi: float = 0.0
    consent_given: bool


async def _get_borrower_loan(loan_id: str, user: User, db: AsyncSession) -> Loan:
    loan = (await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user.id)
    )).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@router.post("/{loan_id}/co-applicant", status_code=status.HTTP_201_CREATED)
async def add_co_applicant(
    loan_id: str,
    req: CoApplicantRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add co-applicant to a loan application."""
    if not req.consent_given:
        raise HTTPException(status_code=400, detail="Co-applicant consent is required")

    loan = await _get_borrower_loan(loan_id, current_user, db)

    if loan.status not in (LoanStatus.INQUIRY, LoanStatus.APPLICATION, LoanStatus.KYC_PENDING):
        raise HTTPException(status_code=400, detail="Cannot add co-applicant at this loan stage")

    # Remove existing co-applicant if any
    existing = (await db.execute(
        select(CoApplicant).where(CoApplicant.loan_id == loan.id)
    )).scalar_one_or_none()
    if existing:
        await db.delete(existing)

    co = CoApplicant(
        loan_id=loan.id,
        full_name=req.full_name,
        relationship=req.relationship,
        phone=req.phone,
        email=req.email,
        monthly_income=req.monthly_income,
        employment_type=req.employment_type,
        existing_emi=req.existing_emi,
        consent_given=True,
        consent_timestamp=datetime.utcnow(),
    )
    db.add(co)
    loan.has_co_applicant = True
    combined = (loan.monthly_income or 0) + req.monthly_income
    loan.combined_income = combined
    loan.combined_existing_emi = (loan.existing_emi or 0) + req.existing_emi

    audit = AuditLog(
        loan_id=loan.id,
        action="CO_APPLICANT_ADDED",
        from_status=loan.status.value,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={"co_applicant_name": req.full_name, "combined_income": combined},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(co)

    return {
        "id": str(co.id),
        "full_name": co.full_name,
        "combined_income": loan.combined_income,
        "message": "Co-applicant added successfully",
    }


@router.get("/{loan_id}/co-applicant")
async def get_co_applicant(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get co-applicant details for a loan."""
    loan = await _get_borrower_loan(loan_id, current_user, db)
    co = (await db.execute(
        select(CoApplicant).where(CoApplicant.loan_id == loan.id)
    )).scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="No co-applicant found for this loan")

    return {
        "id": str(co.id),
        "full_name": co.full_name,
        "relationship": co.relationship,
        "phone": co.phone,
        "email": co.email,
        "monthly_income": co.monthly_income,
        "employment_type": co.employment_type.value if co.employment_type and hasattr(co.employment_type, 'value') else str(co.employment_type) if co.employment_type else None,
        "existing_emi": co.existing_emi,
        "individual_credit_score": co.individual_credit_score,
        "consent_given": co.consent_given,
        "consent_timestamp": co.consent_timestamp.isoformat() if co.consent_timestamp else None,
        "created_at": co.created_at.isoformat(),
    }


@router.delete("/{loan_id}/co-applicant")
async def remove_co_applicant(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove co-applicant (only in early loan stages)."""
    loan = await _get_borrower_loan(loan_id, current_user, db)
    if loan.status not in (LoanStatus.INQUIRY, LoanStatus.APPLICATION, LoanStatus.KYC_PENDING):
        raise HTTPException(status_code=400, detail="Cannot remove co-applicant at this stage")

    co = (await db.execute(
        select(CoApplicant).where(CoApplicant.loan_id == loan.id)
    )).scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="No co-applicant found")

    await db.delete(co)
    loan.has_co_applicant = False
    loan.combined_income = None
    loan.combined_existing_emi = None
    await db.commit()

    return {"message": "Co-applicant removed successfully"}
