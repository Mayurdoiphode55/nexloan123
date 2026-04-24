import logging
import httpx
from typing import Optional

from app.config import settings

logger = logging.getLogger("nexloan.email")

# Shared HTTP client for efficiency
_http_client: Optional[httpx.AsyncClient] = None


async def _get_client() -> httpx.AsyncClient:
    """Get or create a shared httpx AsyncClient."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


async def send_otp_email(email: str, otp: str, full_name: str) -> bool:
    """
    Send an OTP verification email via Brevo API.
    """
    try:
        html_content = _otp_email_template(full_name, otp)
        return await _send_brevo_api_email(
            to_email=email,
            to_name=full_name,
            subject="Your NexLoan OTP Verification Code",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"❌ Failed to send OTP email to {email}: {e}")
        return False


async def send_approval_email(
    email: str,
    full_name: str,
    loan_number: str,
    loan_amount: float,
    interest_rate: float,
    emi_amount: float,
    tenure_months: int,
) -> bool:
    """
    Send a loan approval email via Brevo API.
    """
    try:
        html_content = _approval_email_template(
            full_name, loan_number, loan_amount, interest_rate, emi_amount, tenure_months
        )
        return await _send_brevo_api_email(
            to_email=email,
            to_name=full_name,
            subject=f"🎉 Your Loan {loan_number} is Approved!",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"❌ Failed to send approval email to {email}: {e}")
        return False


async def send_rejection_email(
    email: str, full_name: str, loan_number: str, reason: str
) -> bool:
    """
    Send a loan rejection email via Brevo API.
    """
    try:
        html_content = _rejection_email_template(full_name, loan_number, reason)
        return await _send_brevo_api_email(
            to_email=email,
            to_name=full_name,
            subject=f"Update on Your Loan Application {loan_number}",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"❌ Failed to send rejection email to {email}: {e}")
        return False


async def send_no_dues_certificate(
    email: str, full_name: str, loan_number: str, loan_amount: float, total_paid: float
) -> bool:
    """
    Send a no-dues certificate email via Brevo API.
    """
    try:
        html_content = _no_dues_certificate_template(full_name, loan_number, loan_amount, total_paid)
        return await _send_brevo_api_email(
            to_email=email,
            to_name=full_name,
            subject=f"Your NexLoan No-Dues Certificate - {loan_number}",
            html_content=html_content
        )
    except Exception as e:
        logger.error(f"❌ Failed to send no-dues certificate to {email}: {e}")
        return False


# ─── Brevo API Helper ─────────────────────────────────────────────────────────


async def _send_brevo_api_email(to_email: str, to_name: str, subject: str, html_content: str) -> bool:
    """
    Send email via Brevo REST API (HTTPS Port 443).
    This is much more reliable than SMTP on cloud platforms like Render.
    """
    try:
        # Resolve API Key (fallback to SMTP_PASSWORD if BREVO_API_KEY is not set)
        api_key = settings.BREVO_API_KEY or settings.SMTP_PASSWORD
        
        if not api_key:
            logger.error("❌ Brevo API Key is missing. Please set BREVO_API_KEY or SMTP_PASSWORD.")
            return False

        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "sender": {
                "name": settings.APP_NAME,
                "email": settings.EMAIL_FROM
            },
            "to": [
                {
                    "email": to_email,
                    "name": to_name
                }
            ],
            "subject": subject,
            "htmlContent": html_content
        }

        client = await _get_client()
        logger.info(f"📧 Sending Brevo API email to {to_email}...")
        
        response = await client.post(url, json=payload, headers=headers)
        
        if response.status_code in [201, 200, 202]:
            logger.info(f"✅ API Email sent successfully to {to_email}")
            return True
        else:
            logger.error(f"❌ Brevo API Error ({response.status_code}): {response.text}")
            if response.status_code == 401:
                logger.error("💡 Hint: Your Brevo API Key is invalid or expired.")
            elif response.status_code == 400:
                logger.error("💡 Hint: Malformed request or unverified sender email.")
            return False
            
    except Exception as e:
        logger.error(f"❌ Exception sending Brevo API email: {e}")
        return False





def _otp_email_template(full_name: str, otp: str) -> str:
    """HTML template for OTP verification email."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }}
            .otp-box {{ background: white; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }}
            .otp {{ font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #2563eb; font-family: 'Courier New', monospace; }}
            .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 NexLoan Verification</h1>
                <p>Your OTP verification code is ready</p>
            </div>
            <div class="content">
                <p>Hi {full_name},</p>
                <p>Thank you for signing up with <strong>NexLoan</strong>! Here's your One-Time Password (OTP) for verification:</p>
                
                <div class="otp-box">
                    <div class="otp">{otp}</div>
                </div>
                
                <p><strong>Important:</strong></p>
                <ul>
                    <li>This code expires in <strong>5 minutes</strong></li>
                    <li>Never share this code with anyone</li>
                    <li>NexLoan staff will never ask for your OTP</li>
                </ul>
                
                <p>If you did not request this code, please ignore this email.</p>
                
                <p>Happy lending with NexLoan! 🚀</p>
                
                <div class="footer">
                    <p>© 2024 NexLoan — Powered by Theoremlabs. All rights reserved.</p>
                    <p>This is an automated message. Please do not reply.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """


def _approval_email_template(
    full_name: str,
    loan_number: str,
    loan_amount: float,
    interest_rate: float,
    emi_amount: float,
    tenure_months: int,
) -> str:
    """HTML template for loan approval email."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px 20px; }}
            .footer {{ background: white; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }}
            .details {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
            .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
            .detail-row:last-child {{ border-bottom: none; }}
            .detail-label {{ font-weight: 600; color: #666; }}
            .detail-value {{ color: #2563eb; font-weight: 600; }}
            .btn {{ background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Congratulations!</h1>
                <p>Your Loan Application is Approved</p>
            </div>
            <div class="content">
                <p>Hi {full_name},</p>
                <p>Great news! Your loan application has been <strong>APPROVED</strong> by our underwriting team.</p>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="detail-label">Loan Number:</span>
                        <span class="detail-value">{loan_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Loan Amount:</span>
                        <span class="detail-value">₹{loan_amount:,.2f}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Interest Rate:</span>
                        <span class="detail-value">{interest_rate}% p.a.</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Monthly EMI:</span>
                        <span class="detail-value">₹{emi_amount:,.2f}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tenure:</span>
                        <span class="detail-value">{tenure_months} months</span>
                    </div>
                </div>
                
                <p><strong>What's next?</strong></p>
                <ol>
                    <li>Log in to your NexLoan dashboard</li>
                    <li>Review your loan details and EMI schedule</li>
                    <li>Accept the loan terms</li>
                    <li>Funds will be disbursed to your account</li>
                </ol>
                
                <p>If you have any questions, our support team is here to help.</p>
                
                <div style="text-align: center;">
                    <a href="https://nexloan.app/dashboard" class="btn">View Loan Details</a>
                </div>
                
                <p style="margin-top: 20px;">Best regards,<br><strong>NexLoan Team</strong></p>
            </div>
            <div class="footer">
                <p>© 2024 NexLoan — Powered by Theoremlabs. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """


def _rejection_email_template(
    full_name: str, loan_number: str, reason: str
) -> str:
    """HTML template for loan rejection email."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #f97316; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f9fafb; padding: 30px 20px; border-radius: 0 0 8px 8px; }}
            .reason-box {{ background: #fef2f2; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0; border-radius: 4px; }}
            .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Loan Application Status</h1>
                <p>Update on your application</p>
            </div>
            <div class="content">
                <p>Hi {full_name},</p>
                <p>Thank you for applying for a loan with NexLoan. We appreciate your interest.</p>
                
                <p>Unfortunately, your loan application <strong>({loan_number})</strong> could not be approved at this time.</p>
                
                <div class="reason-box">
                    <p><strong>Reason:</strong></p>
                    <p>{reason}</p>
                </div>
                
                <p><strong>What can you do?</strong></p>
                <ul>
                    <li>Improve your financial profile: increase savings, reduce existing EMI obligations</li>
                    <li>Try again after 30 days with updated financial information</li>
                    <li>Contact our support team for personalized guidance</li>
                </ul>
                
                <p>We're here to help! Feel free to reach out if you'd like to discuss your application further.</p>
                
                <p style="margin-top: 20px;">Best regards,<br><strong>NexLoan Team</strong></p>
                
                <div class="footer">
                    <p>© 2024 NexLoan — Powered by Theoremlabs. All rights reserved.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """


def _no_dues_certificate_template(
    full_name: str, loan_number: str, original_amount: float, total_paid: float
) -> str:
    """HTML template for no-dues certificate."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{ font-family: 'Georgia', serif; line-height: 1.8; color: #333; }}
            .container {{ max-width: 800px; margin: 0 auto; padding: 40px 20px; }}
            .certificate {{ border: 3px solid #2563eb; padding: 50px; text-align: center; background: #f0f4f8; border-radius: 8px; }}
            .title {{ font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }}
            .subtitle {{ font-size: 14px; color: #666; margin-bottom: 30px; }}
            .content {{ margin: 40px 0; text-align: left; }}
            .detail-row {{ display: flex; justify-content: space-between; margin: 15px 0; padding: 10px 0; border-bottom: 1px dotted #ccc; }}
            .detail-label {{ font-weight: 600; }}
            .detail-value {{ text-align: right; }}
            .seal {{ margin-top: 40px; text-align: center; font-size: 48px; }}
            .signature {{ margin-top: 40px; text-align: center; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="certificate">
                <div class="title">✅ NO-DUES CERTIFICATE</div>
                <div class="subtitle">Loan Successfully Closed</div>
                
                <div class="content">
                    <p>This is to certify that <strong>{full_name}</strong> has successfully repaid all dues against the loan granted under the following details:</p>
                    
                    <div class="detail-row">
                        <span class="detail-label">Loan Number:</span>
                        <span class="detail-value">{loan_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Original Loan Amount:</span>
                        <span class="detail-value">₹{original_amount:,.2f}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Amount Paid:</span>
                        <span class="detail-value">₹{total_paid:,.2f}</span>
                    </div>
                    
                    <p style="margin-top: 30px;">The borrower is hereby informed that all outstanding dues, including principal, interest, charges, and penalties, if any, have been fully settled. The borrower's loan account is now <strong>CLOSED</strong> with no outstanding liabilities.</p>
                    
                    <p>This certificate is issued as per the request of the borrower and may be used for all official purposes.</p>
                </div>
                
                <div class="seal">🏆</div>
                
                <div class="signature">
                    <p>Issued by: <strong>NexLoan — Powered by Theoremlabs</strong></p>
                    <p>This is a computer-generated certificate and does not require signature.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """


# ─── v2.0 Email Templates ────────────────────────────────────────────────────


async def send_counter_offer_email(
    to_email: str, name: str, loan_number: str,
    original_amount: float, counter_amount: float, counter_rate: float, emi_amount: float,
) -> bool:
    """Send counter offer email — B6.5 Template 1."""
    try:
        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#09090B;color:#FAFAFA;padding:32px;">
        <div style="max-width:560px;margin:auto;background:#111113;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.07);">
            <h2 style="color:#A78BFA;margin:0 0 8px;">We have a special offer for you</h2>
            <p style="color:#A1A1AA;font-size:14px;">Loan {loan_number}</p>
            <hr style="border:1px solid rgba(255,255,255,0.07);margin:20px 0;">
            <p>Hi {name},</p>
            <p>While we couldn't approve your full request of <strong>₹{original_amount:,.0f}</strong>, we can offer you:</p>
            <div style="background:#1C1C1F;border-radius:12px;padding:24px;margin:20px 0;text-align:center;">
                <p style="color:#FBBF24;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0;">Approved Amount</p>
                <p style="font-size:36px;font-weight:700;margin:8px 0;color:#A78BFA;">₹{counter_amount:,.0f}</p>
                <p style="color:#A1A1AA;">at {counter_rate}% p.a. · EMI: ₹{emi_amount:,.0f}/month</p>
            </div>
            <p>Log in to your NexLoan dashboard to accept or decline this offer.</p>
            <p style="color:#A1A1AA;font-size:13px;margin-top:24px;">— NexLoan, Powered by Theoremlabs</p>
        </div>
        </body></html>
        """
        return await _send_brevo_api_email(to_email, name, f"We have a special offer for you — Loan {loan_number}", html)
    except Exception as e:
        logger.error(f"❌ Counter offer email failed: {e}")
        return False


async def send_rejection_with_plan_email(
    to_email: str, name: str, loan_number: str,
    reason: str, improvement_plan: str, reapply_date: str,
) -> bool:
    """Send rejection email with improvement plan — B6.5 Template 2."""
    try:
        plan_html = improvement_plan.replace("\n", "<br>") if improvement_plan else ""
        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#09090B;color:#FAFAFA;padding:32px;">
        <div style="max-width:560px;margin:auto;background:#111113;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.07);">
            <h2 style="color:#F59E0B;margin:0 0 8px;">About your NexLoan application</h2>
            <p style="color:#A1A1AA;font-size:14px;">Loan {loan_number}</p>
            <hr style="border:1px solid rgba(255,255,255,0.07);margin:20px 0;">
            <p>Hi {name},</p>
            <p>After careful review, we're unable to approve your loan at this time.</p>
            <div style="background:rgba(239,68,68,0.08);border-left:3px solid #EF4444;padding:16px;border-radius:8px;margin:16px 0;">
                <p style="margin:0;font-size:14px;">{reason}</p>
            </div>
            <h3 style="color:#A78BFA;margin-top:24px;">Your 3-Step Improvement Plan</h3>
            <div style="background:#1C1C1F;border-radius:12px;padding:20px;margin:16px 0;">
                <p style="font-size:14px;line-height:1.8;">{plan_html}</p>
            </div>
            <div style="background:rgba(59,130,246,0.08);border-left:3px solid #3B82F6;padding:16px;border-radius:8px;margin:16px 0;">
                <p style="margin:0;font-size:14px;">📅 You can reapply after <strong>{reapply_date}</strong></p>
            </div>
            <p style="color:#A1A1AA;font-size:13px;margin-top:24px;">— NexLoan, Powered by Theoremlabs</p>
        </div>
        </body></html>
        """
        return await _send_brevo_api_email(to_email, name, f"About your NexLoan application — {loan_number}", html)
    except Exception as e:
        logger.error(f"❌ Rejection with plan email failed: {e}")
        return False


async def send_emi_pause_confirmation(
    to_email: str, name: str, loan_number: str,
    paused_installment_no: int, new_final_date: str,
) -> bool:
    """Send EMI pause confirmation — B6.5 Template 3."""
    try:
        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#09090B;color:#FAFAFA;padding:32px;">
        <div style="max-width:560px;margin:auto;background:#111113;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.07);">
            <h2 style="color:#22C55E;margin:0 0 8px;">EMI Pause Confirmed ⏸️</h2>
            <p style="color:#A1A1AA;font-size:14px;">Loan {loan_number}</p>
            <hr style="border:1px solid rgba(255,255,255,0.07);margin:20px 0;">
            <p>Hi {name},</p>
            <p>Your EMI payment has been paused as requested.</p>
            <div style="background:#1C1C1F;border-radius:12px;padding:20px;margin:20px 0;">
                <p><strong>Paused EMI:</strong> Installment #{paused_installment_no}</p>
                <p><strong>New Final Payment Date:</strong> {new_final_date}</p>
            </div>
            <p style="font-size:14px;color:#A1A1AA;">This installment has been moved to the end of your schedule. You have 0 pauses remaining this year.</p>
            <p style="color:#A1A1AA;font-size:13px;margin-top:24px;">— NexLoan, Powered by Theoremlabs</p>
        </div>
        </body></html>
        """
        return await _send_brevo_api_email(to_email, name, f"EMI Pause Confirmed — {loan_number}", html)
    except Exception as e:
        logger.error(f"❌ EMI pause email failed: {e}")
        return False


async def send_closure_celebration_email(
    to_email: str, name: str, loan_number: str,
    original_amount: float, total_paid: float, interest_saved: float,
    score_improvement: int, reapply_offer_amount: float, reapply_offer_rate: float,
) -> bool:
    """Send closure celebration email with journey stats and re-offer — B6.5 Template 4."""
    try:
        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#09090B;color:#FAFAFA;padding:32px;">
        <div style="max-width:560px;margin:auto;background:#111113;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.07);">
            <h2 style="color:#22C55E;margin:0 0 8px;">🎉 Loan Closed — You did it, {name}!</h2>
            <p style="color:#A1A1AA;font-size:14px;">Loan {loan_number}</p>
            <hr style="border:1px solid rgba(255,255,255,0.07);margin:20px 0;">

            <div style="display:flex;gap:16px;margin:20px 0;">
                <div style="flex:1;background:#1C1C1F;border-radius:12px;padding:16px;text-align:center;">
                    <p style="color:#A1A1AA;font-size:11px;text-transform:uppercase;margin:0;">Total Repaid</p>
                    <p style="font-size:24px;font-weight:700;margin:8px 0;">₹{total_paid:,.0f}</p>
                </div>
                <div style="flex:1;background:#1C1C1F;border-radius:12px;padding:16px;text-align:center;">
                    <p style="color:#A1A1AA;font-size:11px;text-transform:uppercase;margin:0;">Interest Saved</p>
                    <p style="font-size:24px;font-weight:700;margin:8px 0;color:#22C55E;">₹{interest_saved:,.0f}</p>
                </div>
                <div style="flex:1;background:#1C1C1F;border-radius:12px;padding:16px;text-align:center;">
                    <p style="color:#A1A1AA;font-size:11px;text-transform:uppercase;margin:0;">Score Improved</p>
                    <p style="font-size:24px;font-weight:700;margin:8px 0;color:#FBBF24;">+{score_improvement} pts</p>
                </div>
            </div>

            <div style="background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.15));border:1px solid rgba(139,92,246,0.3);border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
                <p style="color:#A78BFA;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0;">You're Pre-Approved</p>
                <p style="font-size:32px;font-weight:700;margin:8px 0;">₹{reapply_offer_amount:,.0f}</p>
                <p style="color:#A1A1AA;">at {reapply_offer_rate}% p.a. — Your Loyalty Rate</p>
            </div>

            <hr style="border:1px solid rgba(255,255,255,0.07);margin:24px 0;">
            <h3 style="color:#FAFAFA;font-size:16px;">No Dues Certificate</h3>
            <p style="font-size:14px;color:#A1A1AA;">This certifies that the personal loan account <strong>{loan_number}</strong> associated with <strong>{name}</strong> has been closed and there are no outstanding dues payable to NexLoan.</p>
            <p style="color:#52525B;font-size:12px;margin-top:16px;">Issued by NexLoan — Powered by Theoremlabs. Computer-generated, no signature required.</p>
        </div>
        </body></html>
        """
        return await _send_brevo_api_email(to_email, name, f"🎉 Loan Closed — You did it, {name}!", html)
    except Exception as e:
        logger.error(f"❌ Closure celebration email failed: {e}")
        return False


async def send_reapply_reminder_email(
    to_email: str, name: str, loan_number: str, improvement_plan: str,
) -> bool:
    """Send 90-day reapply reminder — B6.5 Template 5."""
    try:
        plan_html = improvement_plan.replace("\n", "<br>") if improvement_plan else "Complete your improvement steps and try again."
        html = f"""
        <html><body style="font-family:Inter,sans-serif;background:#09090B;color:#FAFAFA;padding:32px;">
        <div style="max-width:560px;margin:auto;background:#111113;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.07);">
            <h2 style="color:#A78BFA;margin:0 0 8px;">Ready to try again?</h2>
            <p style="color:#A1A1AA;font-size:14px;">Your NexLoan pre-check is ready</p>
            <hr style="border:1px solid rgba(255,255,255,0.07);margin:20px 0;">
            <p>Hi {name},</p>
            <p>It's been 90 days since your loan application ({loan_number}). We'd love to see you back!</p>
            <h3 style="color:#A78BFA;margin-top:24px;">Your Improvement Plan (Reminder)</h3>
            <div style="background:#1C1C1F;border-radius:12px;padding:20px;margin:16px 0;">
                <p style="font-size:14px;line-height:1.8;">{plan_html}</p>
            </div>
            <p>Start fresh with our <strong>Loan Readiness Checker</strong> — no KYC needed, instant result.</p>
            <p style="color:#A1A1AA;font-size:13px;margin-top:24px;">— NexLoan, Powered by Theoremlabs</p>
        </div>
        </body></html>
        """
        return await _send_brevo_api_email(to_email, name, f"Ready to try again? Your NexLoan pre-check is ready", html)
    except Exception as e:
        logger.error(f"❌ Reapply reminder email failed: {e}")
        return False

