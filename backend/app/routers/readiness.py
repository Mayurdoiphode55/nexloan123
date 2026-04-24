"""
NexLoan Readiness Router — Anonymous Loan Readiness Check
POST /api/readiness/check — No auth required.
"""

import logging
import uuid
from pydantic import BaseModel

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import EmploymentType, LoanReadinessCheck
from app.services.loan_readiness import calculate_readiness_score
from app.utils.database import get_db

logger = logging.getLogger("nexloan.readiness")

router = APIRouter()


class ReadinessRequest(BaseModel):
    monthly_income: float
    employment_type: EmploymentType
    existing_emi: float = 0.0
    loan_amount: float
    tenure_months: int


class ReadinessResponse(BaseModel):
    readiness_score: int
    estimated_amount_min: float
    estimated_amount_max: float
    estimated_rate_min: float
    estimated_rate_max: float
    likely_approved: bool
    score_breakdown: dict
    improvement_tips: list


@router.post(
    "/check",
    response_model=ReadinessResponse,
    summary="Check loan readiness — no auth required",
)
async def check_readiness(
    req: ReadinessRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Anonymous readiness check. No KYC, no login.
    Calculates a 0-100 score and returns estimated offer range.
    Saves to loan_readiness_checks table for analytics.
    """
    result = calculate_readiness_score(
        monthly_income=req.monthly_income,
        employment_type=req.employment_type,
        existing_emi=req.existing_emi,
        loan_amount=req.loan_amount,
        tenure_months=req.tenure_months,
    )

    # Save to DB for conversion tracking
    check = LoanReadinessCheck(
        session_id=str(uuid.uuid4()),
        monthly_income=req.monthly_income,
        employment_type=req.employment_type,
        existing_emi=req.existing_emi,
        loan_amount=req.loan_amount,
        tenure_months=req.tenure_months,
        readiness_score=result["readiness_score"],
        estimated_amount=result["estimated_amount_max"],
        estimated_rate=result["estimated_rate_min"],
        score_breakdown=result["score_breakdown"],
    )
    db.add(check)
    await db.commit()

    logger.info(f"📊 Readiness check: score={result['readiness_score']}, likely_approved={result['likely_approved']}")

    return ReadinessResponse(**result)
