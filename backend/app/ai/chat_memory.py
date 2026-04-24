"""
NexLoan AI Chat Memory Service
Provides persistent conversation history and memory injection for the chatbot.
"""

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import ChatMessage, ChatMemorySummary, User, Loan, EMISchedule

logger = logging.getLogger("nexloan.chat_memory")


async def save_message(
    user_id: UUID, session_id: str, role: str, content: str, db: AsyncSession
):
    """Save a single message to the persistent chat_messages table."""
    msg = ChatMessage(
        user_id=user_id,
        session_id=session_id,
        role=role,
        content=content,
    )
    db.add(msg)
    # Don't commit here — let the caller manage the transaction


async def get_conversation_context(user_id: UUID, db: AsyncSession) -> list[dict]:
    """
    Build conversation context for Groq:
    1. Load memory summary (if exists) — inject as system context
    2. Load last 20 messages from chat_messages table
    3. Return as list of {"role": "user"/"assistant", "content": "..."}
    """
    messages = []

    # Load memory summary
    summary_stmt = select(ChatMemorySummary).where(ChatMemorySummary.user_id == user_id)
    summary_result = await db.execute(summary_stmt)
    summary = summary_result.scalar_one_or_none()

    if summary:
        messages.append({
            "role": "system",
            "content": f"[MEMORY FROM PREVIOUS CONVERSATIONS]\n{summary.summary}",
        })

    # Load last 20 messages
    msg_stmt = select(ChatMessage).where(
        ChatMessage.user_id == user_id
    ).order_by(ChatMessage.created_at.desc()).limit(20)

    msg_result = await db.execute(msg_stmt)
    recent_messages = list(reversed(msg_result.scalars().all()))

    for msg in recent_messages:
        messages.append({"role": msg.role, "content": msg.content})

    return messages


async def get_recent_messages(user_id: UUID, db: AsyncSession, limit: int = 10) -> list[dict]:
    """Load the most recent messages for display in the chat UI."""
    stmt = select(ChatMessage).where(
        ChatMessage.user_id == user_id
    ).order_by(ChatMessage.created_at.desc()).limit(limit)

    result = await db.execute(stmt)
    messages = list(reversed(result.scalars().all()))

    return [
        {
            "role": msg.role,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "session_id": msg.session_id,
        }
        for msg in messages
    ]


async def build_memory_injection(user_id: UUID, db: AsyncSession) -> str:
    """
    Build a context string about the user for the system prompt.
    Pulls from DB: user name, loans, previous conversation topics.
    """
    context_parts = []

    # User info
    user_stmt = select(User).where(User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if user:
        context_parts.append(f"The user's name is {user.full_name}.")

    # Loan info
    loan_stmt = select(Loan).where(Loan.user_id == user_id).order_by(Loan.created_at.desc())
    loan_result = await db.execute(loan_stmt)
    loans = loan_result.scalars().all()

    if loans:
        loan = loans[0]
        parts = [f"Their latest loan is {loan.loan_number}, status: {loan.status.value if hasattr(loan.status, 'value') else loan.status}."]
        if loan.emi_amount:
            parts.append(f"EMI amount: ₹{loan.emi_amount:,.0f}.")
        if loan.approved_amount:
            parts.append(f"Approved amount: ₹{loan.approved_amount:,.0f}.")
        if loan.interest_rate:
            parts.append(f"Interest rate: {loan.interest_rate}% p.a.")
        context_parts.append(" ".join(parts))

    # Memory summary
    summary_stmt = select(ChatMemorySummary).where(ChatMemorySummary.user_id == user_id)
    summary_result = await db.execute(summary_stmt)
    summary = summary_result.scalar_one_or_none()

    if summary:
        context_parts.append(f"Previous conversation summary: {summary.summary}")

    return "\n".join(context_parts) if context_parts else ""


async def summarize_old_messages(user_id: UUID, db: AsyncSession):
    """
    When messages > 50, summarize old ones and store in chat_memory_summaries.
    Keep last 20 messages, summarize the rest.
    """
    from app.ai.chatbot_service import chat

    # Count total messages
    count_stmt = select(func.count(ChatMessage.id)).where(ChatMessage.user_id == user_id)
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    if total <= 50:
        return  # Not enough messages to summarize

    # Get all messages except the last 20
    all_stmt = select(ChatMessage).where(
        ChatMessage.user_id == user_id
    ).order_by(ChatMessage.created_at.asc())
    all_result = await db.execute(all_stmt)
    all_messages = all_result.scalars().all()

    to_summarize = all_messages[:-20]
    if not to_summarize:
        return

    # Build conversation text for summarization
    convo_text = "\n".join([
        f"{msg.role}: {msg.content[:200]}" for msg in to_summarize
    ])

    try:
        summary_text = await chat(
            messages=[{
                "role": "user",
                "content": f"Summarize this conversation history in 100 words, focusing on the user's key questions, concerns, and preferences:\n\n{convo_text}"
            }],
            loan_context=None,
        )

        # Upsert memory summary
        existing_stmt = select(ChatMemorySummary).where(ChatMemorySummary.user_id == user_id)
        existing_result = await db.execute(existing_stmt)
        existing = existing_result.scalar_one_or_none()

        if existing:
            existing.summary = summary_text
            existing.last_updated = datetime.utcnow()
            existing.messages_summarized += len(to_summarize)
        else:
            new_summary = ChatMemorySummary(
                user_id=user_id,
                summary=summary_text,
                messages_summarized=len(to_summarize),
            )
            db.add(new_summary)

        # Delete summarized messages
        for msg in to_summarize:
            await db.delete(msg)

        await db.commit()
        logger.info(f"✅ Summarized {len(to_summarize)} messages for user {user_id}")
    except Exception as e:
        logger.error(f"❌ Failed to summarize messages: {e}")
