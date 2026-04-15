"""
NexLoan Underwriting Engine
A rule-based automated decision engine for personal loans.
"""
import logging
import random
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks

from app.models.loan import Loan, LoanStatus, AuditLog, User
from app.services.email_service import send_approval_email, send_rejection_email

logger = logging.getLogger("nexloan.underwriting")


async def mock_credit_bureau(pan_number: str) -> int:
    """
    Mocks an external call to CIBIL/Experian.
    Returns a credit score between 300 and 900.
    In a real system, this would make an HTTP request to a bureau API.
    """
    # Deterministic mock based on PAN for testing stability, or entirely random.
    # To keep testing fun, we'll randomize between 600 and 850
    return random.randint(600, 850)


def calculate_dti(monthly_income: float, existing_emi: float, requested_emi: float) -> float:
    """
    Calculates Debt-to-Income (DTI) ratio.
    """
    if monthly_income <= 0:
        return 1.0 # 100%
    return (existing_emi + requested_emi) / monthly_income


def determine_interest_rate(credit_score: int, dti: float) -> float:
    """
    Basic risk-based pricing matrix.
    Base rate: 12.0%
    Credit Score premium/discount: -2.0% to +5.0%
    DTI premium: up to +3.0%
    """
    base_rate = 12.0
    
    # Analyze credit score
    if credit_score >= 800:
        base_rate -= 2.0
    elif credit_score >= 750:
        base_rate -= 1.0
    elif credit_score >= 700:
        base_rate += 1.5
    else:
        base_rate += 4.0
        
    # Analyze DTI
    if dti > 0.4:
        base_rate += 3.0
    elif dti > 0.3:
        base_rate += 1.5
        
    return round(min(max(base_rate, 10.0), 24.0), 2)


async def evaluate_loan(db: AsyncSession, loan_id: str, admin_user_id: str, background_tasks: BackgroundTasks) -> dict:
    """
    Core underwriting evaluation function.
    Reads loan data, computes metrics, and decides outcome.
    Changes status to APPROVED or REJECTED.
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
        
    # Validation gates before underwriting
    if loan.status not in [LoanStatus.KYC_VERIFIED, LoanStatus.KYC_PENDING]:
        raise ValueError(f"Cannot underwrite loan in {loan.status.value} status")
        
    logger.info(f"⚙️ Starting underwriting for loan {loan.loan_number} (Amount: {loan.loan_amount})")
    
    # 1. Fetch Credit Score
    # We ideally get the PAN from the KYCDocument, but we'll use a placeholder if missing.
    credit_score = await mock_credit_bureau("MOCKPAN123")
    
    # 2. Compute Requested EMI (estimate using a generic 15% rate)
    P = loan.loan_amount or 0
    r = 15 / (12 * 100)
    n = loan.tenure_months or 36
    requested_emi = (P * r * (1 + r)**n) / ((1 + r)**n - 1)
    
    # 3. Calculate DTI
    dti = calculate_dti(
        monthly_income=loan.monthly_income or 0,
        existing_emi=loan.existing_emi or 0,
        requested_emi=requested_emi
    )
    
    rejection_reasons = []
    
    # 4. Apply Rules
    if credit_score < 650:
        rejection_reasons.append(f"Credit score ({credit_score}) below minimum threshold of 650.")
        
    if dti > 0.5:
        rejection_reasons.append(f"DTI ratio ({dti*100:.1f}%) exceeds maximum allowable policy of 50%.")
        
    if (loan.monthly_income or 0) < 15000:
        rejection_reasons.append("Monthly income below minimum required (₹15,000).")
        
    # 5. Decide Outcome
    old_status = loan.status
    
    if rejection_reasons:
        loan.status = LoanStatus.REJECTED
        loan.rejection_reason = " | ".join(rejection_reasons)
        loan.credit_score = credit_score
        loan.dti_ratio = round(dti, 4)
        
        logger.info(f"❌ Loan {loan.loan_number} REJECTED: {loan.rejection_reason}")
        
        # Send rejection email in background
        background_tasks.add_task(
            send_rejection_email,
            email=user.email,
            full_name=user.full_name,
            loan_number=loan.loan_number,
            reason=loan.rejection_reason
        )
    else:
        # Calculate final terms
        final_rate = determine_interest_rate(credit_score, dti)
        
        loan.status = LoanStatus.APPROVED
        loan.credit_score = credit_score
        loan.dti_ratio = round(dti, 4)
        loan.interest_rate = final_rate
        loan.approved_amount = loan.loan_amount # fully approve requested amount
        
        # Calculate actual exact EMI for the finalized terms
        final_r = final_rate / (12 * 100)
        final_emi = (P * final_r * (1 + final_r)**n) / ((1 + final_r)**n - 1)
        loan.emi_amount = round(final_emi, 2)
        
        logger.info(f"✅ Loan {loan.loan_number} APPROVED at {final_rate}% (EMI: ₹{loan.emi_amount})")
        
        # Send approval email in background
        background_tasks.add_task(
            send_approval_email,
            email=user.email,
            full_name=user.full_name,
            loan_number=loan.loan_number,
            loan_amount=loan.approved_amount,
            interest_rate=loan.interest_rate,
            emi_amount=loan.emi_amount,
            tenure_months=loan.tenure_months
        )
        
    # 6. Save Audit Log
    audit = AuditLog(
        loan_id=loan.id,
        action="UNDERWRITING_EVALUATION",
        from_status=old_status.value,
        to_status=loan.status.value,
        actor=admin_user_id,
        metadata_={
            "credit_score": credit_score,
            "dti": round(dti, 4),
            "reasons": rejection_reasons
        }
    )
    
    db.add(audit)
    await db.commit()
    await db.refresh(loan)
    
    return {
        "loan_id": str(loan.id),
        "status": loan.status.value,
        "credit_score": loan.credit_score,
        "dti_ratio": loan.dti_ratio,
        "interest_rate": loan.interest_rate,
        "approved_amount": loan.approved_amount,
        "rejection_reason": loan.rejection_reason
    }
