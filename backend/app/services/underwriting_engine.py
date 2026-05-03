"""
NexLoan Underwriting Engine — v2.0
Rule-based automated decision engine with:
  - Theoremlabs Credit Score (replaces mock bureau)
  - Counter-offer generation when partial amount qualifies
  - Groq-generated improvement plan on rejection
  - Reapply reminder date (90 days after rejection)
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks

from app.models.loan import Loan, LoanStatus, AuditLog, User, KYCDocument
from app.services.credit_score import calculate_credit_score, apply_rate_rules
from app.services.bureau_service import bureau_service
from app.services.email_service import (
    send_approval_email,
    send_rejection_email,
    send_counter_offer_email,
    send_rejection_with_plan_email,
)

logger = logging.getLogger("nexloan.underwriting")


def calculate_dti(monthly_income: float, existing_emi: float, requested_emi: float) -> float:
    """
    Calculates Debt-to-Income (DTI) ratio.
    δ = (E_existing + E_requested) / I_monthly
    """
    if monthly_income <= 0:
        return 1.0  # 100%
    return (existing_emi + requested_emi) / monthly_income


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    """
    Reducing-balance EMI formula:
    EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    """
    if principal <= 0 or annual_rate <= 0 or tenure_months <= 0:
        return 0.0
    r = annual_rate / (12 * 100)
    n = tenure_months
    emi = (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)
    return round(emi, 2)


async def generate_improvement_plan(
    rejection_reason: str,
    credit_score: int,
    dti_ratio: float,
    monthly_income: float,
    loan_amount: float,
) -> str:
    """
    Generates a 3-step improvement plan using Groq LLM.
    Falls back to a deterministic plan if Groq is unavailable.
    """
    try:
        from groq import AsyncGroq
        from app.config import settings

        client = AsyncGroq(api_key=settings.GROQ_API_KEY)

        prompt = f"""A user was rejected for a personal loan. Generate a concise, empathetic,
actionable 3-step improvement plan in simple English. Maximum 120 words.

Rejection reason: {rejection_reason}
Their credit score: {credit_score}/850
Their DTI ratio: {dti_ratio:.1%}
Monthly income: ₹{monthly_income:,.0f}
Requested loan: ₹{loan_amount:,.0f}

