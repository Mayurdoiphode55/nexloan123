"""
NexLoan AI — KYC Pipeline Orchestrator
4-Layer cascade: Groq Vision → LayoutLM → BERT NER → Tesseract OCR

The orchestrator runs each layer sequentially and stops as soon as a layer
produces a definitive PASS or FAIL verdict. SKIP or MANUAL_REVIEW causes
fallthrough to the next layer. Layer 3 (BERT NER) is always run for
cross-document name consistency regardless of individual document verdicts.

After all layers run, the Narrative Engine generates an XAI report.
"""

import logging
from typing import Dict, Any, Tuple, List

from app.ai import groq_vision       # Layer 1
from app.ai import layoutlm_service  # Layer 2
from app.ai import bert_ner          # Layer 3
from app.ai import tesseract_fallback  # Layer 4
from app.ai import narrative_engine  # XAI

logger = logging.getLogger("nexloan.ai.pipeline")


async def _run_document_cascade(
    file_bytes: bytes,
    doc_type: str,
    applicant_name: str,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Runs the 4-layer cascade for a single document.
    Returns (winning_result, all_layer_results).
    """
    layers = [
        ("Layer 1 — Groq Vision", groq_vision.analyze),
        ("Layer 2 — LayoutLM",    layoutlm_service.analyze),
        ("Layer 4 — Tesseract",   tesseract_fallback.analyze),
    ]

    all_results: List[Dict[str, Any]] = []
    winner: Dict[str, Any] = {}

    for label, fn in layers:
        logger.info(f"🔄 Running {label} for {doc_type}...")
        try:
            result = await fn(file_bytes, doc_type, applicant_name)
        except Exception as e:
            logger.error(f"❌ {label} crashed: {e}")
            result = {"verdict": "SKIP", "layer": 0, "remarks": str(e)}

        all_results.append(result)
        verdict = result.get("verdict", "SKIP")

        if verdict in ("PASS", "FAIL"):
            winner = result
            logger.info(f"✅ {label} resolved {doc_type} as {verdict} — stopping cascade.")
            break
        elif verdict == "MANUAL_REVIEW" and result.get("name_extracted"):
            # Acceptable but keep going for a better answer
            if not winner or winner.get("verdict") == "SKIP":
                winner = result
        else:
            logger.info(f"⏭️ {label} returned {verdict} — falling through to next layer.")

    # If no layer gave a definitive answer, use the best we have
    if not winner or winner.get("verdict") == "SKIP":
        winner = all_results[-1] if all_results else {"verdict": "MANUAL_REVIEW", "layer": 0}

    return winner, all_results


async def run_kyc_pipeline(
    pan_bytes: bytes,
    aadhaar_bytes: bytes,
    applicant_name: str,
) -> Dict[str, Any]:
    """
    Full KYC verification pipeline.

    Returns:
        {
            "final_verdict": "PASS" | "FAIL" | "MANUAL_REVIEW",
            "pan_result": {...},
            "aadhaar_result": {...},
            "name_match_result": {...},
            "ai_remarks": "...markdown narrative...",
            "ai_raw_response": {...full trace...},
        }
    """
    logger.info("=" * 60)
    logger.info("🚀 NexLoan KYC Pipeline — Starting 4-Layer Verification")
    logger.info("=" * 60)

    # ── Run cascade for each document ────────────────────────────────
    pan_winner, pan_layers = await _run_document_cascade(pan_bytes, "PAN", applicant_name)
    aadhaar_winner, aadhaar_layers = await _run_document_cascade(aadhaar_bytes, "AADHAAR", applicant_name)

    # ── Layer 3 — Cross-document name consistency ────────────────────
    pan_name = pan_winner.get("name_extracted", "")
    aadhaar_name = aadhaar_winner.get("name_extracted", "")

    name_match_result = await bert_ner.cross_match_names(
        applicant_name, str(pan_name), str(aadhaar_name)
    )

    # ── Overall Verdict Logic ────────────────────────────────────────
    if name_match_result.get("fraud_risk") == "HIGH":
        final_verdict = "FAIL"
    elif (
        pan_winner.get("verdict") == "PASS"
        and aadhaar_winner.get("verdict") == "PASS"
        and name_match_result.get("names_match") is True
    ):
        final_verdict = "PASS"
    else:
        final_verdict = "MANUAL_REVIEW"

    # ── Generate XAI Narrative ───────────────────────────────────────
    pan_narrative = narrative_engine.generate_document_narrative(
        "PAN", pan_layers, pan_winner
    )
    aadhaar_narrative = narrative_engine.generate_document_narrative(
        "AADHAAR", aadhaar_layers, aadhaar_winner
    )
    full_narrative = narrative_engine.generate_overall_narrative(
        pan_narrative, aadhaar_narrative, name_match_result, final_verdict
    )

    logger.info(f"🏁 Pipeline complete — Final Verdict: {final_verdict}")
    logger.info("=" * 60)

    return {
        "final_verdict": final_verdict,
        "pan_result": pan_winner,
        "aadhaar_result": aadhaar_winner,
        "name_match_result": name_match_result,
        "ai_remarks": full_narrative,
        "ai_raw_response": {
            "pan_layers": pan_layers,
            "aadhaar_layers": aadhaar_layers,
            "pan_winner": pan_winner,
            "aadhaar_winner": aadhaar_winner,
            "name_match": name_match_result,
        },
    }
