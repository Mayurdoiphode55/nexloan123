"""
NexLoan Early Warning System — Predictive Default Detection
Weekly APScheduler job that analyzes repayment patterns and flags at-risk borrowers.
"""

import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, LoanStatus, EarlyWarningFlag, EMISchedule
from app.utils.database import AsyncSessionLocal

logger = logging.getLogger("nexloan.early_warning")


def analyze_repayment_pattern(loan: Loan) -> dict:
    """Rule-based repayment pattern analysis."""
    paid = [e for e in loan.emi_schedule if e.status.value == "PAID"]
    pending = [e for e in loan.emi_schedule if e.status.value == "PENDING"]

    if len(paid) < 2:
        return {"risk_score": 0.1, "risk_label": "LOW", "avg_days_late": 0,
                "late_payments": 0, "total_paid": len(paid), "late_rate": 0,
                "payment_trend": "stable"}

    # Calculate average days late for paid EMIs
    days_late_list = []
    for emi in paid:
        if emi.paid_at and emi.due_date:
            days_late = (emi.paid_at - emi.due_date).days
            days_late_list.append(days_late)

    if not days_late_list:
        return {"risk_score": 0.1, "risk_label": "LOW", "avg_days_late": 0,
                "late_payments": 0, "total_paid": len(paid), "late_rate": 0,
                "payment_trend": "stable"}

    avg_days_late = sum(days_late_list) / len(days_late_list)
    late_count = sum(1 for d in days_late_list if d > 0)
    late_rate = late_count / len(paid) if len(paid) > 0 else 0

    # Check if payment trend is deteriorating
    recent_3 = days_late_list[-3:] if len(days_late_list) >= 3 else days_late_list
    trend = "improving" if recent_3[-1] < recent_3[0] else "deteriorating"

    # Calculate risk score
    risk_score = 0.0
    risk_score += min(avg_days_late / 30, 0.4)
    risk_score += late_rate * 0.3
    risk_score += 0.3 if trend == "deteriorating" else 0.0

    risk_label = (
        "HIGH" if risk_score >= 0.7 else
        "MEDIUM" if risk_score >= 0.4 else
        "LOW"
    )

    return {
        "risk_score": round(risk_score, 3),
        "risk_label": risk_label,
        "avg_days_late": round(avg_days_late, 1),
        "late_payments": late_count,
        "total_paid": len(paid),
        "late_rate": round(late_rate, 3),
        "payment_trend": trend,
    }


async def generate_early_warning_analysis(loan: Loan, risk_data: dict) -> str:
    """Use Groq to generate plain-English risk explanation."""
    try:
        from groq import Groq
        from app.config import settings

        if not settings.GROQ_API_KEY:
            return (
                f"This borrower has been late on {risk_data['late_payments']} of "
                f"{risk_data['total_paid']} payments with an average delay of "
                f"{risk_data['avg_days_late']} days. Payment trend is {risk_data['payment_trend']}."
            )

        client = Groq(api_key=settings.GROQ_API_KEY)
        prompt = f"""A borrower has the following repayment pattern for their active loan:
- Average days late per payment: {risk_data['avg_days_late']} days
- Late payments: {risk_data['late_payments']} out of {risk_data['total_paid']} total
- Payment trend: {risk_data['payment_trend']}
- Risk score: {risk_data['risk_score']:.0%}

Write a 2-sentence plain English explanation of the default risk for
a loan officer. Be specific and actionable. Do not use technical jargon."""

        response = client.chat.completions.create(
            model=settings.GROQ_TEXT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Groq analysis failed: {e}")
        return (
            f"This borrower has been late on {risk_data['late_payments']} of "
            f"{risk_data['total_paid']} payments with an average delay of "
            f"{risk_data['avg_days_late']} days. Payment trend is {risk_data['payment_trend']}."
        )


async def run_early_warning_system():
    """Weekly job (Monday 7 AM): analyze repayment patterns for all active loans."""
    logger.info("🔎 Running early warning system...")

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Loan)
                .where(Loan.status.in_([LoanStatus.ACTIVE, LoanStatus.DISBURSED]))
            )
            active_loans = result.scalars().all()

            flagged = 0
            for loan in active_loans:
                risk_data = analyze_repayment_pattern(loan)

                if risk_data["risk_score"] >= 0.4:
                    # Check if already flagged recently
                    existing = await db.execute(
                        select(EarlyWarningFlag).where(
                            EarlyWarningFlag.loan_id == loan.id,
                            EarlyWarningFlag.is_resolved == False,
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    ai_analysis = await generate_early_warning_analysis(loan, risk_data)

                    flag = EarlyWarningFlag(
                        loan_id=loan.id,
                        user_id=loan.user_id,
                        risk_score=risk_data["risk_score"],
                        risk_label=risk_data["risk_label"],
                        prediction_basis=risk_data,
                        ai_analysis=ai_analysis,
                    )

                    if risk_data["risk_label"] == "HIGH":
                        flag.action_taken = "PROACTIVE_EMAIL_SENT"
                    elif risk_data["risk_label"] == "MEDIUM":
                        flag.action_taken = "OFFICER_NOTIFIED"

                    db.add(flag)
                    flagged += 1

            await db.commit()
            logger.info(f"✅ Early warning: {flagged} new flags out of {len(active_loans)} active loans")

        except Exception as e:
            logger.error(f"❌ Early warning error: {e}")
            await db.rollback()
