"""
NexLoan EMI Reminder Service — APScheduler-based daily email reminders
Sends Brevo emails for upcoming/overdue EMIs and creates in-app notifications.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import text
from app.utils.database import AsyncSessionLocal
from app.services.email_service import _send_brevo_api_email
from app.config import settings

logger = logging.getLogger("nexloan.reminders")


# ─── Email Templates ────────────────────────────────────────────────────────


def _emi_reminder_html(name: str, amount: float, due_date: str, loan_number: str, days_label: str) -> str:
    """Generate HTML for EMI reminder email."""
    return f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">NexLoan</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">EMI Reminder</p>
        </div>
        <div style="padding: 32px;">
            <p style="font-size: 16px; color: #d4d4d4;">Hi {name},</p>
            <p style="font-size: 16px; color: #d4d4d4;">{days_label}</p>
            <div style="background: #1a1a2e; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #7c3aed;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="color: #a3a3a3; padding: 8px 0;">Loan Number</td>
                        <td style="color: white; text-align: right; font-weight: 600;">{loan_number}</td>
                    </tr>
                    <tr>
                        <td style="color: #a3a3a3; padding: 8px 0;">EMI Amount</td>
                        <td style="color: #7c3aed; text-align: right; font-weight: 700; font-size: 20px;">₹{amount:,.0f}</td>
                    </tr>
                    <tr>
                        <td style="color: #a3a3a3; padding: 8px 0;">Due Date</td>
                        <td style="color: white; text-align: right; font-weight: 600;">{due_date}</td>
                    </tr>
                </table>
            </div>
            <a href="https://nexloan.vercel.app/dashboard" style="display: block; text-align: center; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Pay Now →</a>
            <p style="margin-top: 24px; font-size: 13px; color: #737373; text-align: center;">This is an automated reminder from NexLoan. Do not reply to this email.</p>
        </div>
    </div>
    """


def _emi_paid_html(name: str, amount: float, installment_no: int, loan_number: str) -> str:
    """Generate HTML for EMI payment confirmation email."""
    return f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px;">✅</h1>
            <h2 style="margin: 8px 0 0; color: white; font-size: 20px;">EMI Payment Confirmed</h2>
        </div>
        <div style="padding: 32px;">
            <p style="font-size: 16px; color: #d4d4d4;">Hi {name},</p>
            <p style="font-size: 16px; color: #d4d4d4;">Your EMI #{installment_no} of <strong style="color: #10b981;">₹{amount:,.0f}</strong> for loan {loan_number} has been received successfully.</p>
            <p style="margin-top: 24px; font-size: 13px; color: #737373; text-align: center;">Thank you for your timely payment!</p>
        </div>
    </div>
    """


# ─── Reminder Job ────────────────────────────────────────────────────────────


async def send_emi_reminders():
    """
    Daily scheduled job — check all active loans for upcoming/overdue EMIs.
    Sends Brevo emails + creates in-app notifications.
    Runs at 9:00 AM IST daily via APScheduler.
    """
    logger.info("🔔 Running daily EMI reminder check...")

    async with AsyncSessionLocal() as db:
        try:
            today = datetime.utcnow().date()

            # Get all PENDING EMIs that are due within the next 7 days or overdue by 1 day
            rows = (await db.execute(text("""
                SELECT
                    e.id as emi_id, e.loan_id, e.installment_no, e.due_date, e.emi_amount,
                    l.loan_number, l.user_id,
                    u.full_name, u.email
                FROM emi_schedule e
                JOIN loans l ON l.id = e.loan_id
                JOIN users u ON u.id = l.user_id
                WHERE e.status = 'PENDING'
                  AND l.status IN ('ACTIVE', 'DISBURSED')
                  AND e.due_date BETWEEN :start_date AND :end_date
                ORDER BY e.due_date ASC
            """), {
                "start_date": today - timedelta(days=1),
                "end_date": today + timedelta(days=7),
            }))).mappings().all()

            sent_count = 0
            for row in rows:
                due_date = row["due_date"]
                if isinstance(due_date, datetime):
                    due_date = due_date.date()
                days_until = (due_date - today).days

                # Determine reminder type and message
                if days_until == 7:
                    notif_type = "emi_reminder_7d"
                    days_label = f"Your EMI of ₹{row['emi_amount']:,.0f} is due on {due_date.strftime('%d %B %Y')} (7 days away)."
                    title = f"EMI due in 7 days — ₹{row['emi_amount']:,.0f}"
                elif days_until == 1:
                    notif_type = "emi_reminder_1d"
                    days_label = f"Tomorrow is your EMI date. ₹{row['emi_amount']:,.0f} will be due."
                    title = f"EMI due tomorrow — ₹{row['emi_amount']:,.0f}"
                elif days_until == 0:
                    notif_type = "emi_reminder_today"
                    days_label = f"Today is your EMI day! Please pay ₹{row['emi_amount']:,.0f} to stay on track."
                    title = f"EMI due today — ₹{row['emi_amount']:,.0f}"
                elif days_until == -1:
                    notif_type = "emi_overdue"
                    days_label = f"Your EMI of ₹{row['emi_amount']:,.0f} was due yesterday. Please pay now to avoid impact on your credit score."
                    title = f"⚠️ EMI overdue — ₹{row['emi_amount']:,.0f}"
                else:
                    continue  # Skip days 2-6

                # Check if we already sent this notification today
                existing = (await db.execute(text("""
                    SELECT id FROM notifications
                    WHERE user_id = :uid AND loan_id = :lid AND type = :type
                      AND created_at::date = :today
                """), {
                    "uid": str(row["user_id"]),
                    "lid": str(row["loan_id"]),
                    "type": notif_type,
                    "today": today.isoformat(),
                }))).first()

                if existing:
                    continue  # Already sent today

                # Create in-app notification
                await db.execute(text("""
                    INSERT INTO notifications (id, user_id, loan_id, type, title, message, is_read, created_at)
                    VALUES (gen_random_uuid(), :uid, :lid, :type, :title, :message, false, NOW())
                """), {
                    "uid": str(row["user_id"]),
                    "lid": str(row["loan_id"]),
                    "type": notif_type,
                    "title": title,
                    "message": days_label,
                })

                # Send Brevo email
                try:
                    html = _emi_reminder_html(
                        name=row["full_name"],
                        amount=row["emi_amount"],
                        due_date=due_date.strftime("%d %B %Y"),
                        loan_number=row["loan_number"],
                        days_label=days_label,
                    )
                    await _send_brevo_api_email(
                        to_email=row["email"],
                        to_name=row["full_name"],
                        subject=title,
                        html_content=html,
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error(f"❌ Email failed for {row['email']}: {e}")

            await db.commit()
            logger.info(f"✅ EMI reminders sent: {sent_count} emails for {len(rows)} eligible EMIs")

        except Exception as e:
            logger.error(f"❌ Reminder job failed: {e}")
            import traceback
            traceback.print_exc()
