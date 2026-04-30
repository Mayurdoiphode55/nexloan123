"""
NexLoan Statements Router — PDF statement generation.
Endpoints per prompt4.md Part 10.
"""
import logging
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.models.loan import Loan, LoanStatus, EMISchedule, PaymentStatus, User, TenantConfig
from app.config import settings

logger = logging.getLogger("nexloan.statements")
router = APIRouter()


def _get_tenant(db_sync=None):
    """Helper to get tenant config synchronously for PDF generation."""
    return None


async def _fetch_tenant(db: AsyncSession) -> Optional[TenantConfig]:
    result = await db.execute(
        select(TenantConfig).where(TenantConfig.tenant_id == settings.TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _fetch_loan(loan_id: str, user_id: str, db: AsyncSession) -> Loan:
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.user), selectinload(Loan.emi_schedule))
        .where(Loan.id == loan_id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if str(loan.user_id) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return loan


def _build_emi_pdf(loan: Loan, tenant: Optional[TenantConfig], from_date=None, to_date=None) -> bytes:
    """Generate EMI payment statement PDF using xhtml2pdf."""
    try:
        from xhtml2pdf import pisa
        import io

        primary = tenant.primary_color if tenant else "#4F46E5"
        client_name = tenant.client_name if tenant else "NexLoan"
        registered = tenant.registered_name if tenant else "Theoremlabs Pvt. Ltd."
        rbi = tenant.rbi_registration if tenant else ""

        paid_rows = [
            e for e in (loan.emi_schedule or [])
            if e.status == PaymentStatus.PAID
            and (from_date is None or (e.paid_at and e.paid_at.date() >= from_date))
            and (to_date is None or (e.paid_at and e.paid_at.date() <= to_date))
        ]

        rows_html = "".join(
            f"<tr>"
            f"<td>{e.installment_no}</td>"
            f"<td>{e.due_date.strftime('%d %b %Y') if e.due_date else '-'}</td>"
            f"<td>{e.paid_at.strftime('%d %b %Y') if e.paid_at else '-'}</td>"
            f"<td style='text-align:right'>₹{e.emi_amount:,.0f}</td>"
            f"<td style='text-align:right'>₹{e.principal:,.0f}</td>"
            f"<td style='text-align:right'>₹{e.interest:,.0f}</td>"
            f"<td style='text-align:right'>₹{e.outstanding_balance:,.0f}</td>"
            f"</tr>"
            for e in paid_rows
        )

        html = f"""
        <html><head><style>
        body {{ font-family: Arial; font-size: 11px; color: #111; }}
        .header {{ background: {primary}; color: white; padding: 20px; margin-bottom: 20px; }}
        .header h1 {{ font-size: 20px; margin: 0; }}
        .header p {{ margin: 4px 0 0; font-size: 12px; opacity: 0.85; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
        th {{ background: #F9FAFB; color: #6B7280; font-size: 10px; text-transform: uppercase;
              padding: 8px; border-bottom: 1px solid #E5E7EB; text-align: left; }}
        td {{ padding: 8px; border-bottom: 1px solid #F3F4F6; }}
        .footer {{ margin-top: 40px; font-size: 9px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 10px; }}
        .watermark {{ position: fixed; top: 45%; left: 20%; font-size: 60px; color: rgba(0,0,0,0.04);
                     transform: rotate(-45deg); font-weight: 700; letter-spacing: 4px; }}
        </style></head><body>
        <div class="watermark">OFFICIAL DOCUMENT</div>
        <div class="header">
          <h1>{client_name}</h1>
          <p>EMI Payment Statement — Loan {loan.loan_number}</p>
        </div>
        <p><strong>Borrower:</strong> {loan.user.full_name if loan.user else ''} &nbsp;|&nbsp;
           <strong>Loan Amount:</strong> ₹{loan.loan_amount:,.0f} &nbsp;|&nbsp;
           <strong>Generated:</strong> {datetime.utcnow().strftime('%d %b %Y')}</p>
        <table>
          <thead><tr>
            <th>No.</th><th>Due Date</th><th>Paid Date</th>
            <th>EMI</th><th>Principal</th><th>Interest</th><th>Balance</th>
          </tr></thead>
          <tbody>{rows_html}</tbody>
        </table>
        <div class="footer">
          {registered} {f'| RBI Reg: {rbi}' if rbi else ''} | Powered by NexLoan
        </div>
        </body></html>
        """

        buf = io.BytesIO()
        pisa.CreatePDF(html, dest=buf)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        return b""


def _build_interest_cert_pdf(loan: Loan, tenant: Optional[TenantConfig], fy: str) -> bytes:
    """Generate interest certificate PDF for income tax."""
    try:
        from xhtml2pdf import pisa
        import io

        primary = tenant.primary_color if tenant else "#4F46E5"
        client_name = tenant.client_name if tenant else "NexLoan"
        registered = tenant.registered_name if tenant else "Theoremlabs Pvt. Ltd."

        # Parse financial year e.g. "2025-26"
        fy_parts = fy.split("-")
        fy_start_year = int(fy_parts[0]) if fy_parts else datetime.utcnow().year
        fy_start = date(fy_start_year, 4, 1)
        fy_end = date(fy_start_year + 1, 3, 31)

        total_interest = sum(
            e.interest for e in (loan.emi_schedule or [])
            if e.status == PaymentStatus.PAID
            and e.paid_at and fy_start <= e.paid_at.date() <= fy_end
        )

        html = f"""
        <html><head><style>
        body {{ font-family: Arial; font-size: 11px; color: #111; }}
        .header {{ background: {primary}; color: white; padding: 20px; margin-bottom: 20px; }}
        .cert {{ border: 2px solid {primary}; padding: 30px; margin: 20px 0; }}
        .cert h2 {{ color: {primary}; font-size: 16px; }}
        .amount {{ font-size: 28px; font-weight: 700; color: {primary}; }}
        .footer {{ margin-top: 40px; font-size: 9px; color: #9CA3AF; }}
        .watermark {{ position: fixed; top: 45%; left: 20%; font-size: 60px; color: rgba(0,0,0,0.04);
                     transform: rotate(-45deg); font-weight: 700; }}
        </style></head><body>
        <div class="watermark">OFFICIAL DOCUMENT</div>
        <div class="header"><h1>{client_name}</h1>
          <p>Interest Certificate — F.Y. {fy}</p></div>
        <div class="cert">
          <h2>CERTIFICATE OF INTEREST PAID</h2>
          <p>This is to certify that <strong>{loan.user.full_name if loan.user else ''}</strong>
             has paid the following interest on Loan Account <strong>{loan.loan_number}</strong>
             during Financial Year <strong>{fy}</strong>:</p>
          <p>Total Interest Paid (April {fy_start_year} – March {fy_start_year+1}):</p>
          <p class="amount">₹{total_interest:,.2f}</p>
          <p style="margin-top:20px; font-size:10px; color:#6B7280;">
            This certificate is issued for the purpose of claiming deduction under Section 24(b)
            of the Income Tax Act, 1961.</p>
        </div>
        <p>Issued by: {registered}</p>
        <p>Date: {datetime.utcnow().strftime('%d %b %Y')}</p>
        <div class="footer">Powered by NexLoan</div>
        </body></html>
        """

        buf = io.BytesIO()
        pisa.CreatePDF(html, dest=buf)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"Interest cert PDF error: {e}")
        return b""


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/{loan_id}/emi-statement")
async def get_emi_statement(
    loan_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    token: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Download EMI payment statement as PDF."""
    from app.utils.auth import decode_token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    payload = decode_token(token)
    user_id = payload.get("sub")
    
    loan = await _fetch_loan(loan_id, str(user_id), db)
    tenant = await _fetch_tenant(db)

    fd = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else None
    td = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else None

    pdf = _build_emi_pdf(loan, tenant, fd, td)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="EMI_Statement_{loan.loan_number}.pdf"'},
    )


@router.get("/{loan_id}/interest-certificate")
async def get_interest_certificate(
    loan_id: str,
    financial_year: str = "2025-26",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download interest certificate PDF for income tax."""
    loan = await _fetch_loan(loan_id, str(current_user.id), db)
    tenant = await _fetch_tenant(db)
    pdf = _build_interest_cert_pdf(loan, tenant, financial_year)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Interest_Certificate_{loan.loan_number}_{financial_year}.pdf"'},
    )


