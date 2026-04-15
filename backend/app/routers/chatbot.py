"""
NexLoan Chatbot Router
Handles conversational AI and in-chat OTP login flow.
"""

import logging
import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.database import get_db
from app.utils.redis_client import store_chat_session, get_chat_session, store_otp, verify_otp
from app.utils.auth import generate_otp
from app.models.loan import User, Loan, EMISchedule
from app.services.email_service import send_otp_email
from app.ai.groq_service import chat

logger = logging.getLogger("nexloan.chatbot")

router = APIRouter()


class SessionResponse(BaseModel):
    session_id: str


class MessageRequest(BaseModel):
    session_id: str
    message: str


from typing import Optional

class MessageResponse(BaseModel):
    reply: str
    action: Optional[str] = None


def create_initial_session():
    return {
        "history": [],
        "authenticated": False,
        "user_id": None,
        "loan_context": None,
        "awaiting_mobile": False,
        "awaiting_otp": False,
        "pending_mobile": None
    }


@router.post(
    "/new-session",
    response_model=SessionResponse,
    summary="Create a new chatbot session"
)
async def new_session():
    """Generates a UUID and initializes an empty Redis session."""
    session_id = str(uuid.uuid4())
    await store_chat_session(session_id, create_initial_session())
    return SessionResponse(session_id=session_id)


async def _fetch_loan_context_for_bot(user_id: str, db: AsyncSession) -> dict:
    """Helper to fetch a summary of the user's loan to inject into the LLM prompt."""
    stmt = select(Loan).where(Loan.user_id == user_id).order_by(Loan.created_at.desc())
    result = await db.execute(stmt)
    loan = result.scalars().first()
    
    if not loan:
        return {"notice": "User has no active loans or applications."}
        
    return {
        "loan_number": loan.loan_number,
        "status": loan.status.value,
        "loan_amount": f"₹{loan.loan_amount:,.2f}" if loan.loan_amount else None,
        "approved_amount": f"₹{loan.approved_amount:,.2f}" if loan.approved_amount else None,
        "interest_rate": f"{loan.interest_rate}% p.a." if loan.interest_rate else None,
        "emi_amount": f"₹{loan.emi_amount:,.2f}" if loan.emi_amount else None,
        "tenure_months": f"{loan.tenure_months} months" if loan.tenure_months else None,
        "total_paid": f"₹{loan.total_paid:,.2f}" if loan.total_paid else "₹0.00",
        "preclosure_charge_paid": f"₹{loan.preclosure_charge:,.2f}" if loan.preclosure_charge else "₹0.00"
    }


@router.post(
    "/message",
    response_model=MessageResponse,
    summary="Send a message to the chatbot"
)
async def send_message(
    req: MessageRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Main state machine for chatbot.
    Handles OTP login gracefully mid-conversation.
    """
    session = await get_chat_session(req.session_id)
    if not session:
        # Fallback if session expired
        session = create_initial_session()
        await store_chat_session(req.session_id, session)

    user_msg = req.message.strip()

    # STATE 1: Awaiting Identifier (Mobile or Email)
    if session.get("awaiting_mobile"):
        # The user's message is expected to be a mobile number or email
        identifier = user_msg.lower().strip()
        
        # Try finding by Mobile (cleaning first) or Email
        mobile_clean = identifier.replace(" ", "").replace("-", "").replace("+", "")
        
        stmt = select(User).where((User.mobile == mobile_clean) | (User.email == identifier))
        result = await db.execute(stmt)
        user = result.scalars().first()
        
        if not user:
            if "cancel" in user_msg.lower():
                session["awaiting_mobile"] = False
                await store_chat_session(req.session_id, session)
                return MessageResponse(reply="Login cancelled. How else can I help you?")
                
            return MessageResponse(reply="I couldn't find an account with that mobile or email. Please try again, or type 'cancel'.")
            
        # Send OTP
        otp = generate_otp()
        # Store OTP against their mobile (consistent with auth system)
        await store_otp(user.mobile, otp)
        # Send OTP via email in background
        background_tasks.add_task(send_otp_email, user.email, otp, user.full_name)
        
        # Advance state
        session["awaiting_mobile"] = False
        session["awaiting_otp"] = True
        session["pending_mobile"] = user.mobile
        await store_chat_session(req.session_id, session)
        
        return MessageResponse(reply=f"I've sent a 6-digit OTP to {user.email}. Please enter the code below to verify your identity:")

    # STATE 2: Awaiting OTP
    if session.get("awaiting_otp"):
        if "cancel" in user_msg.lower():
            session["awaiting_otp"] = False
            session["pending_mobile"] = None
            await store_chat_session(req.session_id, session)
            return MessageResponse(reply="Verification cancelled. How else can I help you?")
            
        mobile = session.get("pending_mobile")
        is_valid = await verify_otp(mobile, user_msg)
        
        if not is_valid:
            return MessageResponse(reply="Incorrect OTP. Please check your email and try again, or type 'cancel'.")
            
        # Success! Fetch User
        stmt = select(User).where(User.mobile == mobile)
        result = await db.execute(stmt)
        user = result.scalars().first()
        
        # Hydrate Session Context
        session["authenticated"] = True
        session["user_id"] = str(user.id)
        session["awaiting_otp"] = False
        session["pending_mobile"] = None
        
        loan_context = await _fetch_loan_context_for_bot(str(user.id), db)
        session["loan_context"] = loan_context
        
        await store_chat_session(req.session_id, session)
        
        # Pass control back to AI so it can greet the user contextually
        bot_reply = await chat(
            messages=[{"role": "user", "content": f"Hi, I just logged in successfully. My name is {user.full_name}. Please summarize my loan status."}],
            loan_context=loan_context
        )
        return MessageResponse(reply=bot_reply)

    # STATE 3: Normal Chat
    history = session.setdefault("history", [])
    history.append({"role": "user", "content": user_msg})
    
    # Cap history to 20 turns (40 messages)
    if len(history) > 40:
        history = history[-40:]
        
    bot_reply = await chat(
        messages=history,
        loan_context=session.get("loan_context")
    )
    
    action = None
    # Robust detection: handle [ACTION:REQUEST_LOGIN], [ACTION: REQUEST_LOGIN], etc.
    import re as _re
    if _re.search(r'\[ACTION\s*:\s*REQUEST_LOGIN\s*\]', bot_reply, _re.IGNORECASE):
        # Strip ALL variants of the action tag from the visible reply
        bot_reply = _re.sub(r'\[ACTION\s*:\s*REQUEST_LOGIN\s*\]', '', bot_reply, flags=_re.IGNORECASE).strip()
        
        # Override with clear OTP instruction — don't let the LLM ask for passwords
        bot_reply = "To access your loan details, I'll need to verify your identity.\n\nPlease enter your registered email address or mobile number below. I'll send a 6-digit OTP to your email for verification."
        
        # Set state
        session["awaiting_mobile"] = True
        action = "REQUEST_LOGIN"
            
    history.append({"role": "assistant", "content": bot_reply})
    session["history"] = history
    await store_chat_session(req.session_id, session)
    
    return MessageResponse(reply=bot_reply, action=action)
