"""
NexLoan PDF Service — Generate downloadable PDF documents
Uses xhtml2pdf (works on all platforms including Windows).
Generates: EMI Statement, Interest Certificate, Loan Sanction Letter.
"""

import logging
from io import BytesIO
from datetime import datetime

logger = logging.getLogger("nexloan.pdf")

try:
    from xhtml2pdf import pisa
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("⚠️ xhtml2pdf not installed — PDF generation disabled. Install with: pip install xhtml2pdf")


def generate_pdf(html_content: str) -> bytes:
    """Convert HTML string to PDF bytes using xhtml2pdf."""
    if not PDF_AVAILABLE:
        raise RuntimeError("xhtml2pdf is not installed. Run: pip install xhtml2pdf")

    result = BytesIO()
    pisa_status = pisa.CreatePDF(BytesIO(html_content.encode("utf-8")), dest=result)
    if pisa_status.err:
        raise RuntimeError(f"PDF generation failed with {pisa_status.err} errors")
    return result.getvalue()


# ─── HTML Templates ──────────────────────────────────────────────────────────


def emi_statement_html(
    user_name: str,
    loan_number: str,
    loan_amount: float,
    interest_rate: float,
    tenure_months: int,
    installments: list,
    generated_date: str,
) -> str:
    """Generate HTML for EMI payment statement."""
    rows_html = ""
    total_paid = 0
    total_principal = 0
    total_interest = 0
    for inst in installments:
        status_badge = "✅" if inst["status"] == "PAID" else "⏳"
        paid_date = inst.get("paid_at", "—")
        if isinstance(paid_date, datetime):
            paid_date = paid_date.strftime("%d %b %Y")
        due_date = inst["due_date"]
        if isinstance(due_date, datetime):
            due_date = due_date.strftime("%d %b %Y")

        rows_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">{inst['installment_no']}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{due_date}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{paid_date}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹{inst['emi_amount']:,.0f}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹{inst['principal']:,.0f}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹{inst['interest']:,.0f}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹{inst['outstanding_balance']:,.0f}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">{status_badge}</td>
        </tr>
        """
        if inst["status"] == "PAID":
            total_paid += inst["emi_amount"]
            total_principal += inst["principal"]
            total_interest += inst["interest"]

    return f"""
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; color: #111; padding: 40px; max-width: 900px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="margin: 0; color: #7c3aed; font-size: 28px;">NexLoan</h1>
            <p style="color: #666; margin: 4px 0;">Powered by TheoremLabs</p>
            <h2 style="margin: 16px 0 4px; font-size: 20px;">EMI Payment Statement</h2>
            <p style="color: #666; font-size: 13px;">Generated on {generated_date}</p>
        </div>
        <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%;">
                <tr>
                    <td><strong>Borrower:</strong> {user_name}</td>
                    <td><strong>Loan Number:</strong> {loan_number}</td>
                </tr>
                <tr>
                    <td><strong>Loan Amount:</strong> ₹{loan_amount:,.0f}</td>
                    <td><strong>Interest Rate:</strong> {interest_rate}% p.a.</td>
                </tr>
                <tr>
                    <td><strong>Tenure:</strong> {tenure_months} months</td>
                    <td><strong>Total Paid:</strong> ₹{total_paid:,.0f}</td>
                </tr>
            </table>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: #7c3aed; color: white;">
                    <th style="padding: 10px; text-align: center;">No.</th>
                    <th style="padding: 10px;">Due Date</th>
                    <th style="padding: 10px;">Paid Date</th>
                    <th style="padding: 10px; text-align: right;">EMI</th>
                    <th style="padding: 10px; text-align: right;">Principal</th>
                    <th style="padding: 10px; text-align: right;">Interest</th>
                    <th style="padding: 10px; text-align: right;">Balance</th>
                    <th style="padding: 10px; text-align: center;">Status</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
            <tfoot>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <td colspan="3" style="padding: 10px;">Total Paid</td>
                    <td style="padding: 10px; text-align: right;">₹{total_paid:,.0f}</td>
                    <td style="padding: 10px; text-align: right;">₹{total_principal:,.0f}</td>
                    <td style="padding: 10px; text-align: right;">₹{total_interest:,.0f}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
        <p style="margin-top: 32px; font-size: 11px; color: #999; text-align: center;">
            This is a computer-generated document from NexLoan. No signature required.
        </p>
    </body>
    </html>
    """


def interest_certificate_html(
    user_name: str, loan_number: str, financial_year: str,
    total_interest: float, loan_amount: float, interest_rate: float,
    generated_date: str,
) -> str:
    """Generate HTML for interest certificate (Section 24 tax purposes)."""
    return f"""
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; color: #111; padding: 40px; max-width: 700px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px; border-bottom: 3px solid #7c3aed; padding-bottom: 16px;">
            <h1 style="margin: 0; color: #7c3aed; font-size: 28px;">NexLoan</h1>
            <p style="color: #666; margin: 4px 0;">Powered by TheoremLabs</p>
            <h2 style="margin: 16px 0 0; font-size: 22px;">Interest Certificate</h2>
            <p style="color: #666; font-size: 14px;">Financial Year: {financial_year}</p>
        </div>
        <p>This is to certify that the following interest has been paid by the borrower on the personal loan availed from NexLoan:</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #7c3aed;">
            <table style="width: 100%; font-size: 15px;">
                <tr><td style="padding: 8px 0; color: #666;">Borrower Name</td><td style="font-weight: 600;">{user_name}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Loan Number</td><td style="font-weight: 600;">{loan_number}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Loan Amount</td><td style="font-weight: 600;">₹{loan_amount:,.0f}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Interest Rate</td><td style="font-weight: 600;">{interest_rate}% p.a.</td></tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0; color: #666; font-size: 16px;">Total Interest Paid (FY {financial_year})</td>
                    <td style="font-weight: 700; font-size: 22px; color: #7c3aed;">₹{total_interest:,.0f}</td>
                </tr>
            </table>
        </div>
        <p style="font-size: 13px; color: #666;">This certificate may be used for claiming deduction under Section 24(b) of the Income Tax Act, 1961, subject to applicable limits.</p>
        <p style="margin-top: 32px; font-size: 11px; color: #999; text-align: center;">
            Generated on {generated_date} | Computer-generated — no signature required.
        </p>
    </body>
    </html>
    """


def sanction_letter_html(
    user_name: str, loan_number: str, loan_amount: float,
    interest_rate: float, tenure_months: int, emi_amount: float,
    approved_date: str, generated_date: str,
) -> str:
    """Generate HTML for loan sanction letter."""
    return f"""
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; color: #111; padding: 40px; max-width: 700px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px; border-bottom: 3px solid #7c3aed; padding-bottom: 16px;">
            <h1 style="margin: 0; color: #7c3aed; font-size: 28px;">NexLoan</h1>
            <p style="color: #666; margin: 4px 0;">Powered by TheoremLabs</p>
            <h2 style="margin: 16px 0 0; font-size: 22px;">Loan Sanction Letter</h2>
        </div>
        <p>Date: {approved_date}</p>
        <p>Dear <strong>{user_name}</strong>,</p>
        <p>We are pleased to inform you that your personal loan application has been <strong style="color: #059669;">approved</strong>. The details of your sanction are as follows:</p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #059669;">
            <table style="width: 100%; font-size: 15px;">
                <tr><td style="padding: 8px 0; color: #666;">Loan Number</td><td style="font-weight: 600;">{loan_number}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Sanctioned Amount</td><td style="font-weight: 700; color: #059669; font-size: 20px;">₹{loan_amount:,.0f}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Interest Rate</td><td style="font-weight: 600;">{interest_rate}% per annum (reducing balance)</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Tenure</td><td style="font-weight: 600;">{tenure_months} months</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Monthly EMI</td><td style="font-weight: 700; font-size: 18px;">₹{emi_amount:,.0f}</td></tr>
            </table>
        </div>
        <h3>Terms and Conditions</h3>
        <ol style="font-size: 13px; color: #444; line-height: 1.8;">
            <li>The loan will be disbursed to the bank account provided during the application.</li>
            <li>EMI payments are due on the 5th of every month, starting one month after disbursement.</li>
            <li>Pre-closure is allowed after 3 months with a 2% foreclosure charge.</li>
            <li>Late payment beyond 15 days of the due date may attract a penalty of 2% on the overdue amount.</li>
            <li>This sanction is valid for 30 days from the date of this letter.</li>
            <li>The borrower must maintain adequate KYC documentation as per RBI guidelines.</li>
        </ol>
        <p style="margin-top: 24px;">Congratulations and thank you for choosing NexLoan!</p>
        <p style="margin-top: 32px; font-size: 11px; color: #999; text-align: center;">
            Generated on {generated_date} | This is a system-generated document.
        </p>
    </body>
    </html>
    """
