"""
NexLoan Database Models — SQLAlchemy 2.0 Declarative Syntax
All models, enums, and table definitions per Section 6 of the spec.
"""

import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


# ─── Enums ──────────────────────────────────────────────────────────────────────


class LoanStatus(str, PyEnum):
    """Loan state machine — transitions enforced at the API layer."""
    INQUIRY = "INQUIRY"
    APPLICATION = "APPLICATION"
    KYC_PENDING = "KYC_PENDING"
    KYC_VERIFIED = "KYC_VERIFIED"
    UNDERWRITING = "UNDERWRITING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COUNTER_OFFERED = "COUNTER_OFFERED"
    DISBURSED = "DISBURSED"
    ACTIVE = "ACTIVE"
    PRE_CLOSED = "PRE_CLOSED"
    CLOSED = "CLOSED"


class PaymentStatus(str, PyEnum):
    """EMI payment status."""
    PENDING = "PENDING"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    PAUSED = "PAUSED"


class EmploymentType(str, PyEnum):
    """Applicant employment classification."""
    SALARIED = "SALARIED"
    SELF_EMPLOYED = "SELF_EMPLOYED"
    BUSINESS = "BUSINESS"
    OTHER = "OTHER"


class UserRole(str, PyEnum):
    """User roles for access control (RBAC)."""
    BORROWER = "BORROWER"
    LOAN_OFFICER = "LOAN_OFFICER"
    VERIFIER = "VERIFIER"
    UNDERWRITER = "UNDERWRITER"
    ADMIN = "ADMIN"
    SUPER_ADMIN = "SUPER_ADMIN"
    AGENT = "AGENT"


# ─── Models ─────────────────────────────────────────────────────────────────────


