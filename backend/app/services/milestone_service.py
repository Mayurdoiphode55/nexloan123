"""
NexLoan Milestone Service — Application Tracking
Creates and advances milestones as the loan progresses through its lifecycle.
"""

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import LoanMilestone, DocumentStatusRecord

logger = logging.getLogger("nexloan.milestone")

# Milestone definitions — the complete loan lifecycle timeline
MILESTONE_DEFINITIONS = [
    ("APPLICATION_SUBMITTED", "Application submitted"),
    ("DOCUMENTS_UPLOADED", "Documents uploaded & verified"),
    ("UNDERWRITING_COMPLETE", "AI underwriting complete"),
    ("LOAN_DECISION", "Loan decision made"),
    ("DISBURSEMENT_PROCESSING", "Disbursement processing"),
    ("DISBURSED", "Funds disbursed to your account"),
    ("ACTIVE", "Loan active — EMI begins"),
    ("FINAL_PAYMENT", "Final payment"),
]


async def create_initial_milestones(loan_id: UUID, db: AsyncSession):
    """
    Called when a loan inquiry is created.
    Creates the full timeline with all milestones in PENDING state.
    Sets APPLICATION_SUBMITTED to DONE and DOCUMENTS_UPLOADED to CURRENT.
    """
    try:
        for i, (milestone, desc) in enumerate(MILESTONE_DEFINITIONS):
            if i == 0:
                ms_status = "DONE"
                completed = datetime.utcnow()
            elif i == 1:
                ms_status = "CURRENT"
                completed = None
            else:
                ms_status = "PENDING"
                completed = None

            db_milestone = LoanMilestone(
                loan_id=loan_id,
                milestone=milestone,
                description=desc,
                status=ms_status,
                completed_at=completed,
            )
            db.add(db_milestone)

        # Create document status records for PAN and Aadhaar
        for doc_type in ["PAN", "AADHAAR"]:
            doc_status = DocumentStatusRecord(
                loan_id=loan_id,
                document_type=doc_type,
                status="PENDING",
            )
            db.add(doc_status)

        logger.info(f"✅ Milestones created for loan {loan_id}")
    except Exception as e:
        logger.error(f"❌ Failed to create milestones for loan {loan_id}: {e}")


async def advance_milestone(loan_id: UUID, milestone_key: str, db: AsyncSession):
    """
    Mark a milestone as DONE, and set the next one as CURRENT.
    Called at each state transition in the loan lifecycle.
    """
    try:
        # Get all milestones for this loan, ordered by creation
        stmt = select(LoanMilestone).where(
            LoanMilestone.loan_id == loan_id
        ).order_by(LoanMilestone.created_at.asc())
        result = await db.execute(stmt)
        milestones = result.scalars().all()

        if not milestones:
            logger.warning(f"No milestones found for loan {loan_id}")
            return

        # Find the milestone to advance
        target_idx = None
        for i, ms in enumerate(milestones):
            if ms.milestone == milestone_key:
                target_idx = i
                break

        if target_idx is None:
            logger.warning(f"Milestone {milestone_key} not found for loan {loan_id}")
            return

        # Mark target as DONE
        milestones[target_idx].status = "DONE"
        milestones[target_idx].completed_at = datetime.utcnow()

        # Mark the next milestone as CURRENT (if it exists and is PENDING)
        if target_idx + 1 < len(milestones):
            next_ms = milestones[target_idx + 1]
            if next_ms.status == "PENDING":
                next_ms.status = "CURRENT"

        logger.info(f"✅ Milestone advanced: {milestone_key} → DONE for loan {loan_id}")
    except Exception as e:
        logger.error(f"❌ Failed to advance milestone {milestone_key} for loan {loan_id}: {e}")


async def update_document_status(
    loan_id: UUID, document_type: str, new_status: str, db: AsyncSession, notes: str = None
):
    """
    Update the verification status of a specific document.
    """
    try:
        stmt = select(DocumentStatusRecord).where(
            DocumentStatusRecord.loan_id == loan_id,
            DocumentStatusRecord.document_type == document_type,
        )
        result = await db.execute(stmt)
        doc = result.scalar_one_or_none()

        if doc:
            doc.status = new_status
            if new_status == "VERIFIED":
                doc.verified_at = datetime.utcnow()
            if notes:
                doc.notes = notes
            logger.info(f"✅ Document {document_type} → {new_status} for loan {loan_id}")
        else:
            # Create if it doesn't exist
            new_doc = DocumentStatusRecord(
                loan_id=loan_id,
                document_type=document_type,
                status=new_status,
                verified_at=datetime.utcnow() if new_status == "VERIFIED" else None,
                notes=notes,
            )
            db.add(new_doc)
            logger.info(f"✅ Document status created: {document_type} → {new_status} for loan {loan_id}")
    except Exception as e:
        logger.error(f"❌ Failed to update document status: {e}")
