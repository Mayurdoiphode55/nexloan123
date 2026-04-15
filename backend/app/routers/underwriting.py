"""
NexLoan Underwriting Router
Endpoints for automated decision engine.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.models.loan import User
from app.services.underwriting_engine import evaluate_loan

logger = logging.getLogger("nexloan.underwriting")

router = APIRouter()


class UnderwritingResponse(BaseModel):
    loan_id: str
    status: str
    credit_score: int
    dti_ratio: float
    interest_rate: float | None = None
    approved_amount: float | None = None
    rejection_reason: str | None = None


@router.post(
    "/{loan_id}/evaluate",
    response_model=UnderwritingResponse,
    summary="Trigger the automated underwriting engine for a loan (Phase 4)",
)
async def trigger_evaluation(
    loan_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Evaluates a loan based on credit score, DTI, and internal policies.
    This would normally be triggered asynchronously by an admin or scheduled worker, 
    but for this prototype, we trigger it via an API call.
    """
    try:
        result = await evaluate_loan(db, loan_id, str(current_user.id), background_tasks)
        return result
    except ValueError as e:
        logger.warning(f"Validation error during underwriting: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to evaluate loan {loan_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during underwriting evaluation."
        )
