"""
NexLoan AI — Chatbot Service
Extracts the chatbot LLM logic from groq_service.py into a dedicated module.
Uses Groq (Llama 3.1) for conversational AI with loan context injection.
"""

import logging
import json

from groq import AsyncGroq
from app.config import settings

logger = logging.getLogger("nexloan.ai.chatbot")

_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """You are NexBot, a professional customer support assistant for NexLoan, a personal loan origination platform in India. You represent the brand: "NexLoan — Powered by Theoremlabs".

CRITICAL RULES (NEVER BREAK THESE):
1. You MUST respond ONLY in English. NEVER use Hindi, Hinglish, Devanagari script, or any non-English language. Even if the user writes in Hindi, you MUST reply in English only. This is a strict, non-negotiable requirement.
2. Only discuss personal loans, EMI schedules, credit scoring, KYC, and NexLoan services. Politely decline unrelated questions.
3. If the user asks about their specific loan status, EMI, or account details and they are NOT logged in, include exactly this tag in your reply: [ACTION:REQUEST_LOGIN]
4. Be concise, accurate, and professional. Use bullet points for listing data.
5. When presenting loan data from the context below, use the EXACT values provided. DO NOT calculate, convert, or modify any numbers. Simply quote them as-is.
6. Format currency values using the Indian numbering system (e.g., ₹5,00,000).
7. Always be helpful and end responses with an offer to help further.
8. NEVER ask the user for a password. NexLoan uses OTP-based authentication ONLY. When login is needed, simply include the [ACTION:REQUEST_LOGIN] tag and the system will handle the OTP verification flow automatically.
9. When you include the [ACTION:REQUEST_LOGIN] tag, just say something brief like "I'll need to verify your identity first." — the system will automatically prompt the user for their email and send an OTP. Do NOT explain the OTP process yourself.

ADDITIONAL v2.0 CONTEXT:
- NexLoan now supports EMI Pause (up to 2 per loan lifecycle), Counter-Offers, and Financial Health dashboards.
- Users can check their Loan Readiness Score before applying — no KYC needed.
- On loan closure, customers receive a No-Dues Certificate and a pre-approved loyalty offer.
- If asked about EMI pause, explain they can pause up to 2 EMIs and the schedule shifts forward.
- If asked about counter-offers, explain the bank may offer a lower amount at a better rate if the full amount is risky.
"""


async def chat(messages: list, loan_context: dict = None, memory_context: str = None) -> str:
    """
    Generates a chatbot response using Groq LLM.

    Args:
        messages: Conversation history [{role, content}, ...]
        loan_context: Optional loan data dict for authenticated users
        memory_context: Optional persistent memory string from chat_memory service
    """
    try:
        prompt = SYSTEM_PROMPT

        if loan_context:
            prompt += f"""

The user IS logged in. Here is their current loan context. Use this to answer their questions accurately. Do NOT include [ACTION:REQUEST_LOGIN].

Loan Context:
{json.dumps(loan_context, indent=2, default=str)}
"""

        if memory_context:
            prompt += f"""

IMPORTANT USER CONTEXT (from your memory):
{memory_context}

Use this context to give personalized responses. Reference the user's name,
their loan details, and previous conversations naturally. Do NOT reveal that
you have a "memory system" — just be naturally helpful and aware.
"""

        api_messages = [{"role": "system", "content": prompt}] + messages

        response = await _client.chat.completions.create(
            messages=api_messages,
            model=settings.GROQ_TEXT_MODEL,
            temperature=0.7,
            max_tokens=500,
        )

        return response.choices[0].message.content

    except Exception as e:
        logger.error(f"❌ Chatbot error: {e}")
        return "I'm sorry, I'm having trouble connecting to my servers right now. Please try again later."

