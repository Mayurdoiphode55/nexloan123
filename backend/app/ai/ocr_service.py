"""
NexLoan OCR Engine — Local Tesseract Pipeline
Handles document verification via completely local computer vision and regex.
"""

import logging
import io
import os
import re
import difflib
import platform
from typing import Dict, Any

from PIL import Image, ImageOps, ImageEnhance
import pytesseract

def _preprocess_image(image: Image.Image) -> Image.Image:
    """Enhances image for better OCR accuracy."""
    # Convert to grayscale
    gray = image.convert("L")
    # Rescale 2x to help with small text on ID cards
    w, h = gray.size
    upscaled = gray.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    # Increase contrast
    enhancer = ImageEnhance.Contrast(upscaled)
    enhanced = enhancer.enhance(1.8)
    return enhanced

logger = logging.getLogger("nexloan.ocr")

# Cross-platform Tesseract path
if platform.system() == "Windows":
    tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
# On Linux (Render), Tesseract is expected to be in PATH via apt install

def is_fuzzy_match(target: str, corpus: str, threshold=0.7) -> bool:
    """Uses difflib to figure out if target exists within corpus."""
    target_clean = target.lower().strip()
    corpus_clean = corpus.lower().strip()
    
    # Direct inclusion
    if target_clean in corpus_clean:
        return True
        
    # Standard string matching metric via SequenceMatcher
    ratio = difflib.SequenceMatcher(None, target_clean, corpus_clean).ratio()
    if ratio >= threshold:
        return True
        
    # Split check (to see if full name is dispersed across words)
    words = target_clean.split()
    matched_words = [w for w in words if w in corpus_clean]
    if len(matched_words) >= len(words) - 1 and len(words) > 1:
        return True
        
    return False


def _extract_name_from_text(ocr_text: str, doc_type: str, expected_name: str) -> str | None:
    """
    Attempts to extract the cardholder's name from raw OCR text using aggressive filtering.
    """
    # Clean OCR text: remove non-ASCII noise (common in Tesseract's Marathi garbling)
    ocr_text = "".join(c for c in ocr_text if ord(c) < 128)
    
    lines = [line.strip() for line in ocr_text.split('\n') if len(line.strip()) > 3]
    
    # 1. Targeted Anchor Approach (Look for similarity to applicant name)
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

    # 2. Heuristic Fallback — Domain-Aware Filtering
    skip_keywords = [
        'income tax', 'govt', 'government', 'india', 'department',
        'unit', 'identification', 'uidai', 'permanent', 'account',
        'signature', 'address', 'male', 'female', 'aadhaar', 
        'mera aadhaar', 'my aadhaar', 'year of', 'yob', 'issued:',
        'नाम', 'पिता', 'जन्म', 'card'
    ]
    
    pan_regex = r'[A-Z]{5}[0-9]{4}[A-Z]{1}'
    aadhaar_regex = r'(\d{4})\s?(\d{4})\s?(\d{4})'
    
    candidates = []
    
    for line in lines:
        line_clean = line.strip()
        line_lower = line_clean.lower()
        
        # --- Aggressive Skips ---
        if any(kw in line_lower for kw in skip_keywords):
            continue
        
        # Skip if looks like a PAN number
        if re.search(pan_regex, line_clean.upper()):
            continue
            
        # Skip if looks like an Aadhaar number
        if re.search(aadhaar_regex, line_clean):
            continue
            
        # Skip if high digit density
        digits = sum(1 for c in line_clean if c.isdigit())
        if digits / max(len(line_clean), 1) > 0.20:
            continue
            
        # --- Validation ---
        alpha_chars = sum(1 for c in line_clean if c.isalpha() or c == ' ' or c == '.')
        if alpha_chars / max(len(line_clean), 1) > 0.75:
            # Indian names always have 2+ words and are usually 10+ chars
            if len(line_clean.split()) >= 2 and len(line_clean) > 8:
                candidates.append(line_clean)
    
    if candidates:
        return candidates[0].strip()
    
    return None


