"""
NexLoan Fraud Detector — Cross-Application Fraud Pattern Detection
Checks: mobile velocity, shared PAN, shared bank account, IP velocity.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, func, cast, String, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import Loan, User, KYCDocument, FraudFlag, Blacklist

logger = logging.getLogger("nexloan.fraud")


async def run_fraud_checks(
    loan: Loan,
    user: User,
    kyc: KYCDocument,
    request_ip: str,
    db: AsyncSession,
) -> list[FraudFlag]:
    """
    Runs all fraud checks after KYC upload.
    Returns list of FraudFlag objects saved to DB.
    """
    flags = []
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # ── Check 1: Mobile velocity ──
    if user.mobile:
        mobile_count = await db.scalar(
            select(func.count(Loan.id))
            .join(User, User.id == Loan.user_id)
            .where(
                User.mobile == user.mobile,
                Loan.created_at >= thirty_days_ago,
            )
        )
        if mobile_count and mobile_count >= 3:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="VELOCITY_MOBILE",
                severity="HIGH",
                description=f"Mobile {user.mobile} has been used in "
                            f"{mobile_count} loan applications in the last 30 days.",
            ))

    # ── Check 2: PAN already used by different user ──
    if kyc and kyc.pan_number:
        other_kyc = await db.execute(
            select(KYCDocument)
            .join(Loan, Loan.id == KYCDocument.loan_id)
            .where(
                KYCDocument.pan_number == kyc.pan_number,
                Loan.user_id != loan.user_id,
            )
        )
        existing_pan = other_kyc.scalars().first()
        if existing_pan:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="SHARED_PAN",
                severity="CRITICAL",
                description=f"PAN {kyc.pan_number} has already been "
                            f"used with a different user account.",
                related_loan_id=existing_pan.loan_id,
            ))

    # ── Check 3: Bank account shared across users ──
    if loan.account_number:
        other_loan = await db.execute(
            select(Loan).where(
                Loan.account_number == loan.account_number,
                Loan.user_id != loan.user_id,
                Loan.status.in_(["ACTIVE", "DISBURSED", "APPROVED"]),
            )
        )
        existing_acct = other_loan.scalars().first()
        if existing_acct:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="SHARED_BANK_ACCOUNT",
                severity="HIGH",
                description=f"Bank account is already linked to a "
                            f"different active loan.",
                related_loan_id=existing_acct.id,
            ))

    # ── Check 4: IP-based velocity ──
    if request_ip:
        ip_count = await db.scalar(
            select(func.count(Loan.id))
            .where(
                Loan.created_at >= now - timedelta(hours=24),
            )
        )
        # Simplified: in real implementation, filter by request_ip in loan_metadata
        if ip_count and ip_count >= 10:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="VELOCITY_DEVICE",
                severity="HIGH",
                description=f"High volume of applications detected in the last 24 hours.",
            ))

    # Save all flags
    for flag in flags:
        db.add(flag)

    if flags:
        logger.warning(f"🚩 {len(flags)} fraud flags raised for loan {loan.loan_number}")

    return flags


async def check_blacklist(
    pan_number: str | None,
    aadhaar_number: str | None,
    mobile: str | None,
    email: str | None,
    db: AsyncSession,
) -> Blacklist | None:
    """Check if any identifier matches the blacklist."""
    conditions = []
    if pan_number:
        conditions.append(
            (Blacklist.identifier_type == "PAN") & (Blacklist.identifier_value == pan_number)
        )
    if aadhaar_number:
        conditions.append(
            (Blacklist.identifier_type == "AADHAAR") & (Blacklist.identifier_value == aadhaar_number)
        )
    if mobile:
        conditions.append(
            (Blacklist.identifier_type == "MOBILE") & (Blacklist.identifier_value == mobile)
        )
    if email:
        conditions.append(
            (Blacklist.identifier_type == "EMAIL") & (Blacklist.identifier_value == email)
        )

    if not conditions:
        return None

    result = await db.execute(
        select(Blacklist).where(
            Blacklist.is_active == True,
            or_(*conditions),
        )
    )
    return result.scalars().first()
