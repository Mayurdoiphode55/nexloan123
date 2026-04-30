"""
NexLoan Statement Automation Service — Phase 2
Generates monthly and annual loan statements as PDFs.
Scheduled via APScheduler in main.py.
"""

import logging
from datetime import datetime, timedelta
from io import BytesIO
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import AsyncSessionLocal
from app.models.loan import Loan, LoanStatus, EMISchedule, PaymentStatus, User

logger = logging.getLogger("nexloan.statements")


async def generate_monthly_statements():
    """
    Runs on the 1st of each month at 6 AM.
    Generates a PDF statement for each ACTIVE loan and sends via email.
    """
    logger.info("📄 Starting monthly statement generation...")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Loan, User).join(User, Loan.user_id == User.id).where(
                Loan.status == LoanStatus.ACTIVE
            )
        )
        loans = result.all()

        if not loans:
            logger.info("No active loans found for monthly statements.")
            return

        now = datetime.utcnow()
        month_name = now.strftime("%B %Y")
        count = 0

        for loan, user in loans:
            try:
                pdf_bytes = await _generate_monthly_pdf(loan, user, db, month_name)
                # Send email with PDF attachment
                await _send_statement_email(
                    to_email=user.email,
                    name=user.full_name,
                    loan_number=loan.loan_number,
                    subject=f"Monthly Loan Statement — {month_name}",
                    pdf_bytes=pdf_bytes,
                    filename=f"Statement_{loan.loan_number}_{now.strftime('%Y_%m')}.pdf",
                )
                count += 1
            except Exception as e:
                logger.error(f"Failed to generate statement for {loan.loan_number}: {e}")

        logger.info(f"✅ Monthly statements sent: {count}/{len(loans)}")


async def generate_annual_statements():
    """
    Runs on April 1st at 6 AM.
    Generates annual statement + interest certificate for IT returns.
    """
    logger.info("📄 Starting annual statement generation...")

    async with AsyncSessionLocal() as db:
        # Include ACTIVE, CLOSED, PRE_CLOSED loans that had activity in the financial year
        fy_start = datetime(datetime.utcnow().year - 1, 4, 1)  # April 1 previous year
        fy_end = datetime(datetime.utcnow().year, 3, 31, 23, 59, 59)

        result = await db.execute(
            select(Loan, User).join(User, Loan.user_id == User.id).where(
                Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.CLOSED, LoanStatus.PRE_CLOSED]),
                Loan.created_at <= fy_end,
            )
        )
        loans = result.all()
        count = 0

        for loan, user in loans:
            try:
                pdf_bytes = await _generate_annual_pdf(loan, user, db, fy_start, fy_end)
                fy_label = f"FY {fy_start.year}-{fy_end.year}"
                await _send_statement_email(
                    to_email=user.email,
                    name=user.full_name,
                    loan_number=loan.loan_number,
                    subject=f"Annual Loan Statement & Interest Certificate — {fy_label}",
                    pdf_bytes=pdf_bytes,
                    filename=f"Annual_Statement_{loan.loan_number}_{fy_label}.pdf",
                )
                count += 1
            except Exception as e:
                logger.error(f"Failed annual statement for {loan.loan_number}: {e}")

        logger.info(f"✅ Annual statements sent: {count}/{len(loans)}")