class User(Base):
    """Registered users — authenticated via OTP, no passwords."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    mobile = Column(String(15), unique=True, nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    role = Column(String(20), default=UserRole.BORROWER.value, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Phase 2 — Employee department tracking
    department = Column(String(100), nullable=True)       # e.g., Retail Lending, Collections
    branch_location = Column(String(255), nullable=True)  # e.g., Mumbai HQ, Delhi Branch
    employee_id = Column(String(50), nullable=True)       # Internal employee ID
    reporting_manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Phase 5 — Referral reward balance
    reward_balance = Column(Float, default=0.0)

    # Relationships
    loans = relationship("Loan", back_populates="user", lazy="noload")
    reporting_manager = relationship("User", remote_side=[id], foreign_keys=[reporting_manager_id])


class Loan(Base):
    """
    Core loan record — tracks the full lifecycle from inquiry to closure.
    Loan number format: NL-YYYY-NNNNN (e.g., NL-2024-00001)
    """
    __tablename__ = "loans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    loan_number = Column(String(20), unique=True, nullable=False, index=True)
    status = Column(Enum(LoanStatus), nullable=False, default=LoanStatus.INQUIRY)

    # Loan application details
    loan_amount = Column(Float, nullable=True)
    tenure_months = Column(Integer, nullable=True)
    purpose = Column(String(100), nullable=True)
    monthly_income = Column(Float, nullable=True)
    employment_type = Column(Enum(EmploymentType), nullable=True)
    existing_emi = Column(Float, default=0.0)
    date_of_birth = Column(DateTime, nullable=True)
    gender = Column(String(20), nullable=True)

    # Phase 2 — Collateral loan fields
    loan_type = Column(String(20), default="NON_COLLATERAL", nullable=False)  # COLLATERAL | NON_COLLATERAL
    collateral_type = Column(String(50), nullable=True)       # GOLD, PROPERTY, VEHICLE, FIXED_DEPOSIT
    collateral_value = Column(Float, nullable=True)
    collateral_description = Column(Text, nullable=True)
    lien_document_url = Column(String(500), nullable=True)
    collateral_verified = Column(Boolean, default=False, nullable=True)
    collateral_verified_by = Column(UUID(as_uuid=True), nullable=True)  # no FK to avoid mapper conflict

    # Underwriting results
    credit_score = Column(Integer, nullable=True)
    interest_rate = Column(Float, nullable=True)
    dti_ratio = Column(Float, nullable=True)
    approved_amount = Column(Float, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    emi_amount = Column(Float, nullable=True)

    # Counter-offer fields (v2.0)
    counter_offer_amount = Column(Float, nullable=True)
    counter_offer_rate = Column(Float, nullable=True)
    counter_accepted = Column(Boolean, nullable=True)
    improvement_plan = Column(Text, nullable=True)
    readiness_score = Column(Integer, nullable=True)

    # EMI pause tracking (v2.0)
    emi_pauses_used = Column(Integer, default=0, nullable=False)

    # Disbursement details
    disbursed_at = Column(DateTime, nullable=True)
    disbursed_amount = Column(Float, nullable=True)
    account_number = Column(String(20), nullable=True)

    # Closure details
    closed_at = Column(DateTime, nullable=True)
    preclosure_charge = Column(Float, nullable=True)
    total_paid = Column(Float, default=0.0)
    no_dues_sent = Column(Boolean, default=False)
    closure_celebration_sent = Column(Boolean, default=False)

    # Reapply tracking (v2.0)
    reapply_reminder_date = Column(DateTime, nullable=True)

    # Phase 3 — Officer decision tracking
    officer_override_reason = Column(Text, nullable=True)  # Reason when officer overrides AI
    ai_recommendation = Column(String(20), nullable=True)   # APPROVE/REJECT — what AI said
    officer_decision = Column(String(20), nullable=True)     # APPROVE/REJECT — what officer decided

    # Phase 5 — Top-up loan fields
    is_topup = Column(Boolean, default=False)
    parent_loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    topup_previous_outstanding = Column(Float, nullable=True)

    # Phase 5 — Agent/DSA sourcing
    sourced_by_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", use_alter=True), nullable=True)

    # Phase 5 — Request metadata
    metadata_ = Column("loan_metadata", JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="loans")
    kyc_document = relationship("KYCDocument", back_populates="loan", uselist=False, lazy="selectin")
    emi_schedule = relationship("EMISchedule", back_populates="loan", lazy="selectin", order_by="EMISchedule.installment_no")
    audit_logs = relationship("AuditLog", back_populates="loan", lazy="selectin", order_by="AuditLog.created_at.desc()")
    officer_assignments = relationship("OfficerAssignment", back_populates="loan", lazy="selectin")
    loan_notes = relationship("LoanNote", back_populates="loan", lazy="selectin", order_by="LoanNote.created_at.desc()")
    parent_loan = relationship("Loan", remote_side=[id], foreign_keys=[parent_loan_id])


class KYCDocument(Base):
    """
    KYC verification records — one per loan.
    Stores AI verification results for PAN and Aadhaar documents.
    """
    __tablename__ = "kyc_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), unique=True, nullable=False, index=True)

    # PAN document
    pan_doc_url = Column(String(500), nullable=True)
    pan_number = Column(String(30), nullable=True)
    pan_name_extracted = Column(String(255), nullable=True)
    pan_legible = Column(Boolean, nullable=True)
    pan_name_match = Column(Boolean, nullable=True)

    # Aadhaar document
    aadhaar_doc_url = Column(String(500), nullable=True)
    aadhaar_number = Column(String(50), nullable=True)
    aadhaar_name_extracted = Column(String(255), nullable=True)
    aadhaar_legible = Column(Boolean, nullable=True)
    aadhaar_photo_present = Column(Boolean, nullable=True)

    # AI verdict
    ai_verdict = Column(String(20), nullable=True)  # PASS, FAIL, MANUAL_REVIEW
    ai_remarks = Column(Text, nullable=True)
    ai_raw_response = Column(JSON, nullable=True)

    # Timestamps
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    loan = relationship("Loan", back_populates="kyc_document")


class EMISchedule(Base):
    """
    Individual EMI installment records — one row per month.
    Generated at disbursement using the reducing-balance formula.
    """
    __tablename__ = "emi_schedule"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)

    installment_no = Column(Integer, nullable=False)
    due_date = Column(DateTime, nullable=False)
    emi_amount = Column(Float, nullable=False)
    principal = Column(Float, nullable=False)
    interest = Column(Float, nullable=False)
    outstanding_balance = Column(Float, nullable=False)

    # Payment tracking
    status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    paid_at = Column(DateTime, nullable=True)
    paid_amount = Column(Float, nullable=True)
    pause_reason = Column(String(255), nullable=True)

    # Relationships
    loan = relationship("Loan", back_populates="emi_schedule")

    # Unique constraint: one installment number per loan
    __table_args__ = (
        UniqueConstraint("loan_id", "installment_no", name="uq_loan_installment"),
    )


class AuditLog(Base):
    """
    Immutable audit trail — every loan state transition is logged here.
    Never delete audit log entries.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)

    action = Column(String(100), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    actor = Column(String(100), nullable=False)  # user_id or "system"
    metadata_ = Column("metadata", JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    loan = relationship("Loan", back_populates="audit_logs")


class LoanReadinessCheck(Base):
    """
    Anonymous loan readiness checks — no user account required.
    Stores pre-application scoring results for conversion tracking.
    """
    __tablename__ = "loan_readiness_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), nullable=False, index=True)
    monthly_income = Column(Float, nullable=False)
    employment_type = Column(Enum(EmploymentType), nullable=False)
    existing_emi = Column(Float, nullable=False, default=0.0)
    loan_amount = Column(Float, nullable=False)
    tenure_months = Column(Integer, nullable=False)
    readiness_score = Column(Integer, nullable=False)
    estimated_amount = Column(Float, nullable=True)
    estimated_rate = Column(Float, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LoanMilestone(Base):
    """
    Application tracking milestones — one per loan lifecycle event.
    Provides a borrower-facing timeline of where their loan is.
    """
    __tablename__ = "loan_milestones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)

    milestone = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # DONE, CURRENT, PENDING
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DocumentStatusRecord(Base):
    """
    Tracks verification status of individual KYC documents.
    Used for the document tracker on the /track page.
    """
    __tablename__ = "document_statuses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)

    document_type = Column(String(50), nullable=False)  # PAN, AADHAAR
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, VERIFIED, FAILED
    verified_at = Column(DateTime, nullable=True)
    notes = Column(String(500), nullable=True)


# ─── Phase 2 Models ────────────────────────────────────────────────────────────


class SupportTicket(Base):
    """Support tickets raised by borrowers."""
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(20), default="OPEN", nullable=False)  # OPEN, IN_PROGRESS, RESOLVED, CLOSED
    priority = Column(String(20), default="NORMAL", nullable=False)  # LOW, NORMAL, HIGH, URGENT
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TicketMessage(Base):
    """Messages within a support ticket thread."""
    __tablename__ = "ticket_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(UUID(as_uuid=True), ForeignKey("support_tickets.id"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sender_role = Column(String(20), nullable=False)  # BORROWER, LOAN_OFFICER, ADMIN
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Referral(Base):
    """Referral tracking — refer & earn system."""
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    referral_code = Column(String(50), unique=True, nullable=False)
    referred_email = Column(String(255), nullable=True)
    referred_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, SIGNED_UP, LOAN_APPROVED, REWARDED
    reward_amount = Column(Float, default=500.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatMessage(Base):
    """Persistent chat messages for AI memory."""
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ChatMemorySummary(Base):
    """Compressed summary of old chat messages for long-term memory."""
    __tablename__ = "chat_memory_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    summary = Column(Text, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)
    messages_summarized = Column(Integer, default=0)


# ─── Phase 3 Models ────────────────────────────────────────────────────────────


class LoanNote(Base):
    """Internal notes added by loan officers on a loan application."""
    __tablename__ = "loan_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)
    officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=True)  # True = only officers/admins see this
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    loan = relationship("Loan", back_populates="loan_notes")
    officer = relationship("User", foreign_keys=[officer_id])


class OfficerAssignment(Base):
    """Tracks which loan officer is assigned to review a loan."""
    __tablename__ = "officer_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)
    officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="ACTIVE", nullable=False)  # ACTIVE, COMPLETED, REASSIGNED

    # Relationships
    loan = relationship("Loan", back_populates="officer_assignments")
    officer = relationship("User", foreign_keys=[officer_id])


class DocumentRequest(Base):
    """Requests for additional documents from the borrower, created by officers."""
    __tablename__ = "document_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    document_type = Column(String(100), nullable=False)  # e.g., "Bank Statement", "Salary Slip"
    reason = Column(String(500), nullable=True)
    status = Column(String(20), default="REQUESTED", nullable=False)  # REQUESTED, UPLOADED, VERIFIED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    officer = relationship("User", foreign_keys=[requested_by])


# ─── Phase 4 Models ────────────────────────────────────────────────────────────


class CoApplicant(Base):
    """Co-applicant details for joint loan applications."""
    __tablename__ = "co_applicants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)

    full_name = Column(String(255), nullable=False)
    relationship = Column(String(50), nullable=False)   # SPOUSE, PARENT, SIBLING, OTHER
    phone = Column(String(15), nullable=False)
    email = Column(String(255), nullable=True)

    monthly_income = Column(Float, nullable=False)
    employment_type = Column(Enum(EmploymentType), nullable=True)
    existing_emi = Column(Float, default=0.0)

    pan_number = Column(String(20), nullable=True)
    individual_credit_score = Column(Integer, nullable=True)
    individual_score_breakdown = Column(JSON, nullable=True)

    consent_given = Column(Boolean, default=False)
    consent_timestamp = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CoApplicantKYC(Base):
    """KYC documents for co-applicant."""
    __tablename__ = "co_applicant_kyc"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    co_applicant_id = Column(UUID(as_uuid=True), ForeignKey("co_applicants.id"), nullable=False, index=True)
    document_type = Column(String(20), nullable=False)   # PAN, AADHAAR
    file_url = Column(String(500), nullable=False)
    verification_status = Column(String(20), default="PENDING")
    extracted_data = Column(JSON, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    verified_at = Column(DateTime, nullable=True)


class Payment(Base):
    """Razorpay payment records for EMI payments."""
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    emi_installment_no = Column(Integer, nullable=False)

    razorpay_order_id = Column(String(100), nullable=True, unique=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    razorpay_signature = Column(String(256), nullable=True)

    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="INR")
    status = Column(String(20), default="CREATED")  # CREATED, CAPTURED, FAILED
    method = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


# ─── Phase 5 Models — Notifications & Callbacks ────────────────────────────────


class Notification(Base):
    """In-app notifications for users — EMI reminders, loan updates, etc."""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id", ondelete="CASCADE"), nullable=True)

    type = Column(String(50), nullable=False)  # emi_reminder, emi_paid, loan_approved, etc.
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CallbackRequest(Base):
    """Callback requests from borrowers — support team calls them back."""
    __tablename__ = "callback_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)

    phone_number = Column(String(15), nullable=False)
    preferred_slot = Column(String(50), nullable=False)  # 'morning' | 'afternoon' | 'evening'
    status = Column(String(20), default="pending", nullable=False)  # pending, scheduled, completed
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Phase 2 Enterprise Models ──────────────────────────────────────────────


class PreClosureRequest(Base):
    """Pre-closure request with tokenized 24-hour link for settlement."""
    __tablename__ = "pre_closure_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    token = Column(String(128), unique=True, nullable=False)         # secure random token
    token_expires_at = Column(DateTime, nullable=False)               # NOW() + 24 hours
    outstanding_principal = Column(Float, nullable=False)
    pre_closure_charge_percent = Column(Float, nullable=False, default=2.0)
    pre_closure_charge = Column(Float, nullable=False)
    total_settlement_amount = Column(Float, nullable=False)
    terms_accepted = Column(Boolean, default=False)
    terms_accepted_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="PENDING", nullable=False)    # PENDING | ACCEPTED | EXPIRED | COMPLETED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    loan = relationship("Loan")
    user = relationship("User")


class AdminDelegation(Base):
    """Admin delegation — temporary permission transfer between admins."""
    __tablename__ = "admin_delegations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    delegator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)   # Admin A
    delegate_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)    # Admin B
    delegated_permissions = Column(JSON, nullable=True)       # list of permissions granted
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    delegator = relationship("User", foreign_keys=[delegator_id])
    delegate = relationship("User", foreign_keys=[delegate_id])


