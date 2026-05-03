"""
NexLoan Loan Service Enquiry API — prompt4.md Phase 12
Public enquiry submission + admin queue management.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from datetime import datetime

from app.utils.database import AsyncSessionLocal
from app.utils.permissions import require_permission, Permission
from app.models.loan import LoanEnquiry, ServiceEnquiry, User

router = APIRouter()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ServiceEnquiryCreate(BaseModel):
    name: str
    email: str
    mobile: str
    loan_type_interest: Optional[str] = None
    loan_amount_range: Optional[str] = None
    message: Optional[str] = None


# ─── Public Submit (no auth required) ────────────────────────────────────────

@router.post("/submit")
async def submit_enquiry(data: ServiceEnquiryCreate):
    """Public endpoint — submit a loan service enquiry. No auth required."""
    async with AsyncSessionLocal() as db:
        enq = ServiceEnquiry(
            name=data.name,
            email=data.email,
            mobile=data.mobile,
            loan_type_interest=data.loan_type_interest,
            loan_amount_range=data.loan_amount_range,
            message=data.message,
            status="NEW",
        )
        db.add(enq)
        await db.commit()
        await db.refresh(enq)
        return {
            "message": "Enquiry submitted. Our team will contact you within 24 hours.",
            "enquiry_id": str(enq.id),
        }


# ─── Admin/Officer Endpoints ─────────────────────────────────────────────────

@router.get("/list")
async def list_service_enquiries(
    status: Optional[str] = None,
    page: int = 1,
    current_user=Depends(require_permission(Permission.ENQUIRY_MANAGE)),
):
    """Get paginated service enquiries (officer/admin)."""
    async with AsyncSessionLocal() as db:
        query = select(ServiceEnquiry).order_by(ServiceEnquiry.created_at.desc())
        if status:
            query = query.where(ServiceEnquiry.status == status)
        query = query.offset((page - 1) * 20).limit(20)
        result = await db.execute(query)
        enquiries = result.scalars().all()

        items = []
        for e in enquiries:
            officer_name = None
            if e.assigned_to:
                r = await db.execute(select(User.full_name).where(User.id == e.assigned_to))
                officer_name = r.scalar()
            items.append({
                "id": str(e.id),
                "name": e.name,
                "email": e.email,
                "mobile": e.mobile,
                "loan_type_interest": e.loan_type_interest,
                "loan_amount_range": e.loan_amount_range,
                "message": e.message,
                "status": e.status,
                "notes": e.notes,
                "assigned_to_name": officer_name,
                "created_at": e.created_at.isoformat(),
            })
        return items


@router.put("/{enquiry_id}/status")
async def update_enquiry_status(
    enquiry_id: str,
    body: dict,
    current_user=Depends(require_permission(Permission.ENQUIRY_MANAGE)),
):
    """Update enquiry status and add internal notes."""
    async with AsyncSessionLocal() as db:
        enq = (await db.execute(
            select(ServiceEnquiry).where(ServiceEnquiry.id == enquiry_id)
        )).scalar_one_or_none()
        if not enq:
            raise HTTPException(status_code=404, detail="Enquiry not found")
        if "status" in body:
            enq.status = body["status"]
        if "notes" in body:
            enq.notes = body["notes"]
        enq.updated_at = datetime.utcnow()
        await db.commit()
        return {"message": "Enquiry updated"}


# ─── Legacy: LoanEnquiry queue (kept for backward compat) ────────────────────

@router.get("/queue")
async def get_enquiry_queue(
    status_filter: Optional[str] = None,
    current_user=Depends(require_permission(Permission.ENQUIRY_MANAGE)),
):
    """Legacy endpoint — LoanEnquiry queue."""
    async with AsyncSessionLocal() as db:
        query = select(LoanEnquiry).order_by(LoanEnquiry.created_at.desc())
        if status_filter:
            query = query.where(LoanEnquiry.status == status_filter)
        result = await db.execute(query)
        enquiries = result.scalars().all()
        items = []
        for e in enquiries:
            officer_name = None
            if e.claimed_by:
                r = await db.execute(select(User.full_name).where(User.id == e.claimed_by))
                officer_name = r.scalar()
            items.append({
                "id": str(e.id),
                "full_name": e.full_name,
                "mobile": e.mobile,
                "email": e.email,
                "loan_type": e.loan_type,
                "approx_amount": e.approx_amount,
                "message": e.message,
                "status": e.status,
                "claimed_by_name": officer_name,
                "created_at": e.created_at.isoformat(),
            })
        return items


@router.post("/{enquiry_id}/claim")
async def claim_enquiry(
    enquiry_id: str,
    current_user=Depends(require_permission(Permission.ENQUIRY_MANAGE)),
):
    async with AsyncSessionLocal() as db:
        enquiry = (await db.execute(
            select(LoanEnquiry).where(LoanEnquiry.id == enquiry_id)
        )).scalar_one_or_none()
        if not enquiry:
            raise HTTPException(status_code=404, detail="Enquiry not found")
        if enquiry.status != "NEW":
            raise HTTPException(status_code=400, detail="Enquiry already claimed")
        enquiry.status = "CLAIMED"
        enquiry.claimed_by = current_user.id
        await db.commit()
        return {"message": "Enquiry claimed successfully"}


@router.post("/{enquiry_id}/convert")
async def convert_enquiry(
    enquiry_id: str,
    current_user=Depends(require_permission(Permission.ENQUIRY_MANAGE)),
):
    """Convert a ServiceEnquiry into a formal loan application."""
    async with AsyncSessionLocal() as db:
        enquiry = (await db.execute(
            select(ServiceEnquiry).where(ServiceEnquiry.id == enquiry_id)
        )).scalar_one_or_none()
        
        if not enquiry:
            raise HTTPException(status_code=404, detail="Enquiry not found")
        if enquiry.status == "CONVERTED":
            raise HTTPException(status_code=400, detail="Already converted")

        user = None
        if enquiry.email:
            user = (await db.execute(select(User).where(User.email == enquiry.email))).scalar_one_or_none()
        if not user and enquiry.mobile:
            user = (await db.execute(select(User).where(User.mobile == enquiry.mobile))).scalar_one_or_none()

        if not user:
            import uuid as _uuid
            user = User(
                id=_uuid.uuid4(),
                full_name=enquiry.name,
                email=enquiry.email or f"{enquiry.mobile}@placeholder.nexloan.in",
                mobile=enquiry.mobile,
                is_verified=False,
            )
            db.add(user)
            await db.flush()

        from app.models.loan import Loan, LoanStatus
        from sqlalchemy import func as sqlfunc
        import uuid as _uuid

        year = datetime.utcnow().year
        count = (await db.execute(select(sqlfunc.count(Loan.id)))).scalar() or 0
        loan_number = f"NL-{year}-{str(count + 1).zfill(5)}"

        # Try to parse loan_amount_range to an approx number
        approx_amount = 0
        if enquiry.loan_amount_range:
            # Extract the first number found in the string (e.g. "5L - 10L" -> 500000)
            import re
            numbers = re.findall(r'\d+', enquiry.loan_amount_range)
            if numbers:
                val = int(numbers[0])
                # If it's a small number like '5', it's probably '5L'
                if val < 100:
                    val = val * 100000
                approx_amount = val

        loan = Loan(
            id=_uuid.uuid4(),
            user_id=user.id,
            loan_number=loan_number,
            status=LoanStatus.INQUIRY,
            loan_amount=approx_amount if approx_amount > 0 else None,
            loan_type="NON_COLLATERAL",
        )
        db.add(loan)
        enquiry.status = "CONVERTED"
        # ServiceEnquiry doesn't have converted_loan_id field in model yet, so we just update status
        
        await db.commit()

        return {
            "message": "Converted to loan application",
            "loan_id": str(loan.id),
            "loan_number": loan_number,
        }
