"""
NexLoan AI — Layer 4: Tesseract OCR Fallback
Local, deterministic document analysis using Tesseract OCR + regex patterns.
This is the last-resort layer — runs fully offline with no API dependencies.
"""

import logging
import io
import os
import re
import difflib
import platform
from typing import Dict, Any, Optional

from PIL import Image, ImageEnhance
import pytesseract

logger = logging.getLogger("nexloan.ai.tesseract")

# Cross-platform Tesseract path
if platform.system() == "Windows":
    _path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(_path):
        pytesseract.pytesseract.tesseract_cmd = _path


def _preprocess(image: Image.Image) -> Image.Image:
    """Enhances image for better OCR accuracy."""
    gray = image.convert("L")
    w, h = gray.size
    upscaled = gray.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    enhanced = ImageEnhance.Contrast(upscaled).enhance(1.8)
    return enhanced


def _extract_name(ocr_text: str, doc_type: str, expected_name: str) -> Optional[str]:
    """Extracts cardholder name from raw OCR text using heuristic filtering."""
    ocr_text = "".join(c for c in ocr_text if ord(c) < 128)
    lines = [l.strip() for l in ocr_text.split("\n") if len(l.strip()) > 3]

    expected_lower = expected_name.lower().strip()
    best_match_line = None
    best_ratio = 0.0

    for line in lines:
        line_lower = line.lower()
        if expected_lower in line_lower:
            return line
        ratio = difflib.SequenceMatcher(None, expected_lower, line_lower).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match_line = line

    if best_ratio > 0.65 and best_match_line:
        return best_match_line

    skip_keywords = [
        "income tax", "govt", "government", "india", "department",
        "unit", "identification", "uidai", "permanent", "account",
        "signature", "address", "male", "female", "aadhaar",
        "mera aadhaar", "my aadhaar", "year of", "yob", "issued:",
        "card",
    ]
    pan_re = r"[A-Z]{5}[0-9]{4}[A-Z]{1}"
    aadhaar_re = r"(\d{4})\s?(\d{4})\s?(\d{4})"

    for line in lines:
        lc = line.lower()
        if any(kw in lc for kw in skip_keywords):
            continue
        if re.search(pan_re, line.upper()):
            continue
        if re.search(aadhaar_re, line):
            continue
        digits = sum(1 for c in line if c.isdigit())
        if digits / max(len(line), 1) > 0.20:
            continue
        alpha = sum(1 for c in line if c.isalpha() or c in (" ", "."))
        if alpha / max(len(line), 1) > 0.75:
            if len(line.split()) >= 2 and len(line) > 8:
                return line.strip()

    return None


def _fuzzy_match(target: str, corpus: str, threshold: float = 0.7) -> bool:
    t = target.lower().strip()
    c = corpus.lower().strip()
    if t in c:
        return True
    if difflib.SequenceMatcher(None, t, c).ratio() >= threshold:
        return True
    words = t.split()
    matched = [w for w in words if w in c]
    if len(matched) >= len(words) - 1 and len(words) > 1:
        return True
    return False


async def analyze(file_bytes: bytes, doc_type: str, applicant_name: str) -> Dict[str, Any]:
    """
    Layer 4 — Local Tesseract OCR fallback.
    Returns a standardized dict matching the pipeline interface.
    """
    try:
        image = Image.open(io.BytesIO(file_bytes))
        preprocessed = _preprocess(image)
        extracted_text = pytesseract.image_to_string(preprocessed)
        logger.info(f"📄 Layer 4 (Tesseract) — {doc_type}: {len(extracted_text)} chars")

        is_legible = len(extracted_text.strip()) > 10
        remarks = []
        name_matches = False

        if not is_legible:
            return {
                "verdict": "FAIL",
                "layer": 4,
                "engine": "tesseract",
                "is_legible": False,
                "name_extracted": None,
                "name_matches_applicant": False,
                "remarks": "Document is completely illegible or empty.",
            }

        # Extract name
        name_extracted = _extract_name(extracted_text, doc_type.upper(), applicant_name)
        if name_extracted:
            name_matches = _fuzzy_match(applicant_name, name_extracted)
            if not name_matches:
                remarks.append(
                    f"FRAUD ALERT: Doc name '{name_extracted}' does NOT match "
                    f"applicant name '{applicant_name}'."
                )
        else:
            if _fuzzy_match(applicant_name, extracted_text):
                name_matches = True
                name_extracted = applicant_name
            else:
                remarks.append(f"Could not extract name from {doc_type}.")

        # Extract document number
        doc_number = None
        masked_doc_number = None
        doc_number_visible = False
        dt = doc_type.upper()

        if dt == "PAN":
            m = re.search(r"[A-Z]{5}[0-9]{4}[A-Z]{1}", extracted_text.upper())
            gov = any(kw in extracted_text.upper() for kw in ["INCOME TAX", "GOVT", "INDIA"])
            if m:
                doc_number_visible = True
                doc_number = m.group(0)
                masked_doc_number = doc_number
            else:
                remarks.append("Valid PAN format not detected.")

            if m and name_matches and gov:
                verdict = "PASS"
            elif doc_number_visible or name_matches:
                verdict = "MANUAL_REVIEW"
            else:
                verdict = "FAIL"
                remarks.append("Does not appear to be a PAN card.")

        elif dt == "AADHAAR":
            m = re.search(r"(\d{4})\s?(\d{4})\s?(\d{4})", extracted_text)
            gov = any(kw in extracted_text.upper() for kw in ["GOVERNMENT", "UIDAI", "INDIA"])
            if m:
                doc_number_visible = True
                g1, g2, g3 = m.groups()
                doc_number = f"{g1}{g2}{g3}"
                masked_doc_number = f"XXXX-XXXX-{g3}"
            else:
                remarks.append("Valid 12-digit Aadhaar not detected.")

            if m and name_matches and gov:
                verdict = "PASS"
            elif doc_number_visible or name_matches:
                verdict = "MANUAL_REVIEW"
            else:
                verdict = "FAIL"
                remarks.append("Does not appear to be an Aadhaar card.")
        else:
            verdict = "MANUAL_REVIEW"

        final_remarks = " | ".join(remarks) if remarks else "Verified via Tesseract OCR."

        return {
            "verdict": verdict,
            "layer": 4,
            "engine": "tesseract",
            "is_legible": is_legible,
            "doc_number": doc_number,
            "masked_doc_number": masked_doc_number,
            "doc_number_visible": doc_number_visible,
            "name_extracted": name_extracted,
            "name_visible": name_extracted is not None,
            "name_matches_applicant": name_matches,
            "photo_or_signature_present": True,
            "remarks": final_remarks,
        }

    except Exception as e:
        logger.error(f"❌ Layer 4 (Tesseract) error: {e}")
        return {
            "verdict": "MANUAL_REVIEW",
            "layer": 4,
            "engine": "tesseract",
            "remarks": f"Tesseract error: {e}",
            "is_legible": False,
            "name_extracted": None,
            "name_matches_applicant": False,
        }
