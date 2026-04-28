"""
NexLoan Application Router — Loan Inquiry and KYC Upload
Endpoints: /inquiry, /{loan_id}/upload-kyc, /{loan_id}, /my-loans
"""

import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel, condecimal, constr
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, LoanStatus, EmploymentType, KYCDocument, AuditLog, User
from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.services.storage import upload_document
from app.ai.kyc_pipeline import run_kyc_pipeline
from app.services.milestone_service import create_initial_milestones, advance_milestone, update_document_status

logger = logging.getLogger("nexloan.application")

router = APIRouter()

# ─── Request/Response Models ────────────────────────────────────────────────────

class InquiryRequest(BaseModel):
    loan_amount: float
    tenure_months: int
    purpose: str
    monthly_income: float
    employment_type: EmploymentType
    existing_emi: float = 0.0
    date_of_birth: datetime
    gender: Optional[str] = None


class InquiryResponse(BaseModel):
    loan_id: str
    loan_number: str
    message: str


class KYCUploadResponse(BaseModel):
    loan_id: str
    verdict: str
    remarks: str


# ─── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "/inquiry",
    response_model=InquiryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new loan inquiry (Step 1)",
)
async def create_inquiry(
    req: InquiryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new loan application in INQUIRY state. 
    Rejects if the user already has an ACTIVE loan.
    """
    # Check for active loans
    stmt = select(Loan).where(
        Loan.user_id == current_user.id,
        Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED])
    )
    result = await db.execute(stmt)
    active_loan = result.scalars().first()
    
    if active_loan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active loan. Only one active loan is allowed."
        )

    # Generate loan number NL-YYYY-NNNNN
    year = datetime.utcnow().year
    # Get count of loans this year to generate number
    count_stmt = select(Loan).where(Loan.loan_number.like(f"NL-{year}-%"))
    result = await db.execute(count_stmt)
    loans_this_year = len(result.scalars().all())
    loan_number = f"NL-{year}-{(loans_this_year + 1):05d}"

    # Create Loan
    new_loan = Loan(
        user_id=current_user.id,
        loan_number=loan_number,
        status=LoanStatus.INQUIRY,
        loan_amount=req.loan_amount,
        tenure_months=req.tenure_months,
        purpose=req.purpose,
        monthly_income=req.monthly_income,
        employment_type=req.employment_type,
        existing_emi=req.existing_emi,
        date_of_birth=req.date_of_birth.replace(tzinfo=None),
        gender=req.gender,
    )
    
    db.add(new_loan)
    await db.flush() # flush to get loan ID
    
    # Audit log
    audit = AuditLog(
        loan_id=new_loan.id,
        action="INQUIRY_CREATED",
        from_status=None,
        to_status=LoanStatus.INQUIRY.value,
        actor=str(current_user.id)
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(new_loan)
    
    logger.info(f"✅ Loan Inquiry {loan_number} created for user {current_user.email}")
    
    # Create application tracking milestones
    await create_initial_milestones(new_loan.id, db)
    await db.commit()
    
    return InquiryResponse(
        loan_id=str(new_loan.id),
        loan_number=new_loan.loan_number,
        message="Loan inquiry created successfully. Please proceed to KYC upload."
    )


@router.post(
    "/{loan_id}/upload-kyc",
    response_model=KYCUploadResponse,
    summary="Upload PAN & Aadhaar and run AI verification (Step 2)",
)
async def upload_kyc(
    loan_id: str,
    pan_card: UploadFile = File(...),
    aadhaar_card: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts PAN and Aadhaar images, uploads to Cloudflare R2, 
    and triggers local Tesseract OCR checks for completeness and name match.
    """
    # Fetch loan
    stmt = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    # Allow upload from INQUIRY (first attempt) or KYC_PENDING (retry after partial failure)
    if loan.status not in (LoanStatus.INQUIRY, LoanStatus.KYC_PENDING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload KYC for loan in {loan.status.value} status.",
        )

    # 1. Upload to R2
    try:
        logger.info(f"Uploading documents for loan {loan.loan_number}...")
        
        # Read PAN bytes for OCR
        pan_bytes = await pan_card.read()
        await pan_card.seek(0)
        pan_url = await upload_document(pan_card, folder=str(loan_id))
        
        # Read Aadhaar bytes for OCR
        aadhaar_bytes = await aadhaar_card.read()
        await aadhaar_card.seek(0)
        aadhaar_url = await upload_document(aadhaar_card, folder=str(loan_id))
        
    except Exception as e:
        logger.error(f"Failed to upload documents to R2: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload documents. Please try again.")

    # 2. AI Document Checks — 4-Layer Pipeline Orchestrator
    try:
        logger.info(f"🚀 Running 4-Layer KYC Pipeline for {loan.loan_number}...")
        pipeline_result = await run_kyc_pipeline(pan_bytes, aadhaar_bytes, current_user.full_name)
    except Exception as e:
        logger.error(f"❌ KYC Pipeline crashed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI pipeline error: {str(e)}")

    final_verdict = pipeline_result["final_verdict"]
    pan_result = pipeline_result["pan_result"]
    aadhaar_result = pipeline_result["aadhaar_result"]
    remarks = pipeline_result["ai_remarks"]

    pan_name = pan_result.get("name_extracted", "")
    aadhaar_name = aadhaar_result.get("name_extracted", "")

    new_status = LoanStatus.KYC_VERIFIED if final_verdict == "PASS" else LoanStatus.KYC_PENDING

    # 3. Save KYCDocument record (upsert — update if retry)
    try:
        existing_kyc = await db.execute(
            select(KYCDocument).where(KYCDocument.loan_id == loan.id)
        )
        kyc_doc = existing_kyc.scalar_one_or_none()

        if kyc_doc:
            # Update existing record on retry
            kyc_doc.pan_doc_url = pan_url
            kyc_doc.pan_number = pan_result.get("masked_doc_number") or pan_result.get("doc_number")
            kyc_doc.pan_name_extracted = pan_name
            kyc_doc.pan_legible = pan_result.get("is_legible", False)
            kyc_doc.pan_name_match = pan_result.get("name_matches_applicant", False)
            kyc_doc.aadhaar_doc_url = aadhaar_url
            kyc_doc.aadhaar_number = aadhaar_result.get("masked_doc_number") or aadhaar_result.get("doc_number")
            kyc_doc.aadhaar_name_extracted = aadhaar_name
            kyc_doc.aadhaar_legible = aadhaar_result.get("is_legible", False)
            kyc_doc.aadhaar_photo_present = aadhaar_result.get("photo_or_signature_present", False)
            kyc_doc.ai_verdict = final_verdict
            kyc_doc.ai_remarks = remarks
            kyc_doc.ai_raw_response = pipeline_result["ai_raw_response"]
            kyc_doc.verified_at = datetime.utcnow() if final_verdict == "PASS" else None
        else:
            # First attempt — insert new record
            kyc_doc = KYCDocument(
                loan_id=loan.id,
                pan_doc_url=pan_url,
                pan_number=pan_result.get("masked_doc_number") or pan_result.get("doc_number"),
                pan_name_extracted=pan_name,
                pan_legible=pan_result.get("is_legible", False),
                pan_name_match=pan_result.get("name_matches_applicant", False),
                aadhaar_doc_url=aadhaar_url,
                aadhaar_number=aadhaar_result.get("masked_doc_number") or aadhaar_result.get("doc_number"),
                aadhaar_name_extracted=aadhaar_name,
                aadhaar_legible=aadhaar_result.get("is_legible", False),
                aadhaar_photo_present=aadhaar_result.get("photo_or_signature_present", False),
                ai_verdict=final_verdict,
                ai_remarks=remarks,
                ai_raw_response=pipeline_result["ai_raw_response"],
                verified_at=datetime.utcnow() if final_verdict == "PASS" else None
            )
            db.add(kyc_doc)

        # 4. Update Loan Status & Audit
        old_status = loan.status
        loan.status = new_status

        audit = AuditLog(
            loan_id=loan.id,
            action="KYC_UPLOADED",
            from_status=old_status.value,
            to_status=new_status.value,
            actor=str(current_user.id),
            metadata_={"verdict": final_verdict, "layers_used": len(pipeline_result["ai_raw_response"].get("pan_layers", []))}
        )
        db.add(audit)

        await db.commit()

        # Advance milestone tracking
        doc_status = "VERIFIED" if final_verdict == "PASS" else "PENDING"
        await update_document_status(loan.id, "PAN", doc_status, db)
        await update_document_status(loan.id, "AADHAAR", doc_status, db)
        await advance_milestone(loan.id, "DOCUMENTS_UPLOADED", db)
        await db.commit()
    except Exception as e:
        logger.error(f"❌ Failed to save KYC result: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save verification result: {str(e)}")

    return KYCUploadResponse(
        loan_id=str(loan.id),
        verdict=final_verdict,
        remarks=remarks
    )


@router.get(
    "/my-loans",
    summary="Get all loans for authenticated user",
)
async def get_my_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns a list of all loans for the current user."""
    stmt = select(Loan).where(Loan.user_id == current_user.id).order_by(Loan.created_at.desc())
    result = await db.execute(stmt)
    loans = result.scalars().all()
    
    return loans


@router.get(
    "/{loan_id}",
    summary="Get full details of a specific loan",
)
async def get_loan_details(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns loan details along with KYC and EMI schedule."""
    stmt = select(Loan).options(
        selectinload(Loan.kyc_document),
        selectinload(Loan.emi_schedule)
    ).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
        
    return loan

@router.get(
    "/{loan_id}/audit-trail",
    summary="Get the audit trail for a specific loan",
)
async def get_loan_audit_trail(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns the timeline of status changes for a loan."""
    # Verify ownership
    stmt_loan = select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    result_loan = await db.execute(stmt_loan)
    if not result_loan.scalars().first():
        raise HTTPException(status_code=404, detail="Loan not found")

    stmt = select(AuditLog).where(AuditLog.loan_id == loan_id).order_by(AuditLog.created_at.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


import io
from fastapi.responses import Response

@router.get(
    "/{loan_id}/report",
    summary="Download a PDF report for the loan",
)
async def download_loan_report(
    loan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a PDF summary for the loan."""
    from fpdf import FPDF
    
    stmt = select(Loan).options(
        selectinload(Loan.emi_schedule)
    ).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Generate PDF
    pdf = FPDF()
    pdf.add_page()
    
    # Header
    pdf.set_font("helvetica", "B", 24)
    pdf.set_text_color(29, 78, 216) # Blue-700
    pdf.cell(0, 15, "NexLoan", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 12)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, "Personal Loan Summary Report", new_x="LMARGIN", new_y="NEXT")
    pdf.line(10, 35, 200, 35)
    pdf.ln(10)
    
    # Applicant details
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "Applicant Details", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 11)
    pdf.cell(50, 8, "Name:")
    pdf.cell(0, 8, current_user.full_name, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(50, 8, "Email:")
    pdf.cell(0, 8, current_user.email, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Loan details
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, "Loan Details", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 11)
    pdf.cell(50, 8, "Loan Number:")
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(0, 8, loan.loan_number, new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 11)
    pdf.cell(50, 8, "Status:")
    pdf.cell(0, 8, loan.status.value, new_x="LMARGIN", new_y="NEXT")
    
    pdf.cell(50, 8, "Approved Amount:")
    pdf.cell(0, 8, f"INR {loan.approved_amount or loan.loan_amount:,.2f}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.cell(50, 8, "Tenure:")
    pdf.cell(0, 8, f"{loan.tenure_months} months", new_x="LMARGIN", new_y="NEXT")
    
    if loan.interest_rate:
        pdf.cell(50, 8, "Interest Rate:")
        pdf.cell(0, 8, f"{loan.interest_rate}% p.a.", new_x="LMARGIN", new_y="NEXT")
        
    if loan.emi_amount:
        pdf.cell(50, 8, "Monthly EMI:")
        pdf.cell(0, 8, f"INR {loan.emi_amount:,.2f}", new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(10)
    
    # Status-specific content
    if loan.status == LoanStatus.CLOSED or loan.status == LoanStatus.PRE_CLOSED:
        pdf.set_font("helvetica", "B", 14)
        pdf.set_text_color(22, 163, 74) # Green-600
        pdf.cell(0, 10, "NO DUES CERTIFICATE", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(0, 0, 0)
        pdf.multi_cell(0, 8, f"This is to certify that the personal loan account {loan.loan_number} associated with {current_user.full_name} has been closed and there are no outstanding dues payable to NexLoan.")
    
    # Output
    pdf_bytes = pdf.output()
    
    headers = {
        'Content-Disposition': f'attachment; filename="NexLoan_Report_{loan.loan_number}.pdf"'
    }
    
    return Response(content=bytes(pdf_bytes), media_type="application/pdf", headers=headers)
