"""
NexLoan Documents Router — PDF download endpoints
Generates and serves: EMI Statement, Interest Certificate, Sanction Letter.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.auth import get_current_user
from app.services.pdf_service import (
    generate_pdf, emi_statement_html, interest_certificate_html, sanction_letter_html
)

logger = logging.getLogger("nexloan.documents")

router = APIRouter()


@router.get("/{loan_id}/statement/pdf")
async def download_emi_statement(
    loan_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download EMI payment statement as PDF."""
    user_id = str(current_user["id"])

    # Get loan details
    loan = (await db.execute(text("""
        SELECT l.id, l.loan_number, l.loan_amount, l.interest_rate, l.tenure_months, l.user_id,
               u.full_name
        FROM loans l JOIN users u ON u.id = l.user_id
        WHERE l.id = :lid
    """), {"lid": loan_id})).mappings().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Check access: borrower can only see their own, officer/admin can see all
    role = current_user.get("role", "BORROWER")
    if role == "BORROWER" and str(loan["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get EMI schedule
    emis = (await db.execute(text("""
        SELECT installment_no, due_date, emi_amount, principal, interest, outstanding_balance, status, paid_at
        FROM emi_schedule WHERE loan_id = :lid ORDER BY installment_no
    """), {"lid": loan_id})).mappings().all()

    if not emis:
        raise HTTPException(status_code=404, detail="No EMI schedule found for this loan")

    installments = [dict(e) for e in emis]

    html = emi_statement_html(
        user_name=loan["full_name"],
        loan_number=loan["loan_number"],
        loan_amount=loan["loan_amount"] or 0,
        interest_rate=loan["interest_rate"] or 0,
        tenure_months=loan["tenure_months"] or 0,
        installments=installments,
        generated_date=datetime.utcnow().strftime("%d %B %Y"),
    )

    pdf_bytes = generate_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=statement_{loan['loan_number']}.pdf"},
    )


@router.get("/{loan_id}/interest-certificate/pdf")
async def download_interest_certificate(
    loan_id: str,
    financial_year: str = Query("2025-26", description="e.g., 2025-26"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download interest certificate for tax purposes (Section 24)."""
    user_id = str(current_user["id"])

    loan = (await db.execute(text("""
        SELECT l.id, l.loan_number, l.loan_amount, l.interest_rate, l.user_id,
               u.full_name
        FROM loans l JOIN users u ON u.id = l.user_id
        WHERE l.id = :lid
    """), {"lid": loan_id})).mappings().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    role = current_user.get("role", "BORROWER")
    if role == "BORROWER" and str(loan["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Parse financial year (e.g., "2025-26" → Apr 2025 to Mar 2026)
    try:
        start_year = int(financial_year.split("-")[0])
        fy_start = f"{start_year}-04-01"
        fy_end = f"{start_year + 1}-03-31"
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid financial year format. Use: 2025-26")

    # Sum interest for paid EMIs in the FY
    result = await db.execute(text("""
        SELECT COALESCE(SUM(interest), 0) as total_interest
        FROM emi_schedule
        WHERE loan_id = :lid AND status = 'PAID'
          AND paid_at >= :fy_start AND paid_at <= :fy_end
    """), {"lid": loan_id, "fy_start": fy_start, "fy_end": fy_end})
    total_interest = result.scalar() or 0

    html = interest_certificate_html(
        user_name=loan["full_name"],
        loan_number=loan["loan_number"],
        financial_year=financial_year,
        total_interest=total_interest,
        loan_amount=loan["loan_amount"] or 0,
        interest_rate=loan["interest_rate"] or 0,
        generated_date=datetime.utcnow().strftime("%d %B %Y"),
    )

    pdf_bytes = generate_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=interest_cert_{loan['loan_number']}_{financial_year}.pdf"},
    )


@router.get("/{loan_id}/sanction-letter/pdf")
async def download_sanction_letter(
    loan_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download loan sanction letter PDF."""
    user_id = str(current_user["id"])

    loan = (await db.execute(text("""
        SELECT l.id, l.loan_number, l.loan_amount, l.approved_amount, l.interest_rate,
               l.tenure_months, l.emi_amount, l.user_id, l.updated_at,
               u.full_name
        FROM loans l JOIN users u ON u.id = l.user_id
        WHERE l.id = :lid AND l.status IN ('APPROVED', 'DISBURSED', 'ACTIVE', 'COUNTER_OFFERED', 'PRE_CLOSED', 'CLOSED')
    """), {"lid": loan_id})).mappings().first()

    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found or not yet approved")

    role = current_user.get("role", "BORROWER")
    if role == "BORROWER" and str(loan["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    approved_amount = loan["approved_amount"] or loan["loan_amount"] or 0
    approved_date = loan["updated_at"].strftime("%d %B %Y") if loan["updated_at"] else "—"

    html = sanction_letter_html(
        user_name=loan["full_name"],
        loan_number=loan["loan_number"],
        loan_amount=approved_amount,
        interest_rate=loan["interest_rate"] or 0,
        tenure_months=loan["tenure_months"] or 0,
        emi_amount=loan["emi_amount"] or 0,
        approved_date=approved_date,
        generated_date=datetime.utcnow().strftime("%d %B %Y"),
    )

    pdf_bytes = generate_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=sanction_{loan['loan_number']}.pdf"},
    )