class LoanEnquiry(Base):
    """Public or authenticated loan service enquiry before formal application."""
    __tablename__ = "loan_enquiries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(255), nullable=False)
    mobile = Column(String(15), nullable=False)
    email = Column(String(255), nullable=True)
    loan_type = Column(String(50), nullable=True)              # PERSONAL, COLLATERAL, etc.
    approx_amount = Column(Float, nullable=True)
    message = Column(Text, nullable=True)
    status = Column(String(20), default="NEW", nullable=False)  # NEW | CLAIMED | RESPONDED | CONVERTED
    claimed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    converted_loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    officer = relationship("User", foreign_keys=[claimed_by])


class Announcement(Base):
    """Tenant announcements displayed on the borrower dashboard."""
    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    author = relationship("User", foreign_keys=[created_by])


# ─── Phase 4 (prompt4.md) Models ────────────────────────────────────────────


class TenantConfig(Base):
    """White-label tenant configuration — one row per deployment."""
    __tablename__ = "tenant_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Identity
    tenant_id = Column(String(50), unique=True, nullable=False)
    client_name = Column(String(200), nullable=False)
    # Branding
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    primary_color = Column(String(7), default="#1A1A2E")
    secondary_color = Column(String(7), default="#F5F5F5")
    font_family = Column(String(100), default="Inter")
    tagline = Column(String(300))
    # Contact & Legal
    support_email = Column(String(200))
    support_phone = Column(String(20))
    website_url = Column(String(300))
    terms_url = Column(String(300))
    privacy_url = Column(String(300))
    registered_name = Column(String(300))
    rbi_registration = Column(String(100))
    # Email Branding
    email_from_name = Column(String(200))
    email_from_address = Column(String(200))
    email_header_color = Column(String(7), default="#1A1A2E")
    email_logo_url = Column(String(500))
    # Feature Flags
    feature_preclosure = Column(Boolean, default=True)
    feature_emi_pause = Column(Boolean, default=True)
    feature_loan_comparison = Column(Boolean, default=True)
    feature_collateral_loans = Column(Boolean, default=False)
    feature_multi_language = Column(Boolean, default=False)
    feature_support_chat = Column(Boolean, default=True)
    # Financial Config
    default_preclosure_rate = Column(Float, default=2.0)
    preclosure_free_months = Column(Integer, default=6)
    preclosure_early_charge_rate = Column(Float, default=10.0)
    preclosure_link_validity_hours = Column(Integer, default=24)
    max_loan_amount = Column(Float, default=2500000)
    min_loan_amount = Column(Float, default=50000)
    max_tenure_months = Column(Integer, default=60)
    min_tenure_months = Column(Integer, default=12)
    # Announcement / Media
    announcement_text = Column(Text)
    announcement_active = Column(Boolean, default=False)
    announcement_color = Column(String(7), default="#F59E0B")
    # Collateral Policy (JSON)
    collateral_policy = Column(JSON, default={})
    # Department Config (JSON)
    departments = Column(JSON, default=[])
    # Verification Parameters (JSON)
    verification_parameters = Column(JSON, default={
        "require_pan": True,
        "require_aadhaar": True,
        "require_salary_slip": False,
        "require_bank_statement": False,
        "require_itr": False,
        "require_form_16": False,
        "min_ai_confidence": 0.6,
        "allow_manual_override": True,
        "override_requires_reason": True,
    })
    # Auto statements
    auto_monthly_statement = Column(Boolean, default=False)

    # Phase 5 — Bureau Integration
    bureau_mode = Column(String(20), default="simulated")
    bureau_weight = Column(Float, default=0.4)
    bureau_api_key = Column(String(500), nullable=True)
    bureau_enabled = Column(Boolean, default=False)

    # Phase 5 — Referral reward config
    referral_reward_amount = Column(Float, default=500.0)

    # Phase 5 — Benchmark reports
    benchmark_report_email = Column(String(200), nullable=True)
    benchmark_report_enabled = Column(Boolean, default=True)
    benchmark_report_day = Column(Integer, default=1)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmployeeHistory(Base):
    """Tracks department/role changes for employee users."""
    __tablename__ = "employee_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # DEPARTMENT_CHANGE, ROLE_CHANGE, DEACTIVATED, REACTIVATED
    old_value = Column(String(200))
    new_value = Column(String(200))
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])
    changed_by_user = relationship("User", foreign_keys=[changed_by])


