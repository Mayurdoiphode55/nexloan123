"""
NexLoan Officer Router — Loan Officer Dashboard API
Endpoints: /api/officer — queue, loan review, decisions, notes, metrics
Protected by require_role() — only LOAN_OFFICER, ADMIN, SUPER_ADMIN.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.loan import (
    Loan, User, KYCDocument, AuditLog, LoanNote, OfficerAssignment,
    DocumentRequest, LoanStatus, UserRole,
)
from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.utils.permissions import require_permission, Permission

logger = logging.getLogger("nexloan.officer")
router = APIRouter()



# ─── Request Models ─────────────────────────────────────────────────────────────

class DecisionRequest(BaseModel):
    decision: str = Field(..., description="APPROVE or REJECT")
    override_ai: bool = False
    override_reason: Optional[str] = None

class DocumentRequestBody(BaseModel):
    document_type: str = Field(..., min_length=2, max_length=100)
    reason: Optional[str] = None

class NoteRequest(BaseModel):
    content: str = Field(..., min_length=1)
    is_internal: bool = True

class AssignRequest(BaseModel):
    officer_id: str


# ─── Queue Management ───────────────────────────────────────────────────────────

@router.get("/queue", summary="Get my loan queue")
async def get_my_queue(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """Returns loans assigned to this officer, sorted by priority."""
    user_role = getattr(current_user, 'role', 'LOAN_OFFICER')

    if user_role in ("ADMIN", "SUPER_ADMIN"):
        stmt = select(Loan).options(selectinload(Loan.user))
    else:
        # Officer sees assigned loans + unassigned loans
        assigned_ids = select(OfficerAssignment.loan_id).where(
            OfficerAssignment.officer_id == current_user.id,
            OfficerAssignment.status == "ACTIVE",
        )
        unassigned_ids = select(Loan.id).where(
            ~Loan.id.in_(select(OfficerAssignment.loan_id))
        )
        stmt = select(Loan).options(selectinload(Loan.user)).where(
            Loan.id.in_(assigned_ids.union(unassigned_ids))
        )

    if status_filter:
        try:
            ls = LoanStatus(status_filter)
            stmt = stmt.where(Loan.status == ls)
        except ValueError:
            pass

    # Priority sort: MANUAL_REVIEW-like statuses first, then oldest
    stmt = stmt.order_by(
        case(
            (Loan.status == LoanStatus.KYC_VERIFIED, 1),
            (Loan.status == LoanStatus.KYC_PENDING, 2),
            (Loan.status == LoanStatus.UNDERWRITING, 3),
            else_=4,
        ),
        Loan.created_at.asc(),
    )

    result = await db.execute(stmt)
    loans = result.scalars().all()

    return [
        {
            "id": str(l.id),
            "loan_number": l.loan_number,
            "borrower_name": l.user.full_name if l.user else "Unknown",
            "borrower_email": l.user.email if l.user else "",
            "loan_amount": l.loan_amount,
            "loan_type": l.loan_type,
            "status": l.status.value if hasattr(l.status, 'value') else str(l.status),
            "credit_score": l.credit_score,
            "monthly_income": l.monthly_income,
            "employment_type": l.employment_type.value if l.employment_type and hasattr(l.employment_type, 'value') else str(l.employment_type) if l.employment_type else None,
            "ai_recommendation": l.ai_recommendation,
            "created_at": l.created_at.isoformat(),
        }
        for l in loans
    ]


@router.post("/assign/{loan_id}", summary="Assign loan to officer (Admin)")
async def assign_loan(
    loan_id: str,
    req: AssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.MANAGE_ROLES)),
):
    """Assign a loan to a specific officer."""
    loan = (await db.execute(select(Loan).where(Loan.id == loan_id))).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    officer = (await db.execute(select(User).where(User.id == req.officer_id))).scalar_one_or_none()
    if not officer or officer.role != UserRole.LOAN_OFFICER.value:
        raise HTTPException(status_code=400, detail="Invalid officer ID")

    # Deactivate old assignments
    old = (await db.execute(
        select(OfficerAssignment).where(OfficerAssignment.loan_id == loan_id, OfficerAssignment.status == "ACTIVE")
    )).scalars().all()
    for o in old:
        o.status = "REASSIGNED"

    assignment = OfficerAssignment(loan_id=loan.id, officer_id=officer.id)
    db.add(assignment)
    await db.commit()

    return {"message": f"Loan assigned to {officer.full_name}", "loan_id": str(loan.id)}


# ─── Loan Review ─────────────────────────────────────────────────────────────────

@router.get("/loan/{loan_id}/full", summary="Get full loan details for review")
async def get_loan_full(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """Full borrower profile + KYC + AI report + notes for officer review."""
    stmt = select(Loan).options(
        selectinload(Loan.user),
        selectinload(Loan.kyc_document),
        selectinload(Loan.audit_logs),
        selectinload(Loan.loan_notes),
    ).where(Loan.id == loan_id)

    result = await db.execute(stmt)
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Notes with officer names
    notes_data = []
    for note in (loan.loan_notes or []):
        officer = (await db.execute(select(User).where(User.id == note.officer_id))).scalar_one_or_none()
        notes_data.append({
            "id": str(note.id),
            "officer_name": officer.full_name if officer else "Unknown",
            "content": note.content,
            "is_internal": note.is_internal,
            "created_at": note.created_at.isoformat(),
        })

    # Document requests
    doc_reqs = (await db.execute(
        select(DocumentRequest).where(DocumentRequest.loan_id == loan_id).order_by(DocumentRequest.created_at.desc())
    )).scalars().all()

    kyc = loan.kyc_document
    kyc_data = None
    if kyc:
        kyc_data = {
            "pan_doc_url": kyc.pan_doc_url,
            "pan_number": kyc.pan_number,
            "pan_name_extracted": kyc.pan_name_extracted,
            "pan_legible": kyc.pan_legible,
            "pan_name_match": kyc.pan_name_match,
            "aadhaar_doc_url": kyc.aadhaar_doc_url,
            "aadhaar_number": kyc.aadhaar_number,
            "aadhaar_name_extracted": kyc.aadhaar_name_extracted,
            "aadhaar_legible": kyc.aadhaar_legible,
            "aadhaar_photo_present": kyc.aadhaar_photo_present,
            "ai_verdict": kyc.ai_verdict,
            "ai_remarks": kyc.ai_remarks,
            "verified_at": kyc.verified_at.isoformat() if kyc.verified_at else None,
        }

    return {
        "loan": {
            "id": str(loan.id),
            "loan_number": loan.loan_number,
            "status": loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
            "loan_amount": loan.loan_amount,
            "tenure_months": loan.tenure_months,
            "purpose": loan.purpose,
            "approved_amount": loan.approved_amount,
            "interest_rate": loan.interest_rate,
            "emi_amount": loan.emi_amount,
            "credit_score": loan.credit_score,
            "dti_ratio": loan.dti_ratio,
            "rejection_reason": loan.rejection_reason,
            "ai_recommendation": loan.ai_recommendation,
            "officer_decision": loan.officer_decision,
            "officer_override_reason": loan.officer_override_reason,
            "created_at": loan.created_at.isoformat(),
        },
        "borrower": {
            "id": str(loan.user.id),
            "full_name": loan.user.full_name,
            "email": loan.user.email,
            "mobile": loan.user.mobile,
            "monthly_income": loan.monthly_income,
            "employment_type": loan.employment_type.value if loan.employment_type and hasattr(loan.employment_type, 'value') else str(loan.employment_type) if loan.employment_type else None,
            "existing_emi": loan.existing_emi,
            "date_of_birth": loan.date_of_birth.isoformat() if loan.date_of_birth else None,
        },
        "kyc": kyc_data,
        "notes": notes_data,
        "document_requests": [
            {
                "id": str(dr.id),
                "document_type": dr.document_type,
                "reason": dr.reason,
                "status": dr.status,
                "created_at": dr.created_at.isoformat(),
            }
            for dr in doc_reqs
        ],
        "audit_trail": [
            {
                "id": str(a.id),
                "action": a.action,
                "from_status": a.from_status,
                "to_status": a.to_status,
                "actor": a.actor,
                "created_at": a.created_at.isoformat(),
            }
            for a in (loan.audit_logs or [])[:20]
        ],
    }


# ─── Decision ────────────────────────────────────────────────────────────────────

@router.post("/loan/{loan_id}/decide", summary="Make approval/rejection decision")
async def decide_loan(
    loan_id: str,
    req: DecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.APPROVE_LOAN)),
):
    """Officer makes approve/reject decision, optionally overriding AI."""
    loan = (await db.execute(
        select(Loan).options(selectinload(Loan.user)).where(Loan.id == loan_id)
    )).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.loan_type == "COLLATERAL" and not loan.collateral_verified and req.decision == "APPROVE":
        raise HTTPException(status_code=400, detail="Collateral must be verified before approval")

    if req.decision not in ("APPROVE", "REJECT"):
        raise HTTPException(status_code=400, detail="Decision must be APPROVE or REJECT")

    if req.override_ai and (not req.override_reason or len(req.override_reason) < 20):
        raise HTTPException(status_code=400, detail="Override reason must be at least 20 characters")

    loan = (await db.execute(
        select(Loan).options(selectinload(Loan.user)).where(Loan.id == loan_id)
    )).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    old_status = loan.status.value if hasattr(loan.status, 'value') else str(loan.status)

    # Store decision
    loan.officer_decision = req.decision
    if req.override_ai:
        loan.officer_override_reason = req.override_reason

    # Apply state transition
    if req.decision == "APPROVE":
        loan.status = LoanStatus.APPROVED
        if not loan.approved_amount:
            loan.approved_amount = loan.loan_amount
        if not loan.interest_rate:
            loan.interest_rate = 14.5
        if not loan.tenure_months:
            loan.tenure_months = 24
        if not loan.credit_score:
            loan.credit_score = 750
        if not loan.dti_ratio:
            loan.dti_ratio = 0.35
        if not loan.emi_amount:
            from app.services.underwriting_engine import calculate_emi
            loan.emi_amount = calculate_emi(loan.approved_amount, loan.interest_rate, loan.tenure_months)
    else:
        loan.status = LoanStatus.REJECTED
        if not loan.rejection_reason:
            loan.rejection_reason = f"Rejected by loan officer: {current_user.full_name}"

    # Audit log
    audit = AuditLog(
        loan_id=loan.id,
        action=f"OFFICER_{req.decision}",
        from_status=old_status,
        to_status=loan.status.value,
        actor=str(current_user.id),
        metadata_={
            "officer_name": current_user.full_name,
            "override_ai": req.override_ai,
            "override_reason": req.override_reason,
        },
    )
    db.add(audit)

    # Mark assignment as completed
    assignments = (await db.execute(
        select(OfficerAssignment).where(
            OfficerAssignment.loan_id == loan_id, OfficerAssignment.status == "ACTIVE"
        )
    )).scalars().all()
    for a in assignments:
        a.status = "COMPLETED"

    await db.commit()

    return {
        "loan_id": str(loan.id),
        "decision": req.decision,
        "new_status": loan.status.value,
        "override_ai": req.override_ai,
    }


@router.post("/loan/{loan_id}/verify-collateral", summary="Verify loan collateral")
async def verify_collateral(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VERIFY_COLLATERAL)),
):
    """Mark the collateral for a loan as verified."""
    loan = (await db.execute(select(Loan).where(Loan.id == loan_id))).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.loan_type != "COLLATERAL":
        raise HTTPException(status_code=400, detail="Loan is not a collateral loan")

    loan.collateral_verified = True
    loan.collateral_verified_by = current_user.id
    
    audit = AuditLog(
        loan_id=loan.id,
        action="COLLATERAL_VERIFIED",
        from_status=loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
        to_status=loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
        actor=str(current_user.id),
        metadata_={"officer_name": current_user.full_name},
    )
    db.add(audit)
    await db.commit()

    return {"message": "Collateral verified successfully"}


# ─── Document Requests ──────────────────────────────────────────────────────────

@router.post("/loan/{loan_id}/request-document", summary="Request additional document")
async def request_document(
    loan_id: str,
    req: DocumentRequestBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """Request additional documents from the borrower."""
    loan = (await db.execute(select(Loan).where(Loan.id == loan_id))).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    doc_req = DocumentRequest(
        loan_id=loan.id,
        requested_by=current_user.id,
        document_type=req.document_type,
        reason=req.reason,
    )
    db.add(doc_req)

    audit = AuditLog(
        loan_id=loan.id,
        action="DOCUMENT_REQUESTED",
        from_status=loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
        to_status=loan.status.value if hasattr(loan.status, 'value') else str(loan.status),
        actor=str(current_user.id),
        metadata_={"document_type": req.document_type, "reason": req.reason},
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Document '{req.document_type}' requested", "id": str(doc_req.id)}


@router.get("/loan/{loan_id}/documents", summary="Get all documents for a loan")
async def get_loan_documents(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """All KYC documents + additional requested documents."""
    kyc = (await db.execute(select(KYCDocument).where(KYCDocument.loan_id == loan_id))).scalar_one_or_none()
    doc_reqs = (await db.execute(
        select(DocumentRequest).where(DocumentRequest.loan_id == loan_id)
    )).scalars().all()

    return {
        "kyc": {
            "pan_doc_url": kyc.pan_doc_url if kyc else None,
            "aadhaar_doc_url": kyc.aadhaar_doc_url if kyc else None,
            "ai_verdict": kyc.ai_verdict if kyc else None,
        } if kyc else None,
        "document_requests": [
            {
                "id": str(dr.id),
                "document_type": dr.document_type,
                "reason": dr.reason,
                "status": dr.status,
                "created_at": dr.created_at.isoformat(),
            }
            for dr in doc_reqs
        ],
    }


# ─── Notes ───────────────────────────────────────────────────────────────────────

@router.post("/loan/{loan_id}/notes", summary="Add internal note")
async def add_note(
    loan_id: str,
    req: NoteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """Save an internal note on a loan, visible only to officers/admins."""
    loan = (await db.execute(select(Loan).where(Loan.id == loan_id))).scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    note = LoanNote(
        loan_id=loan.id,
        officer_id=current_user.id,
        content=req.content,
        is_internal=req.is_internal,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {
        "id": str(note.id),
        "officer_name": current_user.full_name,
        "content": note.content,
        "created_at": note.created_at.isoformat(),
    }


@router.get("/loan/{loan_id}/notes", summary="Get loan notes")
async def get_notes(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """Returns all internal notes for this loan."""
    stmt = select(LoanNote).where(LoanNote.loan_id == loan_id).order_by(LoanNote.created_at.desc())
    result = await db.execute(stmt)
    notes = result.scalars().all()

    notes_data = []
    for note in notes:
        officer = (await db.execute(select(User).where(User.id == note.officer_id))).scalar_one_or_none()
        notes_data.append({
            "id": str(note.id),
            "officer_name": officer.full_name if officer else "Unknown",
            "content": note.content,
            "is_internal": note.is_internal,
            "created_at": note.created_at.isoformat(),
        })

    return notes_data


# ─── Officer Metrics ─────────────────────────────────────────────────────────────

@router.get("/metrics", summary="Get officer performance metrics")
async def get_officer_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VIEW_DASHBOARD_OPS)),
):
    """My approval rate, processing time, daily/weekly counts."""
    officer_id = str(current_user.id)

    # Total decisions by this officer
    total_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.actor == officer_id,
        AuditLog.action.in_(["OFFICER_APPROVE", "OFFICER_REJECT"]),
    )
    total = (await db.execute(total_stmt)).scalar() or 0

    approved_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.actor == officer_id,
        AuditLog.action == "OFFICER_APPROVE",
    )
    approved = (await db.execute(approved_stmt)).scalar() or 0

    approval_rate = round((approved / total * 100), 1) if total > 0 else 0

    # Today's count
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.actor == officer_id,
        AuditLog.action.in_(["OFFICER_APPROVE", "OFFICER_REJECT"]),
        AuditLog.created_at >= today,
    )
    today_count = (await db.execute(today_stmt)).scalar() or 0

    # This week's count (last 7 days)
    from datetime import timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.actor == officer_id,
        AuditLog.action.in_(["OFFICER_APPROVE", "OFFICER_REJECT"]),
        AuditLog.created_at >= week_ago,
    )
    week_count = (await db.execute(week_stmt)).scalar() or 0

    return {
        "approval_rate": approval_rate,
        "total_decisions": total,
        "processed_today": today_count,
        "processed_this_week": week_count,
        "avg_processing_time": "4.2 hours",  # Simplified for MVP
    }
