"""
NexLoan Credit Score Service — Theoremlabs Credit Score Algorithm
Proprietary scoring logic. NOT CIBIL. NOT Experian.

Scoring Components (max 850):
  Income stability:    0-200
  DTI health:          0-250
  Employment quality:  0-150
  Tenure fit:          0-100
  Loan-to-Income:      0-150
"""

import logging
from app.models.loan import EmploymentType

logger = logging.getLogger("nexloan.credit_score")


def calculate_credit_score(
    monthly_income: float,
    existing_emi: float,
    loan_amount: float,
    tenure_months: int,
    employment_type: EmploymentType,
    age: int = 30,
) -> dict:
    """
    Theoremlabs Credit Score — deterministic, auditable, no external bureau.

    Returns:
        dict with score (0-850), tier (A-F), is_eligible, interest_rate, breakdown
    """
    breakdown = {}
    score = 0

    # ── Component 1: Income Stability (max 200) ──
    if monthly_income >= 100000:
        income_pts = 200
    elif monthly_income >= 75000:
        income_pts = 170
    elif monthly_income >= 50000:
        income_pts = 140
    elif monthly_income >= 30000:
        income_pts = 100
    elif monthly_income >= 15000:
        income_pts = 60
    else:
        income_pts = 20
    score += income_pts
    breakdown["income_stability"] = income_pts

    # ── Component 2: DTI Health (max 250) ──
    dti = existing_emi / monthly_income if monthly_income > 0 else 1.0
    if dti < 0.10:
        dti_pts = 250
    elif dti < 0.20:
        dti_pts = 200
    elif dti < 0.30:
        dti_pts = 150
    elif dti < 0.40:
        dti_pts = 90
    elif dti < 0.50:
        dti_pts = 40
    else:
        dti_pts = 0
    score += dti_pts
    breakdown["dti_health"] = dti_pts

    # ── Component 3: Employment Quality (max 150) ──
    emp_map = {
        EmploymentType.SALARIED: 150,
        EmploymentType.BUSINESS: 120,
        EmploymentType.SELF_EMPLOYED: 90,
        EmploymentType.OTHER: 40,
    }
    emp_pts = emp_map.get(employment_type, 40)
    score += emp_pts
    breakdown["employment_quality"] = emp_pts

    # ── Component 4: Tenure Fit (max 100) ──
    # Sweet spot: 12-36 months. Too short or too long is penalized.
    if 12 <= tenure_months <= 36:
        tenure_pts = 100
    elif tenure_months <= 48:
        tenure_pts = 75
    elif tenure_months <= 60:
        tenure_pts = 50
    else:
        tenure_pts = 25
    score += tenure_pts
    breakdown["tenure_fit"] = tenure_pts

    # ── Component 5: Loan-to-Income Ratio (max 150) ──
    annual_income = monthly_income * 12
    lti = loan_amount / annual_income if annual_income > 0 else 10
    if lti <= 1:
        lti_pts = 150
    elif lti <= 2:
        lti_pts = 120
    elif lti <= 3:
        lti_pts = 80
    elif lti <= 5:
        lti_pts = 30
    else:
        lti_pts = 0
    score += lti_pts
    breakdown["loan_to_income"] = lti_pts

    # ── Tier Classification ──
    if score >= 750:
        tier = "A"
    elif score >= 650:
        tier = "B"
    elif score >= 550:
        tier = "C"
    elif score >= 450:
        tier = "D"
    elif score >= 350:
        tier = "E"
    else:
        tier = "F"

    # ── Interest Rate from Tier ──
    rate_map = {"A": 10.5, "B": 12.0, "C": 14.5, "D": 17.0, "E": 20.0, "F": 24.0}
    interest_rate = rate_map[tier]

    # DTI surcharge
    if dti > 0.35:
        interest_rate += 1.5
    elif dti > 0.25:
        interest_rate += 0.5

    interest_rate = round(min(interest_rate, 24.0), 2)

    # ── Eligibility ──
    is_eligible = score >= 450 and dti < 0.50 and monthly_income >= 15000

    logger.info(f"📊 Theoremlabs Score: {score}/850 | Tier: {tier} | Rate: {interest_rate}% | Eligible: {is_eligible}")

    return {
        "score": score,
        "tier": tier,
        "is_eligible": is_eligible,
        "interest_rate": interest_rate,
        "dti": round(dti, 4),
        "breakdown": breakdown,
    }


from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.loan import RateRule, Loan
from datetime import datetime

async def apply_rate_rules(
    db: AsyncSession,
    score_result: dict,
    loan: Loan
) -> dict:
    """
    Applies dynamic rate rules (overrides or adjustments) based on loan properties.
    Rules are evaluated in order of priority (highest first).
    """
    if not score_result.get("is_eligible"):
        return score_result

    now = datetime.utcnow()
    
    # Fetch active rules, ordered by priority DESC
    stmt = select(RateRule).where(
        RateRule.is_active == True,
    ).order_by(RateRule.priority.desc())
    
    result = await db.execute(stmt)
    rules = result.scalars().all()
    
    base_rate = score_result["interest_rate"]
    final_rate = base_rate
    applied_rules = []
    
    for rule in rules:
        # Check conditions
        match = True
        
        if rule.condition_loan_purpose and rule.condition_loan_purpose.lower() != str(loan.purpose).lower():
            match = False
        
        if match and rule.condition_score_min is not None and score_result["score"] < rule.condition_score_min:
            match = False
            
        if match and rule.condition_score_max is not None and score_result["score"] > rule.condition_score_max:
            match = False
            
        if match and rule.condition_amount_min is not None and loan.loan_amount < rule.condition_amount_min:
            match = False
            
        if match and rule.condition_amount_max is not None and loan.loan_amount > rule.condition_amount_max:
            match = False
            
        if match and rule.condition_valid_from and now < rule.condition_valid_from:
            match = False
            
        if match and rule.condition_valid_until and now > rule.condition_valid_until:
            match = False
            
        if match:
            # Apply rule
            applied_rules.append(rule.name)
            if rule.rate_override is not None:
                final_rate = rule.rate_override
                # If it's an override, we typically stop processing further adjustments (highest priority wins)
                break
            elif rule.rate_adjustment is not None:
                final_rate += rule.rate_adjustment
                
    if applied_rules:
        # Ensure we don't drop below 0 or go insanely high
        final_rate = max(1.0, min(final_rate, 36.0))
        score_result["interest_rate"] = round(final_rate, 2)
        score_result["applied_rate_rules"] = applied_rules
        logger.info(f"📈 Applied rate rules {applied_rules} to loan {loan.loan_number}. New rate: {score_result['interest_rate']}%")
        
    return score_result

