"""
NexLoan AI — Layer 1: Groq Vision (Llama 3.2 Vision)
Sends document images to Groq's multimodal LLM for structured JSON extraction.
This is the fastest and most capable layer, used as the primary analyzer.
"""

import logging
import json
import base64

from groq import AsyncGroq
from app.config import settings

logger = logging.getLogger("nexloan.ai.vision")

_client = AsyncGroq(api_key=settings.GROQ_API_KEY)


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


async def analyze(file_bytes: bytes, doc_type: str, applicant_name: str) -> dict:
    """
    Layer 1 — Groq Vision extraction.
    Returns a standardized dict with fields:
        is_legible, doc_number, name_extracted, name_matches_applicant,
        photo_present, verdict, remarks
    """
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured, skipping Layer 1")
        return {"verdict": "SKIP", "layer": 1}

    try:
        b64 = base64.b64encode(file_bytes).decode("utf-8")

        system_prompt = f"""You are a KYC verification expert for NexLoan.
Analyze the provided {doc_type} document image for applicant: {applicant_name}.
EXTRACT information WITH HIGH PRECISION. If a field is not visible, return null.

Return ONLY a valid JSON object with these fields:
- "is_legible": boolean
- "doc_number": string (Standard format, e.g., ABCDE1234F for PAN, XXXX XXXX XXXX for Aadhaar)
- "name_extracted": string (The FULL NAME as printed on the card)
- "name_matches_applicant": boolean (Fuzzy match vs {applicant_name})
- "photo_present": boolean
- "verdict": "PASS" | "FAIL" | "MANUAL_REVIEW"
- "remarks": string (Brief explanation)

{doc_type} SPECIFIC RULES:
- Aadhaar: Look for the 12-digit number (usually formatted as 0000 0000 0000).
- PAN: Look for the 10-char alphanumeric string (5 letters, 4 digits, 1 letter).
- If the document is partially cut, blurry, or a duplicate, set verdict to FAIL.
"""

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": system_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            }
        ]

        response = await _client.chat.completions.create(
            messages=messages,
            model=settings.GROQ_VISION_MODEL,
            temperature=0.1,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        parsed = json.loads(_clean_json(content))
        parsed["layer"] = 1
        parsed["engine"] = "groq_vision"
        logger.info(f"✅ Layer 1 (Groq Vision) — {doc_type}: verdict={parsed.get('verdict')}")
        return parsed

    except Exception as e:
        logger.error(f"❌ Layer 1 (Groq Vision) error: {e}")
        return {
            "verdict": "SKIP",
            "remarks": f"Vision API error: {str(e)}",
            "layer": 1,
            "is_legible": False,
            "name_extracted": None,
            "name_matches_applicant": False,
        }