class ServiceEnquiry(Base):
    """Public loan service enquiry — no login required."""
    __tablename__ = "service_enquiries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False)
    mobile = Column(String(15), nullable=False)
    loan_type_interest = Column(String(100))
    loan_amount_range = Column(String(50))
    message = Column(Text)
    status = Column(String(20), default="NEW")  # NEW, CONTACTED, CONVERTED, CLOSED
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    officer = relationship("User", foreign_keys=[assigned_to])


# ─── Phase 5 Models — Revenue, Risk, Operations & Analytics ────────────────────


class RateRule(Base):
    """Dynamic interest rate rules — evaluated during underwriting."""
    __tablename__ = "rate_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)

    # Conditions (all must match for the rule to apply)
    condition_loan_purpose = Column(String(100), nullable=True)
    condition_score_min = Column(Integer, nullable=True)
    condition_score_max = Column(Integer, nullable=True)
    condition_amount_min = Column(Float, nullable=True)
    condition_amount_max = Column(Float, nullable=True)
    condition_channel = Column(String(50), nullable=True)
    condition_valid_from = Column(DateTime, nullable=True)
    condition_valid_until = Column(DateTime, nullable=True)

    # Rate Adjustment
    rate_override = Column(Float, nullable=True)
    rate_adjustment = Column(Float, nullable=True)

    # Metadata
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Offer(Base):
    """Cross-sell / upsell offers generated for borrowers."""
    __tablename__ = "offers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    offer_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    offered_amount = Column(Float, nullable=True)
    offered_rate = Column(Float, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    status = Column(String(20), default="PENDING")
    triggered_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)


