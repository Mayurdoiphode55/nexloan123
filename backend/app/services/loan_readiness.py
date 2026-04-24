"""
NexLoan Loan Readiness Score — Pre-Application Scoring
No KYC. No user account needed. Anonymous check.

Score range: 0-100
Components:
  Income:           max 30 points
  Employment:       max 20 points
  DTI:              max 30 points
  Loan-to-Income:   max 20 points
"""

import logging
from app.models.loan import EmploymentType
from app.services.credit_score import calculate_credit_score

logger = logging.getLogger("nexloan.readiness")


def calculate_readiness_score(
    monthly_income: float,
    employment_type: EmploymentType,
    existing_emi: float,
    loan_amount: float,
    tenure_months: int,
) -> dict:
    """
    Returns readiness score 0-100 and estimated offer details.
    No KYC. No user account needed.
    """
    score = 0
    breakdown = {}

    # Income component (max 30 points)
    if monthly_income >= 100000:
        income_score = 30
    elif monthly_income >= 50000:
        income_score = 22
    elif monthly_income >= 30000:
        income_score = 15
    elif monthly_income >= 15000:
        income_score = 8
    else:
        income_score = 0
    score += income_score
    breakdown["income"] = income_score

    # Employment component (max 20 points)
    emp_scores = {
        EmploymentType.SALARIED: 20,
        EmploymentType.BUSINESS: 15,
        EmploymentType.SELF_EMPLOYED: 12,
        EmploymentType.OTHER: 5,
    }
    emp_score = emp_scores.get(employment_type, 5)
    score += emp_score
    breakdown["employment"] = emp_score

    # DTI component (max 30 points)
    dti = existing_emi / monthly_income if monthly_income > 0 else 1
    if dti < 0.10:
        dti_score = 30
    elif dti < 0.20:
        dti_score = 22
    elif dti < 0.35:
        dti_score = 14
    elif dti < 0.50:
        dti_score = 6
    else:
        dti_score = 0
    score += dti_score
    breakdown["dti"] = dti_score

    # Loan-to-income ratio (max 20 points)
    annual_income = monthly_income * 12
    lti = loan_amount / annual_income if annual_income > 0 else 10
    if lti <= 1:
        lti_score = 20
    elif lti <= 2:
        lti_score = 15
    elif lti <= 3:
        lti_score = 8
    elif lti <= 5:
        lti_score = 3
    else:
        lti_score = 0
    score += lti_score
    breakdown["loan_to_income"] = lti_score

    # Estimate what they'd actually get using full credit score engine
    full_score = calculate_credit_score(
        monthly_income, existing_emi, loan_amount,
        tenure_months, employment_type, age=30
    )

    eligible_amount = loan_amount if full_score["is_eligible"] else (
        min(loan_amount, monthly_income * 12 * 2)
        if score >= 40 else 0
    )

    return {
        "readiness_score": score,
        "estimated_amount_min": round(eligible_amount * 0.8, 2),
        "estimated_amount_max": round(eligible_amount, 2),
        "estimated_rate_min": full_score["interest_rate"],
        "estimated_rate_max": round(full_score["interest_rate"] + 2, 2),
        "likely_approved": score >= 60,
        "score_breakdown": breakdown,
        "improvement_tips": _get_tips(breakdown, dti, lti),
    }


def _get_tips(breakdown: dict, dti: float, lti: float) -> list:
    """Generate actionable tips based on score weaknesses."""
    tips = []
    if breakdown["income"] < 15:
        tips.append("Income below ₹30,000/month — consider applying for a smaller amount")
    if dti > 0.35:
        tips.append("Existing EMIs are high — clearing one loan before applying improves approval chances")
    if lti > 3:
        tips.append("Requested amount is high relative to your income — try a lower amount or longer tenure")
    if breakdown["employment"] < 12:
        tips.append("Self-employed or other employment types may face stricter requirements — provide additional income proof")
    return tips