@router.get("/{loan_id}/account-statement")
async def get_account_statement(
    loan_id: str,
    period: str = "monthly",
    month: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download account statement PDF."""
    loan = await _fetch_loan(loan_id, str(current_user.id), db)
    tenant = await _fetch_tenant(db)
    # Reuse EMI statement for now
    pdf = _build_emi_pdf(loan, tenant)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Account_Statement_{loan.loan_number}.pdf"'},
    )


class EmailStatementRequest(BaseModel):
    statement_type: str  # emi, interest, account
    period: Optional[str] = None
    email: str
    financial_year: Optional[str] = "2025-26"


@router.post("/{loan_id}/email-statement")
async def email_statement(
    loan_id: str,
    body: EmailStatementRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate PDF and send via email as attachment."""
    loan = await _fetch_loan(loan_id, str(current_user.id), db)
    tenant = await _fetch_tenant(db)

    if body.statement_type == "interest":
        pdf = _build_interest_cert_pdf(loan, tenant, body.financial_year or "2025-26")
        filename = f"Interest_Certificate_{loan.loan_number}.pdf"
        subject = f"Interest Certificate — {loan.loan_number}"
    else:
        pdf = _build_emi_pdf(loan, tenant)
        filename = f"EMI_Statement_{loan.loan_number}.pdf"
        subject = f"EMI Statement — {loan.loan_number}"

    try:
        from app.services.email_service import send_statement_email
        await send_statement_email(
            to_email=body.email,
            name=current_user.full_name,
            loan_number=loan.loan_number,
            subject=subject,
            pdf_bytes=pdf,
            filename=filename,
        )
    except Exception as e:
        logger.warning(f"Statement email failed: {e}")
        return {"message": f"Statement generated but email delivery failed: {str(e)[:80]}"}

    return {"message": f"Statement emailed to {body.email}"}