class ReferralCode(Base):
    """User-specific referral codes for refer & earn."""
    __tablename__ = "referral_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    code = Column(String(20), unique=True, nullable=False)
    total_referrals = Column(Integer, default=0)
    successful_referrals = Column(Integer, default=0)
    total_reward_earned = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)


class BureauScore(Base):
    """Credit bureau score records — simulated or real."""
    __tablename__ = "bureau_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    bureau_name = Column(String(50), nullable=False)
    bureau_score = Column(Integer, nullable=False)
    bureau_report = Column(JSON, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    is_simulated = Column(Boolean, default=True)


class FraudFlag(Base):
    """Cross-application fraud pattern detection flags."""
    __tablename__ = "fraud_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    flag_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="MEDIUM")
    description = Column(Text, nullable=False)
    related_loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Blacklist(Base):
    """Blacklisted identifiers — PAN, Aadhaar, mobile, etc."""
    __tablename__ = "blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    identifier_type = Column(String(30), nullable=False)
    identifier_value = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    added_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CollectionsCase(Base):
    """Collections case for overdue loans."""
    __tablename__ = "collections_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    days_past_due = Column(Integer, default=0)
    overdue_amount = Column(Float, default=0.0)
    overdue_installments = Column(Integer, default=0)
    dpd_bucket = Column(String(20), default="CURRENT")

    status = Column(String(30), default="OPEN")
    settlement_offered = Column(Boolean, default=False)
    settlement_amount = Column(Float, nullable=True)
    settlement_discount_pct = Column(Float, nullable=True)
    settlement_valid_until = Column(DateTime, nullable=True)
    settlement_accepted = Column(Boolean, nullable=True)

    legal_notice_sent = Column(Boolean, default=False)
    legal_notice_date = Column(DateTime, nullable=True)

    opened_at = Column(DateTime, default=datetime.utcnow)
    last_contact_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)