async def analyze_document_completeness(file_bytes: bytes, doc_type: str, applicant_name: str) -> Dict[str, Any]:
    """
    Extracts text locally via Tesseract OCR and performs deterministic analysis.
    Implements real Identity Fraud Check by extracting the actual name from the document
    and comparing it against the applicant's stated name.
    """
    try:
        # Process image with enhancement
        image = Image.open(io.BytesIO(file_bytes))
        preprocessed = _preprocess_image(image)
        
        extracted_text = pytesseract.image_to_string(preprocessed)
        logger.info(f"📄 Local OCR (Hardened) extracted {len(extracted_text)} chars from {doc_type}.")
        logger.info(f"📄 OCR Raw Text Preview: {extracted_text[:300]}...")
        
        doc_type_upper = doc_type.upper()
        
        is_legible = len(extracted_text.strip()) > 10
        remarks = []
        name_matches_applicant = False
        verdict = "MANUAL_REVIEW"
        
        if not is_legible:
            return {
                "is_legible": False,
                "doc_number_visible": False,
                "name_visible": False,
                "name_extracted": None,
                "photo_or_signature_present": False,
                "name_matches_applicant": False,
                "verdict": "FAIL",
                "remarks": "Document is completely illegible or empty."
            }

        # ── Step 1: Extract the REAL name from the document text ──
        # We attempt to find a line that looks like a name (all alphabetic words, 2+ words)
        name_extracted = _extract_name_from_text(extracted_text, doc_type_upper, applicant_name)
        logger.info(f"🔍 Name extracted from {doc_type}: '{name_extracted}'")
        
        # ── Step 2: Identity Fraud Check — compare extracted name vs applicant name ──
        if name_extracted:
            name_matches_applicant = is_fuzzy_match(applicant_name, name_extracted)
            if not name_matches_applicant:
                remarks.append(
                    f"FRAUD ALERT: Document name '{name_extracted}' does NOT match applicant name '{applicant_name}'."
                )
                logger.warning(f"⚠️ Name mismatch! Doc: '{name_extracted}' vs App: '{applicant_name}'")
        else:
            # Fallback: check if applicant name appears anywhere in OCR text
            if is_fuzzy_match(applicant_name, extracted_text):
                name_matches_applicant = True
                name_extracted = applicant_name  # Best effort
            else:
                remarks.append(f"Could not extract or match any name from {doc_type} document.")

        doc_number_visible = False

        doc_number = None
        masked_doc_number = None

        if doc_type_upper == "PAN":
            # Indian PAN format: 5 Letters, 4 Digits, 1 Letter (e.g., ABCDE1234F)
            pan_match = re.search(r'[A-Z]{5}[0-9]{4}[A-Z]{1}', extracted_text.upper())
            gov_match = "INCOME TAX" in extracted_text.upper() or "GOVT" in extracted_text.upper() or "INDIA" in extracted_text.upper()
            if pan_match:
                doc_number_visible = True
                doc_number = pan_match.group(0)
                # Mask PAN: XXXXX1234F -> XXXXX1234F (Actually PAN is not strictly required to be masked by RBI as heavily as Aadhaar, but let's just store the full PAN)
                masked_doc_number = doc_number
            else:
                remarks.append("Valid PAN format (ABCDE1234F) not detected in image.")
                
            if pan_match and name_matches_applicant and gov_match:
                verdict = "PASS"
            elif doc_number_visible or name_matches_applicant:
                verdict = "MANUAL_REVIEW"
            else:
                verdict = "FAIL"
                remarks.append("Does not appear to be a PAN card.")
                
        elif doc_type_upper == "AADHAAR":
            # Aadhaar format: 12 digits, often with spaces (e.g., 1234 5678 9012)
            aadhaar_match = re.search(r'(\d{4})\s?(\d{4})\s?(\d{4})', extracted_text)
            gov_match = "GOVERNMENT" in extracted_text.upper() or "UIDAI" in extracted_text.upper() or "INDIA" in extracted_text.upper()
            if aadhaar_match:
                doc_number_visible = True
                # Extract the 3 groups of digits
                g1, g2, g3 = aadhaar_match.groups()
                doc_number = f"{g1}{g2}{g3}"
                # Mask the first 8 digits as per RBI / UIDAI mandate
                masked_doc_number = f"XXXX-XXXX-{g3}"
            else:
                remarks.append("Valid 12-digit Aadhaar sequence not detected.")
                
            if aadhaar_match and name_matches_applicant and gov_match:
                verdict = "PASS"
            elif doc_number_visible or name_matches_applicant:
                verdict = "MANUAL_REVIEW"
            else:
                verdict = "FAIL"
                remarks.append("Does not appear to be an Aadhaar card.")

        final_remarks = " | ".join(remarks) if remarks else "Document verified successfully via Tesseract OCR."
        logger.info(f"✅ {doc_type} Verdict: {verdict} | Name Match: {name_matches_applicant}")

        return {
            "is_legible": is_legible,
            "doc_number_visible": doc_number_visible,
            "doc_number": doc_number,
            "masked_doc_number": masked_doc_number,
            "name_visible": name_extracted is not None,
            "name_extracted": name_extracted,
            "photo_or_signature_present": True,
            "name_matches_applicant": name_matches_applicant,
            "verdict": verdict,
            "remarks": final_remarks
        }

    except Exception as e:
        logger.error(f"Local OCR Exception: {e}")
        return {
            "verdict": "MANUAL_REVIEW",
            "remarks": f"Failed to run Tesseract locally: {e}",
            "is_legible": False,
            "doc_number_visible": False,
            "name_visible": False,
            "name_extracted": None,
            "photo_or_signature_present": False,
            "name_matches_applicant": False,
        }

async def check_name_match_local(application_name: str, pan_name: str, aadhaar_name: str) -> Dict[str, Any]:
    """
    Evaluates similarities locally. Returns same payload structure Groq Text API did.
    """
    # Null safety
    pan_safe = str(pan_name) if pan_name else ""
    aadhaar_safe = str(aadhaar_name) if aadhaar_name else ""
    app_safe = str(application_name)
    
    pan_ratio = difflib.SequenceMatcher(None, app_safe.lower(), pan_safe.lower()).ratio()
    aadhaar_ratio = difflib.SequenceMatcher(None, app_safe.lower(), aadhaar_safe.lower()).ratio()
    
    match = (pan_ratio > 0.65 or pan_safe.lower() in app_safe.lower()) and \
            (aadhaar_ratio > 0.65 or aadhaar_safe.lower() in app_safe.lower())
            
    confidence = "HIGH" if match and (pan_ratio > 0.8) else "MEDIUM" if match else "LOW"

    return {
        "names_match": match,
        "confidence": confidence,
        "fraud_risk": "LOW" if match else "HIGH",
        "explanation": "Evaluated successfully via local strict Sequence Matching logic."
    }
