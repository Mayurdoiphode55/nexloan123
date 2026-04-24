"""
NexLoan Tracking Router — Application Status Timeline
Endpoints: /api/tracking/{loan_id}/milestones, /api/tracking/{loan_id}/documents
Provides borrower-facing timeline and document verification status.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, LoanMilestone, DocumentStatusRecord, User
from app.utils.database import get_db
from app.utils.auth import get_current_user

logger = logging.getLogger("nexloan.tracking")

router = APIRouter()


def _get_estimated_timeline(loan_status: str) -> str:
    """Return an estimated timeline message based on current loan status."""
    estimates = {
        "INQUIRY": "Documents will be verified by AI. Usually takes under 2 minutes.",
        "KYC_PENDING": "Documents are being verified by AI. Usually takes under 2 minutes.",
        "KYC_VERIFIED": "KYC verified. Underwriting will be run next.",
        "UNDERWRITING": "AI underwriting in progress. Results in under a minute.",
        "APPROVED": "Loan approved! Disbursement expected within 24 hours.",
        "COUNTER_OFFERED": "A modified offer is available for your review.",
        "REJECTED": "Application was not approved at this time.",
        "DISBURSED": "Funds have been transferred to your account.",
        "ACTIVE": "Loan is active. EMI payments are in progress.",
        "PRE_CLOSED": "Loan has been pre-closed.",
        "CLOSED": "Loan fully closed. No dues remaining. 🎉",
    }
    return estimates.get(loan_status, "Processing your application.")


@router.get(
    "/{loan_id}/milestones",
    summary="Get loan application milestones timeline",
)
async def get_milestones(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the milestone timeline for a loan.
    Borrowers can only see their own loans.
    Officers/Admins can see any loan.
    """
    # Check access
    user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'
    if user_role == "BORROWER":
        stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    else:
        stmt = select(Loan).where(Loan.id == loan_id)

    result = await db.execute(stmt)
    loan = result.scalar_one_or_none()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Fetch milestones
    ms_stmt = select(LoanMilestone).where(
        LoanMilestone.loan_id == loan_id
    ).order_by(LoanMilestone.created_at.asc())
    ms_result = await db.execute(ms_stmt)
    milestones = ms_result.scalars().all()

    return {
        "loan_id": str(loan.id),
        "loan_number": loan.loan_number,
        "current_status": loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
        "estimated_timeline": _get_estimated_timeline(
            loan.status.value if hasattr(loan.status, 'value') else str(loan.status)
        ),
        "milestones": [
            {
                "id": str(ms.id),
                "milestone": ms.milestone,
                "description": ms.description,
                "status": ms.status,
                "completed_at": ms.completed_at.isoformat() if ms.completed_at else None,
            }
            for ms in milestones
        ],
    }


@router.get(
    "/{loan_id}/documents",
    summary="Get document verification statuses",
)
async def get_document_statuses(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the verification status of KYC documents for a loan.
    """
    # Check access
    user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'
    if user_role == "BORROWER":
        stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    else:
        stmt = select(Loan).where(Loan.id == loan_id)

    result = await db.execute(stmt)
    loan = result.scalar_one_or_none()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Fetch document statuses
    doc_stmt = select(DocumentStatusRecord).where(
        DocumentStatusRecord.loan_id == loan_id
    )
    doc_result = await db.execute(doc_stmt)
    docs = doc_result.scalars().all()

    return {
        "loan_id": str(loan.id),
        "documents": [
            {
                "document_type": doc.document_type,
                "status": doc.status,
                "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
                "notes": doc.notes,
            }
            for doc in docs
        ],
    }