async def _generate_monthly_pdf(loan, user, db: AsyncSession, month_name: str) -> bytes:
    """Generate monthly statement PDF using fpdf2."""
    from fpdf import FPDF

    # Fetch EMIs for the current month
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    emis = (await db.execute(
        select(EMISchedule).where(
            EMISchedule.loan_id == loan.id,
        ).order_by(EMISchedule.installment_no)
    )).scalars().all()

    pdf = FPDF()
    pdf.add_page()

    # Header
    pdf.set_font("helvetica", "B", 20)
    pdf.set_text_color(79, 70, 229)
    pdf.cell(0, 12, "NexLoan", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, f"Monthly Loan Statement — {month_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    # Borrower details
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(40, 7, "Borrower:")
    pdf.cell(0, 7, user.full_name, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(40, 7, "Loan Number:")
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, loan.loan_number, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.cell(40, 7, "Status:")
    pdf.cell(0, 7, loan.status.value, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(40, 7, "Outstanding:")
    outstanding = emis[-1].outstanding_balance if emis and emis[-1].outstanding_balance else 0
    pdf.cell(0, 7, f"INR {outstanding:,.2f}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # EMI table
    pdf.set_font("helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(15, 8, "#", border=1, fill=True)
    pdf.cell(30, 8, "Due Date", border=1, fill=True)
    pdf.cell(30, 8, "EMI", border=1, fill=True)
    pdf.cell(30, 8, "Principal", border=1, fill=True)
    pdf.cell(30, 8, "Interest", border=1, fill=True)
    pdf.cell(25, 8, "Status", border=1, fill=True)
    pdf.cell(30, 8, "Balance", border=1, fill=True, new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("helvetica", "", 8)
    for emi in emis:
        pdf.cell(15, 7, str(emi.installment_no), border=1)
        pdf.cell(30, 7, emi.due_date.strftime("%d %b %Y") if emi.due_date else "-", border=1)
        pdf.cell(30, 7, f"{emi.emi_amount:,.0f}", border=1)
        pdf.cell(30, 7, f"{emi.principal:,.0f}", border=1)
        pdf.cell(30, 7, f"{emi.interest:,.0f}", border=1)
        pdf.cell(25, 7, emi.status.value if hasattr(emi.status, 'value') else str(emi.status), border=1)
        pdf.cell(30, 7, f"{emi.outstanding_balance:,.0f}", border=1, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


async def _generate_annual_pdf(loan, user, db: AsyncSession, fy_start, fy_end) -> bytes:
    """Generate annual statement + interest certificate PDF."""
    from fpdf import FPDF

    emis = (await db.execute(
        select(EMISchedule).where(
            EMISchedule.loan_id == loan.id,
            EMISchedule.due_date >= fy_start,
            EMISchedule.due_date <= fy_end,
        ).order_by(EMISchedule.installment_no)
    )).scalars().all()

    total_paid = sum(e.paid_amount or 0 for e in emis if e.status == PaymentStatus.PAID)
    total_principal = sum(e.principal or 0 for e in emis if e.status == PaymentStatus.PAID)
    total_interest = sum(e.interest or 0 for e in emis if e.status == PaymentStatus.PAID)

    fy_label = f"FY {fy_start.year}-{fy_end.year}"

    pdf = FPDF()
    pdf.add_page()

    # Header
    pdf.set_font("helvetica", "B", 20)
    pdf.set_text_color(79, 70, 229)
    pdf.cell(0, 12, "NexLoan", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 8, f"Annual Statement & Interest Certificate — {fy_label}", new_x="LMARGIN", new_y="NEXT")
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(8)

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "INTEREST CERTIFICATE", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("helvetica", "", 10)
    pdf.ln(4)

    pdf.cell(60, 7, "Borrower Name:")
    pdf.cell(0, 7, user.full_name, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(60, 7, "Loan Number:")
    pdf.cell(0, 7, loan.loan_number, new_x="LMARGIN", new_y="NEXT")
    pdf.cell(60, 7, "Financial Year:")
    pdf.cell(0, 7, fy_label, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.cell(60, 7, "Total EMI Paid:")
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, f"INR {total_paid:,.2f}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 10)
    pdf.cell(60, 7, "Principal Repaid:")
    pdf.cell(0, 7, f"INR {total_principal:,.2f}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(60, 7, "Interest Paid:")
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(0, 7, f"INR {total_interest:,.2f}", new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(0, 0, 0)
    pdf.set_font("helvetica", "", 9)
    pdf.ln(6)
    pdf.multi_cell(0, 6, f"This certificate is issued for the purpose of Income Tax computation for {fy_label}. The interest amount mentioned above is the total interest paid on personal loan account {loan.loan_number} during the financial year.")

    return bytes(pdf.output())


async def _send_statement_email(to_email: str, name: str, loan_number: str, subject: str, pdf_bytes: bytes, filename: str):
    """Send statement email. Uses existing email service infrastructure."""
    try:
        from app.services.email_service import send_generic_email
        await send_generic_email(
            to_email=to_email,
            subject=subject,
            body=f"Dear {name},\n\nPlease find your loan statement for account {loan_number} attached.\n\nRegards,\nNexLoan Team",
        )
        logger.info(f"📧 Statement email sent to {to_email} for {loan_number}")
    except Exception as e:
        logger.warning(f"Email service not configured, skipping statement email: {e}")
