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
    await db.flush()

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


# ─── Callback Request ───────────────────────────────────────────────────────

SLOT_LABELS = {
    "morning": "9 AM – 12 PM",
    "afternoon": "12 PM – 5 PM",
    "evening": "5 PM – 8 PM",
}


class CallbackRequestBody(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15)
    preferred_slot: str = Field(..., description="morning, afternoon, or evening")
    loan_id: Optional[str] = None
    reason: Optional[str] = None


@router.post("/callback-request")
async def request_callback(
    req: CallbackRequestBody,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a callback from the support team."""
    from sqlalchemy import text as sa_text

    if req.preferred_slot not in SLOT_LABELS:
        raise HTTPException(status_code=400, detail="preferred_slot must be: morning, afternoon, or evening")

    user_id = str(current_user.id)
    user_name = getattr(current_user, "full_name", "Customer") or "Customer"
    user_email = getattr(current_user, "email", "")

    # Save to DB
    await db.execute(sa_text("""
        INSERT INTO callback_requests (id, user_id, loan_id, phone_number, preferred_slot, notes, status, created_at)
        VALUES (gen_random_uuid(), :uid, :lid, :phone, :slot, :notes, 'pending', NOW())
    """), {
        "uid": user_id,
        "lid": req.loan_id,
        "phone": req.phone_number,
        "slot": req.preferred_slot,
        "notes": req.reason,
    })

    # Create in-app notification
    slot_label = SLOT_LABELS[req.preferred_slot]
    await db.execute(sa_text("""
        INSERT INTO notifications (id, user_id, loan_id, type, title, message, is_read, created_at)
        VALUES (gen_random_uuid(), :uid, :lid, 'callback_scheduled', :title, :message, false, NOW())
    """), {
        "uid": user_id,
        "lid": req.loan_id,
        "title": f"📞 Callback scheduled — {slot_label}",
        "message": f"We'll call you between {slot_label} today at {req.phone_number}.",
    })

    await db.commit()

    # Send Brevo email to support team
    try:
        from app.services.email_service import _send_brevo_api_email
        from app.config import settings

        await _send_brevo_api_email(
            to_email=settings.EMAIL_FROM,
            to_name="NexLoan Support",
            subject=f"📞 Callback Request from {user_name}",
            html_content=f"""
            <div style="font-family: Arial; padding: 20px;">
                <h2>New Callback Request</h2>
                <p><strong>Name:</strong> {user_name}</p>
                <p><strong>Email:</strong> {user_email}</p>
                <p><strong>Phone:</strong> {req.phone_number}</p>
                <p><strong>Preferred Slot:</strong> {slot_label}</p>
                <p><strong>Loan ID:</strong> {req.loan_id or 'N/A'}</p>
            </div>
            """,
        )

        # Send confirmation to user
        await _send_brevo_api_email(
            to_email=user_email,
            to_name=user_name,
            subject=f"✅ Callback Confirmed — {slot_label}",
            html_content=f"""
            <div style="font-family: Arial; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #7c3aed;">NexLoan</h2>
                <p>Hi {user_name},</p>
                <p>Your callback request has been received. Our support team will call you between <strong>{slot_label}</strong> today at <strong>{req.phone_number}</strong>.</p>
                <p>Thank you for choosing NexLoan!</p>
            </div>
            """,
        )
    except Exception as e:
        logger.warning(f"Callback email failed: {e}")

    return {
        "message": f"✅ Callback scheduled! We'll call you between {slot_label}.",
        "preferred_slot": req.preferred_slot,
        "slot_label": slot_label,
    }


@router.get("/callback-requests")
async def list_callback_requests(
    current_user=Depends(require_role("LOAN_OFFICER", "ADMIN", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """List all callback requests (Officers/Admins only)."""
    from sqlalchemy import text as sa_text

    rows = (await db.execute(sa_text("""
        SELECT cr.id, cr.user_id, cr.loan_id, cr.phone_number, cr.preferred_slot,
               cr.status, cr.created_at, cr.notes, u.full_name, u.email
        FROM callback_requests cr
        JOIN users u ON u.id = cr.user_id
        ORDER BY cr.created_at DESC
        LIMIT 50
    """))).mappings().all()

    return [
        {
            "id": str(r["id"]),
            "user_id": str(r["user_id"]),
            "loan_id": str(r["loan_id"]) if r["loan_id"] else None,
            "phone_number": r["phone_number"],
            "preferred_slot": r["preferred_slot"],
            "slot_label": SLOT_LABELS.get(r["preferred_slot"], r["preferred_slot"]),
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
            "user_name": r["full_name"],
            "user_email": r["email"],
            "reason": r["notes"] or "",
        }
        for r in rows
    ]


@router.put("/callback-requests/{request_id}/status")
async def update_callback_status(
    request_id: str,
    req: UpdateStatusRequest,
    current_user=Depends(require_role("LOAN_OFFICER", "ADMIN", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    """Update a callback request status (e.g. mark as completed)."""
    from sqlalchemy import text as sa_text

    result = await db.execute(sa_text(
        "UPDATE callback_requests SET status = :status WHERE id = :rid RETURNING id"
    ), {"status": req.status, "rid": request_id})
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Callback request not found")
    await db.commit()
    return {"id": request_id, "new_status": req.status}

