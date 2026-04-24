"""
NexLoan Support Tickets Router
Endpoints for creating, listing, messaging, and managing support tickets.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import User, SupportTicket, TicketMessage
from app.utils.database import get_db
from app.utils.auth import get_current_user, require_role

logger = logging.getLogger("nexloan.support")

router = APIRouter()


# ─── Request/Response Models ────────────────────────────────────────────────────

class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    loan_id: Optional[str] = None
    priority: str = "NORMAL"


class AddMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., description="OPEN, IN_PROGRESS, RESOLVED, CLOSED")


# ─── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    req: CreateTicketRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new support ticket."""
    ticket = SupportTicket(
        user_id=current_user.id,
        loan_id=req.loan_id if req.loan_id else None,
        subject=req.subject,
        description=req.description,
        priority=req.priority,
    )
    db.add(ticket)

    # Add initial message
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        sender_role=getattr(current_user, 'role', 'BORROWER') or 'BORROWER',
        message=req.description,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(ticket)

    logger.info(f"✅ Support ticket created: {ticket.subject} by {current_user.email}")

    return {
        "id": str(ticket.id),
        "subject": ticket.subject,
        "status": ticket.status,
        "priority": ticket.priority,
        "created_at": ticket.created_at.isoformat(),
    }


@router.get("/tickets")
async def list_tickets(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List support tickets. Borrowers see own, Officers/Admins see all."""
    user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'

    if user_role == "BORROWER":
        stmt = select(SupportTicket).where(SupportTicket.user_id == current_user.id)
    else:
        stmt = select(SupportTicket)

    if status_filter:
        stmt = stmt.where(SupportTicket.status == status_filter)

    stmt = stmt.order_by(SupportTicket.created_at.desc())
    result = await db.execute(stmt)
    tickets = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "user_id": str(t.user_id),
            "loan_id": str(t.loan_id) if t.loan_id else None,
            "subject": t.subject,
            "status": t.status,
            "priority": t.priority,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        }
        for t in tickets
    ]


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ticket details with messages."""
    user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'

    if user_role == "BORROWER":
        stmt = select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.user_id == current_user.id
        )
    else:
        stmt = select(SupportTicket).where(SupportTicket.id == ticket_id)

    result = await db.execute(stmt)
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Fetch messages
    msg_stmt = select(TicketMessage).where(
        TicketMessage.ticket_id == ticket_id
    ).order_by(TicketMessage.created_at.asc())
    msg_result = await db.execute(msg_stmt)
    messages = msg_result.scalars().all()

    return {
        "id": str(ticket.id),
        "user_id": str(ticket.user_id),
        "subject": ticket.subject,
        "description": ticket.description,
        "status": ticket.status,
        "priority": ticket.priority,
        "created_at": ticket.created_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "sender_id": str(m.sender_id),
                "sender_role": m.sender_role,
                "message": m.message,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/tickets/{ticket_id}/message")
async def add_message(
    ticket_id: str,
    req: AddMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a message to a ticket thread."""
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=current_user.id,
        sender_role=getattr(current_user, 'role', 'BORROWER') or 'BORROWER',
        message=req.message,
    )
    db.add(msg)
    await db.commit()

    return {"message": "Reply added successfully"}


@router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    req: UpdateStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LOAN_OFFICER", "ADMIN", "SUPER_ADMIN")),
):
    """Update ticket status (Officers/Admins only)."""
    valid_statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be: {', '.join(valid_statuses)}")

    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = req.status
    await db.commit()

    return {"ticket_id": str(ticket.id), "new_status": req.status}
