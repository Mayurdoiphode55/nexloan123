"""
NexLoan AI — Layer 2: LayoutLM Document QA (Hugging Face)
Uses impira/layoutlm-document-qa for layout-aware field extraction.
This model reads spatial positions of text on the card and can answer
questions like "What is the name?" even when OCR alone would garble it.
"""

import logging
import base64
import httpx
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger("nexloan.ai.layoutlm")

HF_API_URL = f"https://api-inference.huggingface.co/models/{settings.HF_DOCUMENT_QA_MODEL}"


async def _ask(image_bytes: bytes, question: str) -> Optional[str]:
    """Ask a single question against the document image via HF Inference API."""
    if not settings.HF_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {settings.HF_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        payload = {"inputs": {"image": b64, "question": question}}

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(HF_API_URL, headers=headers, json=payload)

        if response.status_code == 503:
            logger.warning("🕒 HF model loading (503). Retrying once...")
            import asyncio
            await asyncio.sleep(3)
            return await _ask(image_bytes, question)

        if response.status_code != 200:
            logger.error(f"❌ HF Error {response.status_code}: {response.text}")
            return None

        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            answer = result[0].get("answer", "").strip()
            score = result[0].get("score", 0)
            if score > 0.3:
                return answer

        return None
    except Exception as e:
        logger.error(f"❌ LayoutLM QA error: {e}")
        return None


async def analyze(file_bytes: bytes, doc_type: str, applicant_name: str) -> dict:
    """
    Layer 2 — LayoutLM Document QA extraction.
    Returns a standardized dict matching the pipeline interface.
    """
    if not settings.HF_API_KEY:
        logger.warning("HF_API_KEY not configured, skipping Layer 2")
        return {"verdict": "SKIP", "layer": 2}

    try:
        extracted_name = await _ask(file_bytes, "What is the name of the person?")
        extracted_id = await _ask(file_bytes, f"What is the {doc_type} number?")

        logger.info(f"🔍 Layer 2 — {doc_type}: name='{extracted_name}', id='{extracted_id}'")

        if not extracted_name and not extracted_id:
            return {
                "verdict": "SKIP",
                "layer": 2,
                "remarks": f"LayoutLM could not read this {doc_type}.",
                "is_legible": False,
                "name_extracted": None,
            }

        # Name matching
        name_match = False
        if extracted_name and applicant_name:
            app_words = set(applicant_name.upper().split())
            ext_words = set(extracted_name.upper().split())
            overlap = app_words & ext_words
            name_match = len(overlap) >= 2 or (applicant_name.upper() in extracted_name.upper())

        # Build verdict
        if not extracted_name:
            verdict = "MANUAL_REVIEW"
        elif not name_match:
            verdict = "FAIL"
        else:
            verdict = "PASS"

        return {
            "verdict": verdict,
            "layer": 2,
            "engine": "layoutlm",
            "is_legible": True,
            "name_extracted": extracted_name,
            "name_matches_applicant": name_match,
            "doc_number": extracted_id,
            "remarks": f"LayoutLM extracted: name='{extracted_name}', id='{extracted_id}'",
        }

    except Exception as e:
        logger.error(f"❌ Layer 2 (LayoutLM) error: {e}")
        return {
            "verdict": "SKIP",
            "layer": 2,
            "remarks": f"LayoutLM error: {str(e)}",
            "is_legible": False,
            "name_extracted": None,
        }