class CollectionsActivity(Base):
    """Activity log for collections cases."""
    __tablename__ = "collections_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("collections_cases.id"), nullable=False)
    activity_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    performed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Agent(Base):
    """DSA (Direct Selling Agent) records."""
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    agent_code = Column(String(20), unique=True, nullable=False)
    agency_name = Column(String(200), nullable=True)
    commission_rate_pct = Column(Float, default=1.0)
    total_applications = Column(Integer, default=0)
    total_disbursed = Column(Integer, default=0)
    total_commission_earned = Column(Float, default=0.0)
    total_commission_paid = Column(Float, default=0.0)
    kyc_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    registered_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class AgentCommission(Base):
    """Commission tracking per loan disbursement for agents."""
    __tablename__ = "agent_commissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False)
    disbursed_amount = Column(Float, nullable=False)
    commission_rate = Column(Float, nullable=False)
    commission_amount = Column(Float, nullable=False)
    status = Column(String(20), default="PENDING")
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BulkUploadJob(Base):
    """Bulk CSV upload processing jobs."""
    __tablename__ = "bulk_upload_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    filename = Column(String(300), nullable=True)
    total_rows = Column(Integer, default=0)
    processed_rows = Column(Integer, default=0)
    eligible_count = Column(Integer, default=0)
    ineligible_count = Column(Integer, default=0)
    status = Column(String(30), default="PROCESSING")
    result_file_url = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class APIClient(Base):
    """Embedded lending API clients."""
    __tablename__ = "api_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_name = Column(String(200), nullable=False)
    api_key = Column(String(100), unique=True, nullable=False)
    webhook_url = Column(String(500), nullable=True)
    allowed_origins = Column(JSON, default=[])
    is_active = Column(Boolean, default=True)
    monthly_request_limit = Column(Integer, default=1000)
    requests_this_month = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CreditPolicyExperiment(Base):
    """A/B credit policy testing experiments."""
    __tablename__ = "credit_policy_experiments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="ACTIVE")
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    traffic_split = Column(Float, default=0.5)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Policy A (Control)
    policy_a_min_score = Column(Integer, default=600)
    policy_a_max_dti = Column(Float, default=0.50)

    # Policy B (Challenger)
    policy_b_min_score = Column(Integer, nullable=True)
    policy_b_max_dti = Column(Float, nullable=True)

    # Results
    policy_a_approval_rate = Column(Float, nullable=True)
    policy_a_npa_rate = Column(Float, nullable=True)
    policy_b_approval_rate = Column(Float, nullable=True)
    policy_b_npa_rate = Column(Float, nullable=True)
    winner = Column(String(10), nullable=True)


class ExperimentAssignment(Base):
    """Loan-to-experiment assignment for A/B testing."""
    __tablename__ = "experiment_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    experiment_id = Column(UUID(as_uuid=True), ForeignKey("credit_policy_experiments.id"), nullable=False)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False)
    policy_group = Column(String(1), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EarlyWarningFlag(Base):
    """Predictive early warning flags for potential defaults."""
    __tablename__ = "early_warning_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_label = Column(String(20), nullable=False)
    prediction_basis = Column(JSON, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    action_taken = Column(String(100), nullable=True)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

