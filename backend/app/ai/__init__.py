"""
NexLoan AI Package — 4-Layer KYC Verification Pipeline

Layer 1: groq_vision       — Multimodal LLM (Llama 3.2 Vision via Groq)
Layer 2: layoutlm_service  — Document QA (LayoutLM via HuggingFace)
Layer 3: bert_ner           — Name Entity Recognition (difflib sequence matching)
Layer 4: tesseract_fallback — Local OCR (Tesseract + regex patterns)

Orchestrator: kyc_pipeline  — Runs the cascade and resolves final verdict
Narrative:    narrative_engine — Generates XAI reports
Chatbot:      chatbot_service  — Conversational AI (Groq LLM)

Legacy modules (kept for backward compatibility):
  - groq_service.py  — Original Groq integration
  - hf_service.py    — Original HuggingFace integration
  - ocr_service.py   — Original Tesseract integration
"""
