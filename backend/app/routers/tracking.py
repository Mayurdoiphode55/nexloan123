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


# ─── Timeline Endpoint (for LoanTimeline component) ─────────────────────────

# Ordered milestones with which status marks them as complete
MILESTONE_DEFS = [
    {"key": "inquiry_created", "label": "Inquiry Created", "after_status": "INQUIRY"},
    {"key": "kyc_uploaded", "label": "KYC Documents Uploaded", "after_status": "KYC_PENDING"},
    {"key": "kyc_verified", "label": "AI KYC Verification", "after_status": "KYC_VERIFIED"},
    {"key": "underwriting", "label": "Credit Assessment", "after_status": "UNDERWRITING"},
    {"key": "decision", "label": "Loan Decision", "after_status": "APPROVED"},
    {"key": "disbursed", "label": "Disbursement", "after_status": "DISBURSED"},
    {"key": "repayment", "label": "Repayment Started", "after_status": "ACTIVE"},
    {"key": "closed", "label": "Loan Closed", "after_status": "CLOSED"},
]

STATUS_ORDER = [
    "INQUIRY", "APPLICATION", "KYC_PENDING", "KYC_VERIFIED", "UNDERWRITING",
    "APPROVED", "COUNTER_OFFERED", "REJECTED", "DISBURSED", "ACTIVE",
    "PRE_CLOSED", "CLOSED"
]


@router.get(
    "/{loan_id}/timeline",
    summary="Get visual milestone timeline for the loan tracker UI",
)
async def get_timeline(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns a milestone timeline suitable for the LoanTimeline component.
    Maps the loan's current status to a visual progress tracker.
    """
    from sqlalchemy import text

    user_id = str(current_user["id"]) if isinstance(current_user, dict) else str(current_user.id)
    user_role = current_user.get("role", "BORROWER") if isinstance(current_user, dict) else getattr(current_user, "role", "BORROWER")

    # Fetch loan
    if user_role == "BORROWER":
        row = (await db.execute(text(
            "SELECT id, loan_number, status, credit_score, approved_amount, interest_rate, "
            "emi_amount, created_at, updated_at, disbursed_at, closed_at "
            "FROM loans WHERE id = :lid AND user_id = :uid"
        ), {"lid": loan_id, "uid": user_id})).mappings().first()
    else:
        row = (await db.execute(text(
            "SELECT id, loan_number, status, credit_score, approved_amount, interest_rate, "
            "emi_amount, created_at, updated_at, disbursed_at, closed_at "
            "FROM loans WHERE id = :lid"
        ), {"lid": loan_id})).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Loan not found")

    current_status = row["status"]
    if hasattr(current_status, "value"):
        current_status = current_status.value

    current_idx = STATUS_ORDER.index(current_status) if current_status in STATUS_ORDER else 0

    # Get audit log timestamps
    audit_rows = (await db.execute(text(
        "SELECT action, to_status, created_at FROM audit_logs WHERE loan_id = :lid ORDER BY created_at ASC"
    ), {"lid": loan_id})).mappings().all()

    status_timestamps = {}
    for a in audit_rows:
        ts = a.get("to_status") or a.get("action", "")
        if ts and ts not in status_timestamps:
            status_timestamps[ts] = a["created_at"]

    # Check for first paid EMI
    first_paid = (await db.execute(text(
        "SELECT paid_at FROM emi_schedule WHERE loan_id = :lid AND status = 'PAID' ORDER BY installment_no LIMIT 1"
    ), {"lid": loan_id})).mappings().first()

    # Get next unpaid EMI for estimated date
    next_emi = (await db.execute(text(
        "SELECT due_date FROM emi_schedule WHERE loan_id = :lid AND status = 'PENDING' ORDER BY installment_no LIMIT 1"
    ), {"lid": loan_id})).mappings().first()

    # Build milestones
    milestones = []
    for mdef in MILESTONE_DEFS:
        ms_status_idx = STATUS_ORDER.index(mdef["after_status"]) if mdef["after_status"] in STATUS_ORDER else 99

        # Handle special cases
        if mdef["key"] == "decision" and current_status in ("REJECTED", "COUNTER_OFFERED"):
            ms_status_idx = current_idx  # mark as completed

        if ms_status_idx < current_idx or (ms_status_idx == current_idx and mdef["after_status"] == current_status):
            status = "completed"
        elif ms_status_idx == current_idx + 1 or (ms_status_idx == current_idx and mdef["after_status"] != current_status):
            status = "current"
        else:
            status = "upcoming"

        # Get timestamp
        ts = status_timestamps.get(mdef["after_status"])
        if mdef["key"] == "inquiry_created":
            ts = ts or row["created_at"]
        elif mdef["key"] == "disbursed" and row.get("disbursed_at"):
            ts = row["disbursed_at"]
        elif mdef["key"] == "repayment" and first_paid:
            ts = first_paid["paid_at"]
        elif mdef["key"] == "closed" and row.get("closed_at"):
            ts = row["closed_at"]

        # Detail text
        detail = None
        if mdef["key"] == "underwriting" and row.get("credit_score") and status == "completed":
            detail = f"Credit Score: {row['credit_score']}"
        elif mdef["key"] == "decision" and status == "completed":
            if current_status == "REJECTED":
                detail = "Application not approved"
            elif row.get("approved_amount"):
                detail = f"₹{row['approved_amount']:,.0f} @ {row.get('interest_rate', 0)}%"
        elif mdef["key"] == "disbursed" and status == "completed" and row.get("approved_amount"):
            detail = f"₹{row['approved_amount']:,.0f} disbursed"

        estimated_date = None
        if mdef["key"] == "repayment" and status == "upcoming" and next_emi:
            estimated_date = next_emi["due_date"].isoformat() if next_emi["due_date"] else None

        milestones.append({
            "key": mdef["key"],
            "label": mdef["label"],
            "status": status,
            "timestamp": ts.isoformat() if ts else None,
            "detail": detail,
            "estimated_date": estimated_date,
        })

    # Calculate progress percentage
    completed_count = sum(1 for m in milestones if m["status"] == "completed")
    progress = int((completed_count / len(milestones)) * 100)

    return {
        "loan_id": str(row["id"]),
        "loan_number": row["loan_number"],
        "progress_percent": progress,
        "milestones": milestones,
    }
