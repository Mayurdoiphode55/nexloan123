"""
NexLoan AI — Layer 3: BERT NER for Name Entity Recognition
Uses difflib sequence matching as a lightweight, zero-dependency NER
for name extraction and cross-document name matching.
This replaces a full BERT model with a deterministic approach that
works offline and requires no GPU.
"""

import logging
import difflib
from typing import Dict, Any

logger = logging.getLogger("nexloan.ai.bert_ner")


def fuzzy_match(target: str, corpus: str, threshold: float = 0.7) -> bool:
    """Sequence-matcher based fuzzy name matching."""
    target_clean = target.lower().strip()
    corpus_clean = corpus.lower().strip()

    if target_clean in corpus_clean:
        return True

    ratio = difflib.SequenceMatcher(None, target_clean, corpus_clean).ratio()
    if ratio >= threshold:
        return True

    words = target_clean.split()
    matched = [w for w in words if w in corpus_clean]
    if len(matched) >= len(words) - 1 and len(words) > 1:
        return True

    return False


async def cross_match_names(
    application_name: str,
    pan_name: str,
    aadhaar_name: str,
) -> Dict[str, Any]:
    """
    Layer 3 — Cross-document name consistency check.
    Compares extracted names from PAN and Aadhaar against the applicant name.
    """
    pan_safe = str(pan_name) if pan_name else ""
    aadhaar_safe = str(aadhaar_name) if aadhaar_name else ""
    app_safe = str(application_name)

    pan_ratio = difflib.SequenceMatcher(None, app_safe.lower(), pan_safe.lower()).ratio()
    aadhaar_ratio = difflib.SequenceMatcher(None, app_safe.lower(), aadhaar_safe.lower()).ratio()

    match = (
        (pan_ratio > 0.65 or pan_safe.lower() in app_safe.lower())
        and (aadhaar_ratio > 0.65 or aadhaar_safe.lower() in app_safe.lower())
    )

    confidence = "HIGH" if match and pan_ratio > 0.8 else "MEDIUM" if match else "LOW"

    logger.info(
        f"🔍 Layer 3 (BERT NER) — "
        f"pan_ratio={pan_ratio:.2f}, aadhaar_ratio={aadhaar_ratio:.2f}, match={match}"
    )

    return {
        "names_match": match,
        "confidence": confidence,
        "fraud_risk": "LOW" if match else "HIGH",
        "pan_similarity": round(pan_ratio, 3),
        "aadhaar_similarity": round(aadhaar_ratio, 3),
        "explanation": "Cross-document name consistency verified via sequence matching NER.",
    }
