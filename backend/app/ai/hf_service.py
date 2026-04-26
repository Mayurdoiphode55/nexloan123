"""
NexLoan HF Engine — Document Understanding Pipeline
Uses layoutlm-document-qa for specific field extraction (Name, DOB, ID Number).
"""

import logging
import httpx
import base64
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("nexloan.hf")

HF_API_URL = "https://api-inference.huggingface.co/models/impira/layoutlm-document-qa"
HEADERS = {
    "Authorization": f"Bearer {settings.HF_API_KEY}",
    "Content-Type": "application/json"
}

async def ask_document_question(image_bytes: bytes, question: str) -> Optional[str]:
    """
    Uses impira/layoutlm-document-qa via HF Inference API.
    This model understands the layout and specifically finds the requested field.
    """
    if not settings.HF_API_KEY:
        return None

    try:
        # Compress image to avoid HF 413 Payload Too Large (limit ~1MB)
        compressed = _compress_image(image_bytes, max_size=900_000)
        base64_image = base64.b64encode(compressed).decode("utf-8")

        payload = {
            "inputs": {
                "image": base64_image,
                "question": question
            }
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(HF_API_URL, headers=HEADERS, json=payload)

        if response.status_code == 503:
            logger.warning("🕒 HF Model loading (503). Retrying...")
            import asyncio
            await asyncio.sleep(3)
            return await ask_document_question(image_bytes, question)

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
        logger.error(f"❌ Document QA Error: {e}")
        return None


def _compress_image(image_bytes: bytes, max_size: int = 900_000) -> bytes:
    """
    Resize and compress image to stay under HF API payload limit.
    Returns JPEG bytes at reduced quality/size.
    """
    try:
        from PIL import Image
        import io

        if len(image_bytes) <= max_size:
            return image_bytes  # Already small enough

        img = Image.open(io.BytesIO(image_bytes))

        # Convert to RGB (handles PNG with transparency)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Resize if too large — max 1024px on longest side
        max_dim = 1024
        w, h = img.size
        if w > max_dim or h > max_dim:
            ratio = min(max_dim / w, max_dim / h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        # Compress to JPEG at decreasing quality until under limit
        for quality in [80, 65, 50, 35]:
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=quality, optimize=True)
            result = buf.getvalue()
            if len(result) <= max_size:
                logger.debug(f"🖼️ Image compressed: {len(image_bytes)}B → {len(result)}B (quality={quality})")
                return result

        # Last resort: return whatever we got at quality 35
        return result

    except Exception as e:
        logger.warning(f"⚠️ Image compression failed: {e} — sending raw")
        return image_bytes

async def verify_kyc_document(file_bytes: bytes, doc_type: str, applicant_name: str) -> dict:
    """
    Full extraction pipeline using Document Understanding (DocVQA).
    """
    try:
        # 1. Extraction via Questions
        name_question = "What is the name of the person?"
        dob_question = "What is the date of birth?"
        id_question = f"What is the {doc_type} number?"

        # Parallelize? No, HF Inference API likes sequential for stability
        extracted_name = await ask_document_question(file_bytes, name_question)
        extracted_id = await ask_document_question(file_bytes, id_question)
        
        logger.info(f"🔍 Extracted from {doc_type}: Name='{extracted_name}', ID='{extracted_id}'")

        if not extracted_name and not extracted_id:
            return {
                "verdict": "MANUAL_REVIEW",
                "reason": f"AI could not reliably 'read' this {doc_type}. The image might be blurry or the layout is unrecognized.",
                "is_legible": False,
                "name_extracted": None
            }

        # 2. Match Logic
        name_match = False
        if extracted_name and applicant_name:
            app_words = set(applicant_name.upper().split())
            ext_words = set(extracted_name.upper().split())
            overlap = app_words & ext_words
            name_match = len(overlap) >= 2 or (applicant_name.upper() in extracted_name.upper())

        # 3. Build Narrative Summary (The important part for the user)
        if not extracted_name:
            verdict = "MANUAL_REVIEW"
            summary = (
                f"I detected the {doc_type} card structure, but I couldn't clearly read the person's name. "
                "The ID number was detected as follows: " + (extracted_id if extracted_id else "Unreadable") + ". "
                "Please perform a manual check to ensure the document belongs to the applicant."
            )
        elif not name_match:
            verdict = "FAIL"
            summary = (
                f"### 🚩 Identity Mismatch Detected\n"
                f"I successfully read this {doc_type} card. The name on the document is **'{extracted_name.upper()}'**, "
                f"but the loan application was submitted by **'{applicant_name.upper()}'**. "
                "Since these names are fundamentally different, I have flagged this as a high fraud risk."
            )
        else:
            verdict = "PASS"
            summary = (
                f"### ✅ Verification Successful\n"
                f"I have verified this {doc_type} card. The name found on the card (**'{extracted_name.upper()}'**) "
                f"matches the applicant's name. The {doc_type} number format was also validated."
            )

        return {
            "verdict": verdict,
            "reason": summary, # This goes to ai_remarks
            "name_extracted": extracted_name,
            "is_legible": True,
            "fields": {
                "id_number": extracted_id,
            },
            "name_match": name_match,
            "raw_text": f"Name: {extracted_name} | ID: {extracted_id}"
        }

    except Exception as e:
        logger.error(f"❌ verify_kyc_document error: {e}")
        return {
            "verdict": "MANUAL_REVIEW",
            "reason": f"There was a technical glitch in the AI pipeline: {str(e)}",
            "is_legible": False,
            "name_extracted": None
        }