Format as exactly 3 numbered steps. Be specific with numbers.
Be encouraging but honest. Do not mention CIBIL or external credit bureaus.
Reference "Theoremlabs Credit Score" instead."""

        response = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=settings.GROQ_TEXT_MODEL,
            temperature=0.7,
            max_tokens=250,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        logger.error(f"❌ Groq improvement plan generation failed: {e}")
        # Deterministic fallback
        tips = []
        if dti_ratio > 0.40:
            tips.append(f"1. Reduce your existing EMIs — your DTI is {dti_ratio:.0%}, aim for below 35% by closing one existing obligation.")
        else:
            tips.append(f"1. Maintain your current EMI commitments — your DTI of {dti_ratio:.0%} is reasonable.")

        if credit_score < 550:
            tips.append(f"2. Build your Theoremlabs Credit Score — currently {credit_score}/850. Apply for a smaller amount (₹{loan_amount*0.5:,.0f}) and repay perfectly to boost it.")
        else:
            tips.append(f"2. Your Theoremlabs Credit Score of {credit_score}/850 is decent. Wait 90 days and reapply with updated financials.")

        tips.append(f"3. Consider requesting ₹{loan_amount*0.6:,.0f} instead of ₹{loan_amount:,.0f} — a lower amount increases approval odds significantly.")
        return "\n".join(tips)


def _calculate_counter_offer(
    monthly_income: float,
    existing_emi: float,
    credit_score: int,
    interest_rate: float,
    tenure_months: int,
) -> dict | None:
    """
    Tries to find a partial amount ≥ ₹50,000 that qualifies.
    Uses the DTI ceiling of 50% to back-calculate max affordable EMI.
    """
    max_dti = 0.50
    max_emi = (monthly_income * max_dti) - existing_emi
    if max_emi <= 0:
        return None

    # Back-calculate max principal from max EMI
    r = interest_rate / (12 * 100)
    n = tenure_months
    if r <= 0:
        return None
    max_principal = max_emi * ((1 + r) ** n - 1) / (r * (1 + r) ** n)
    max_principal = round(max_principal, 2)

    if max_principal < 50000:
        return None

    counter_emi = calculate_emi(max_principal, interest_rate, tenure_months)

    return {
        "amount": max_principal,
        "rate": interest_rate,
        "emi": counter_emi,
    }


async def evaluate_loan(
    db: AsyncSession,
    loan_id: str,
    admin_user_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Core underwriting evaluation — v2.0.
    1. Run Theoremlabs Credit Score
    2. If REJECTED and partial amount ≥ ₹50,000 qualifies → COUNTER_OFFERED
    3. If fully REJECTED → generate improvement plan, set reapply date
    """
    stmt = select(Loan).where(Loan.id == loan_id)
    result = await db.execute(stmt)
    loan = result.scalars().first()

    if not loan:
        raise ValueError("Loan not found")

    user_stmt = select(User).where(User.id == loan.user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalars().first()

    if not user:
        raise ValueError("Loan user not found")

    # Validation gates
    if loan.status not in [LoanStatus.KYC_VERIFIED, LoanStatus.KYC_PENDING]:
        raise ValueError(f"Cannot underwrite loan in {loan.status.value} status")

    logger.info(f"⚙️ Starting underwriting for loan {loan.loan_number} (Amount: {loan.loan_amount})")

    P = loan.loan_amount or 0
    n = loan.tenure_months or 36

    # ── 1. Theoremlabs Credit Score ──
    age = 30
    if loan.date_of_birth:
        age = max(18, (datetime.utcnow() - loan.date_of_birth).days // 365)

    score_result = calculate_credit_score(
        monthly_income=loan.monthly_income or 0,
        existing_emi=loan.existing_emi or 0,
        loan_amount=P,
        tenure_months=n,
        employment_type=loan.employment_type,
        age=age,
    )

    credit_score = score_result["score"]
    interest_rate = score_result["interest_rate"]
    dti = score_result["dti"]

    # ── 1b. Bureau Score (if available) ──
    try:
        kyc_result = await db.execute(
            select(KYCDocument).where(KYCDocument.loan_id == loan.id)
        )
        kyc_doc = kyc_result.scalars().first()
        pan_number = kyc_doc.pan_number if kyc_doc else None

        if pan_number:
            bureau_result = await bureau_service.fetch_score(
                pan_number=pan_number,
                dob=str(loan.date_of_birth) if loan.date_of_birth else "",
                name=user.full_name,
                loan_id=str(loan.id),
                user_id=str(user.id),
                db=db,
            )
            bureau_score_val = bureau_result.get("score")
            if bureau_score_val:
                blended = bureau_service.blend_scores(credit_score, bureau_score_val)
                logger.info(f"📊 Bureau blended score: {credit_score} + {bureau_score_val} → {blended}")
                score_result["score"] = blended
                score_result["bureau_score"] = bureau_score_val
                credit_score = blended
    except Exception as e:
        logger.warning(f"Bureau score fetch skipped: {e}")

    # ── 1c. Apply dynamic rate rules ──
    try:
        score_result = await apply_rate_rules(db, score_result, loan)
        interest_rate = score_result["interest_rate"]
    except Exception as e:
        logger.warning(f"Rate rules skipped: {e}")

    # ── 2. Compute EMI at scored rate ──
    requested_emi = calculate_emi(P, interest_rate, n)

    # ── 3. Evaluate ──
    rejection_reasons = []

    if credit_score < 450:
        rejection_reasons.append(f"Theoremlabs Credit Score ({credit_score}/850) below minimum threshold of 450.")

    full_dti = calculate_dti(loan.monthly_income or 0, loan.existing_emi or 0, requested_emi)
    if full_dti > 0.50:
        rejection_reasons.append(f"DTI ratio ({full_dti*100:.1f}%) exceeds maximum allowable limit of 50%.")

    if (loan.monthly_income or 0) < 15000:
        rejection_reasons.append("Monthly income below minimum required (₹15,000).")

    old_status = loan.status
    loan.credit_score = credit_score
    loan.dti_ratio = round(full_dti, 4)

    if rejection_reasons:
        # ── Check for counter-offer possibility ──
        counter = _calculate_counter_offer(
            monthly_income=loan.monthly_income or 0,
            existing_emi=loan.existing_emi or 0,
            credit_score=credit_score,
            interest_rate=interest_rate,
            tenure_months=n,
        )

        if counter and counter["amount"] >= 50000 and credit_score >= 350:
            # COUNTER OFFER path
            loan.status = LoanStatus.COUNTER_OFFERED
            loan.counter_offer_amount = round(counter["amount"], 2)
            loan.counter_offer_rate = counter["rate"]
            loan.interest_rate = counter["rate"]
            loan.rejection_reason = " | ".join(rejection_reasons)

            # Generate improvement plan
            plan = await generate_improvement_plan(
                loan.rejection_reason, credit_score, full_dti,
                loan.monthly_income or 0, P,
            )
            loan.improvement_plan = plan

            logger.info(f"🔄 Loan {loan.loan_number} COUNTER_OFFERED: ₹{counter['amount']:,.0f} at {counter['rate']}%")

            background_tasks.add_task(
                send_counter_offer_email,
                to_email=user.email,
                name=user.full_name,
                loan_number=loan.loan_number,
                original_amount=P,
                counter_amount=counter["amount"],
                counter_rate=counter["rate"],
                emi_amount=counter["emi"],
            )
        else:
            # FULL REJECTION path
            loan.status = LoanStatus.REJECTED
            loan.rejection_reason = " | ".join(rejection_reasons)
            loan.reapply_reminder_date = datetime.utcnow() + timedelta(days=90)

            # Generate improvement plan
            plan = await generate_improvement_plan(
                loan.rejection_reason, credit_score, full_dti,
                loan.monthly_income or 0, P,
            )
            loan.improvement_plan = plan

            logger.info(f"❌ Loan {loan.loan_number} REJECTED: {loan.rejection_reason}")

            background_tasks.add_task(
                send_rejection_with_plan_email,
                to_email=user.email,
                name=user.full_name,
                loan_number=loan.loan_number,
                reason=loan.rejection_reason,
                improvement_plan=plan,
                reapply_date=(datetime.utcnow() + timedelta(days=90)).strftime("%d %b %Y"),
            )
    else:
        # ── APPROVED ──
        loan.status = LoanStatus.APPROVED
        loan.interest_rate = interest_rate
        loan.approved_amount = P
        loan.emi_amount = requested_emi

        logger.info(f"✅ Loan {loan.loan_number} APPROVED at {interest_rate}% (EMI: ₹{requested_emi})")

        background_tasks.add_task(
            send_approval_email,
            email=user.email,
            full_name=user.full_name,
            loan_number=loan.loan_number,
            loan_amount=P,
            interest_rate=interest_rate,
            emi_amount=requested_emi,
            tenure_months=n,
        )

    # ── Audit Log ──
    audit = AuditLog(
        loan_id=loan.id,
        action="UNDERWRITING_EVALUATION",
        from_status=old_status.value,
        to_status=loan.status.value,
        actor=admin_user_id,
        metadata_={
            "credit_score": credit_score,
            "tier": score_result["tier"],
            "dti": round(full_dti, 4),
            "interest_rate": interest_rate,
            "reasons": rejection_reasons,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(loan)

    return {
        "loan_id": str(loan.id),
        "status": loan.status.value,
        "credit_score": loan.credit_score,
        "credit_tier": score_result["tier"],
        "dti_ratio": loan.dti_ratio,
        "interest_rate": loan.interest_rate,
        "approved_amount": loan.approved_amount,
        "counter_offer_amount": loan.counter_offer_amount,
        "counter_offer_rate": loan.counter_offer_rate,
        "rejection_reason": loan.rejection_reason,
        "improvement_plan": loan.improvement_plan,
        "reapply_reminder_date": str(loan.reapply_reminder_date) if loan.reapply_reminder_date else None,
    }
