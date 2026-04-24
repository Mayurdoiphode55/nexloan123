"""
NexLoan AI — Narrative Engine (XAI Reports)
Transforms raw pipeline layer results into human-readable, explainable AI reports.
These narratives are stored in `ai_remarks` and shown in the Admin panel.
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger("nexloan.ai.narrative")


def _layer_label(layer: int) -> str:
    return {1: "Groq Vision", 2: "LayoutLM", 3: "BERT NER", 4: "Tesseract OCR"}.get(
        layer, f"Layer {layer}"
    )


def generate_document_narrative(
    doc_type: str,
    layer_results: List[Dict[str, Any]],
    winning_result: Dict[str, Any],
) -> str:
    """
    Builds a Markdown-formatted audit narrative for a single document.
    Used by the admin panel's AI Analysis section.
    """
    lines = []
    lines.append(f"### 📋 {doc_type} Card — AI Verification Report\n")

    # Which layer won
    winning_layer = winning_result.get("layer", "?")
    winning_engine = winning_result.get("engine", _layer_label(winning_layer))
    verdict = winning_result.get("verdict", "UNKNOWN")
    lines.append(f"**Final Verdict:** `{verdict}` (resolved by **{winning_engine}**)")
    lines.append("")

    # Extracted data summary
    name = winning_result.get("name_extracted") or "Not detected"
    doc_num = winning_result.get("doc_number") or winning_result.get("masked_doc_number") or "Not detected"
    name_match = winning_result.get("name_matches_applicant", False)

    lines.append(f"**Name on Card:** {name}")
    lines.append(f"**Document Number:** {doc_num}")
    lines.append(f"**Name Match:** {'✅ Yes' if name_match else '❌ No'}")
    lines.append(f"**Legible:** {'✅' if winning_result.get('is_legible') else '❌'}")
    lines.append("")

    # Layer cascade trace
    lines.append("---")
    lines.append("#### Layer Cascade Trace")
    lines.append("")

    for r in layer_results:
        layer = r.get("layer", "?")
        v = r.get("verdict", "N/A")
        eng = r.get("engine", _layer_label(layer))
        icon = "✅" if v == "PASS" else "❌" if v == "FAIL" else "⏭️" if v == "SKIP" else "⚠️"
        note = r.get("remarks", "")[:120]
        lines.append(f"- {icon} **Layer {layer}** ({eng}): `{v}` — {note}")

    lines.append("")

    # Any fraud alerts
    if not name_match and name != "Not detected":
        lines.append("> ⚠️ **FRAUD RISK**: Extracted name does not match the applicant.")
        lines.append("")

    return "\n".join(lines)


def generate_overall_narrative(
    pan_narrative: str,
    aadhaar_narrative: str,
    name_match_result: Dict[str, Any],
    final_verdict: str,
) -> str:
    """
    Combines individual document narratives + cross-document check
    into the full XAI report stored in `ai_remarks`.
    """
    lines = []
    lines.append("# 🤖 NexLoan AI — KYC Verification Report\n")

    # Overall verdict badge
    icon = "✅" if final_verdict == "PASS" else "❌" if final_verdict == "FAIL" else "⚠️"
    lines.append(f"## {icon} Overall Verdict: `{final_verdict}`\n")

    # Individual documents
    lines.append(pan_narrative)
    lines.append("")
    lines.append(aadhaar_narrative)
    lines.append("")

    # Cross-document consistency
    lines.append("---")
    lines.append("### 🔗 Cross-Document Name Consistency (Layer 3)\n")

    nm = name_match_result
    lines.append(f"- **Names Match:** {'✅ Yes' if nm.get('names_match') else '❌ No'}")
    lines.append(f"- **Confidence:** {nm.get('confidence', 'N/A')}")
    lines.append(f"- **Fraud Risk:** {nm.get('fraud_risk', 'UNKNOWN')}")
    lines.append(f"- **PAN Similarity:** {nm.get('pan_similarity', 'N/A')}")
    lines.append(f"- **Aadhaar Similarity:** {nm.get('aadhaar_similarity', 'N/A')}")
    lines.append("")

    return "\n".join(lines)
