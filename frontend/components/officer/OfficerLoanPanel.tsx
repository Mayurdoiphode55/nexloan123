"use client";
import React, { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { officerAPI } from "@/lib/api";
import type { OfficerLoanFull, OfficerNote } from "@/types/loan";

interface Props { loanId: string; onDecision: () => void; }

const statusVariant = (s: string) =>
  s === "APPROVE" ? "success" : s === "REJECT" ? "error" : "neutral";

export default function OfficerLoanPanel({ loanId, onDecision }: Props) {
  const [data, setData] = useState<OfficerLoanFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "kyc" | "notes" | "docs">("overview");
  const [noteText, setNoteText] = useState("");
  const [docType, setDocType] = useState("");
  const [docReason, setDocReason] = useState("");
  const [showDecide, setShowDecide] = useState(false);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [overrideAI, setOverrideAI] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await officerAPI.getLoanFull(loanId); setData(r.data); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); setTab("overview"); setNoteText(""); setDocType(""); setDocReason(""); setShowDecide(false); }, [loanId]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try { await officerAPI.addNote(loanId, { content: noteText, is_internal: true }); setNoteText(""); await load(); }
    catch { /* silent */ } finally { setSaving(false); }
  };

  const requestDoc = async () => {
    if (!docType.trim()) return;
    setSaving(true);
    try { await officerAPI.requestDocument(loanId, { document_type: docType, reason: docReason }); setDocType(""); setDocReason(""); await load(); }
    catch { /* silent */ } finally { setSaving(false); }
  };

  const submitDecision = async () => {
    if (overrideAI && overrideReason.length < 20) return;
    setSaving(true);
    try {
      await officerAPI.decide(loanId, { decision, override_ai: overrideAI, override_reason: overrideReason || undefined });
      setShowDecide(false); onDecision();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  if (loading) return <div className="olp-center">Loading loan details…</div>;
  if (!data) return <div className="olp-center">Failed to load</div>;

  const { loan, borrower, kyc, notes, document_requests } = data;
  const alreadyDecided = !!loan.officer_decision;

  return (
    <div className="olp-wrap">
      {/* Header */}
      <div className="olp-header">
        <div>
          <span className="olp-num">{loan.loan_number}</span>
          <span className="olp-name">{borrower.full_name}</span>
        </div>
        <div className="olp-header-right">
          {loan.ai_recommendation && (
            <Badge variant={statusVariant(loan.ai_recommendation)}>AI: {loan.ai_recommendation}</Badge>
          )}
          {alreadyDecided ? (
            <Badge variant={statusVariant(loan.officer_decision!)}>{loan.officer_decision}</Badge>
          ) : (
            <Button size="sm" onClick={() => setShowDecide(true)}>Make Decision</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="olp-tabs">
        {(["overview", "kyc", "notes", "docs"] as const).map(t => (
          <button key={t} className={`olp-tab ${tab === t ? "olp-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t === "overview" ? "Overview" : t === "kyc" ? "KYC" : t === "notes" ? `Notes (${notes.length})` : `Docs (${document_requests.length})`}
          </button>
        ))}
      </div>

      <div className="olp-body">
        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="olp-grid">
            {[
              ["Loan Amount", `₹${(loan.loan_amount ?? 0).toLocaleString("en-IN")}`],
              ["Tenure", `${loan.tenure_months ?? "—"} months`],
              ["Interest Rate", loan.interest_rate ? `${loan.interest_rate}% p.a.` : "—"],
              ["EMI", loan.emi_amount ? `₹${loan.emi_amount.toLocaleString("en-IN")}` : "—"],
              ["Credit Score", loan.credit_score ?? "—"],
              ["DTI Ratio", loan.dti_ratio ? `${(loan.dti_ratio * 100).toFixed(1)}%` : "—"],
              ["Purpose", loan.purpose ?? "—"],
              ["Status", loan.status.replace(/_/g, " ")],
            ].map(([k, v]) => (
              <div key={k as string} className="olp-stat">
                <span className="olp-stat__label">{k as string}</span>
                <span className="olp-stat__value">{v as string}</span>
              </div>
            ))}
            <div className="olp-divider" />
            {[
              ["Borrower", borrower.full_name],
              ["Email", borrower.email],
              ["Mobile", borrower.mobile],
              ["Income", borrower.monthly_income ? `₹${borrower.monthly_income.toLocaleString("en-IN")}` : "—"],
              ["Employment", borrower.employment_type ?? "—"],
              ["Existing EMI", borrower.existing_emi ? `₹${borrower.existing_emi.toLocaleString("en-IN")}` : "₹0"],
            ].map(([k, v]) => (
              <div key={k as string} className="olp-stat">
                <span className="olp-stat__label">{k as string}</span>
                <span className="olp-stat__value">{v as string}</span>
              </div>
            ))}
            {loan.rejection_reason && (
              <div className="olp-alert olp-alert--error">{loan.rejection_reason}</div>
            )}
            {loan.officer_override_reason && (
              <div className="olp-alert olp-alert--warning">Override reason: {loan.officer_override_reason}</div>
            )}
          </div>
        )}

        {/* KYC Tab */}
        {tab === "kyc" && (
          <div>
            {!kyc ? <p className="olp-empty">No KYC documents uploaded</p> : (
              <div>
                <div className="olp-kyc-verdict">
                  <Badge variant={kyc.ai_verdict === "PASS" ? "success" : kyc.ai_verdict === "FAIL" ? "error" : "warning"}>
                    AI Verdict: {kyc.ai_verdict ?? "PENDING"}
                  </Badge>
                </div>
                <div className="olp-grid" style={{ marginTop: "var(--space-4)" }}>
                  {[
                    ["PAN Number", kyc.pan_number ?? "—"],
                    ["PAN Name", kyc.pan_name_extracted ?? "—"],
                    ["PAN Legible", kyc.pan_legible ? "✅" : "❌"],
                    ["PAN Name Match", kyc.pan_name_match ? "✅" : "❌"],
                    ["Aadhaar Number", kyc.aadhaar_number ?? "—"],
                    ["Aadhaar Name", kyc.aadhaar_name_extracted ?? "—"],
                    ["Aadhaar Legible", kyc.aadhaar_legible ? "✅" : "❌"],
                    ["Photo Present", kyc.aadhaar_photo_present ? "✅" : "❌"],
                  ].map(([k, v]) => (
                    <div key={k as string} className="olp-stat">
                      <span className="olp-stat__label">{k as string}</span>
                      <span className="olp-stat__value">{v as string}</span>
                    </div>
                  ))}
                </div>
                {kyc.pan_doc_url && (
                  <div className="olp-docs-links">
                    <a href={kyc.pan_doc_url} target="_blank" rel="noreferrer" className="olp-doc-link">📄 View PAN</a>
                    {kyc.aadhaar_doc_url && (
                      <a href={kyc.aadhaar_doc_url} target="_blank" rel="noreferrer" className="olp-doc-link">📄 View Aadhaar</a>
                    )}
                  </div>
                )}
                {kyc.ai_remarks && (
                  <div className="olp-remarks">
                    <p className="olp-remarks__label">AI REPORT</p>
                    <pre className="olp-remarks__text">{kyc.ai_remarks}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {tab === "notes" && (
          <div>
            <div className="olp-note-input">
              <textarea
                className="olp-textarea"
                placeholder="Add internal note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
              />
              <Button size="sm" loading={saving} onClick={addNote} disabled={!noteText.trim()}>Add Note</Button>
            </div>
            {notes.length === 0 && <p className="olp-empty">No notes yet</p>}
            {notes.map((n: OfficerNote) => (
              <div key={n.id} className="olp-note">
                <div className="olp-note__meta">
                  <span className="olp-note__author">{n.officer_name}</span>
                  <span className="olp-note__time">{new Date(n.created_at).toLocaleString("en-IN")}</span>
                </div>
                <p className="olp-note__content">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Docs Tab */}
        {tab === "docs" && (
          <div>
            <div className="olp-doc-request-form">
              <input className="olp-input" placeholder="Document type (e.g. Bank Statement)" value={docType} onChange={e => setDocType(e.target.value)} />
              <input className="olp-input" placeholder="Reason (optional)" value={docReason} onChange={e => setDocReason(e.target.value)} />
              <Button size="sm" loading={saving} onClick={requestDoc} disabled={!docType.trim()}>Request Doc</Button>
            </div>
            {document_requests.length === 0 && <p className="olp-empty">No document requests</p>}
            {document_requests.map(d => (
              <div key={d.id} className="olp-doc-item">
                <div className="olp-doc-item__top">
                  <span className="olp-doc-item__type">{d.document_type}</span>
                  <Badge variant={d.status === "VERIFIED" ? "success" : d.status === "UPLOADED" ? "info" : "warning"}>{d.status}</Badge>
                </div>
                {d.reason && <p className="olp-doc-item__reason">{d.reason}</p>}
                <p className="olp-doc-item__date">{new Date(d.created_at).toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {showDecide && (
        <div className="olp-modal-overlay" onClick={() => setShowDecide(false)}>
          <div className="olp-modal" onClick={e => e.stopPropagation()}>
            <h3 className="olp-modal__title">Make Decision</h3>
            <div className="olp-decision-btns">
              <button className={`olp-dec-btn olp-dec-btn--approve ${decision === "APPROVE" ? "olp-dec-btn--selected" : ""}`} onClick={() => setDecision("APPROVE")}>✅ Approve</button>
              <button className={`olp-dec-btn olp-dec-btn--reject ${decision === "REJECT" ? "olp-dec-btn--selected" : ""}`} onClick={() => setDecision("REJECT")}>❌ Reject</button>
            </div>
            {loan.ai_recommendation && loan.ai_recommendation !== decision && (
              <div className="olp-override-warn">
                ⚠️ This overrides the AI recommendation ({loan.ai_recommendation})
                <label className="olp-check">
                  <input type="checkbox" checked={overrideAI} onChange={e => setOverrideAI(e.target.checked)} />
                  I confirm override
                </label>
              </div>
            )}
            {overrideAI && (
              <textarea
                className="olp-textarea"
                placeholder="Override reason (min 20 chars)…"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                rows={3}
              />
            )}
            <div className="olp-modal__actions">
              <Button variant="ghost" onClick={() => setShowDecide(false)}>Cancel</Button>
              <Button loading={saving} onClick={submitDecision} disabled={overrideAI && overrideReason.length < 20}>Confirm {decision}</Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .olp-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; position: relative; }
        .olp-center { display: flex; align-items: center; justify-content: center; height: 200px; color: var(--text-tertiary); font-size: var(--text-sm); }
        .olp-header { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--surface-border); }
        .olp-header-right { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
        .olp-num { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-accent); display: block; }
        .olp-name { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); display: block; margin-top: 2px; }
        .olp-tabs { display: flex; border-bottom: 1px solid var(--surface-border); }
        .olp-tab { padding: var(--space-3) var(--space-4); font-size: var(--text-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-tertiary); background: none; border: none; cursor: pointer; border-bottom: 2px solid transparent; transition: all var(--transition-fast); }
        .olp-tab--active { color: var(--accent-400); border-bottom-color: var(--accent-500); }
        .olp-body { flex: 1; overflow-y: auto; padding: var(--space-5); }
        .olp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
        .olp-divider { grid-column: 1 / -1; height: 1px; background: var(--surface-border); margin: var(--space-2) 0; }
        .olp-stat { background: var(--surface-sunken); border-radius: var(--radius-md); padding: var(--space-3); }
        .olp-stat__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); display: block; }
        .olp-stat__value { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-top: 2px; display: block; }
        .olp-alert { grid-column: 1 / -1; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-xs); }
        .olp-alert--error { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: var(--color-error); }
        .olp-alert--warning { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: var(--color-warning); }
        .olp-kyc-verdict { margin-bottom: var(--space-3); }
        .olp-docs-links { display: flex; gap: var(--space-3); margin-top: var(--space-4); }
        .olp-doc-link { font-size: var(--text-sm); color: var(--text-accent); text-decoration: underline; }
        .olp-remarks { margin-top: var(--space-4); background: var(--surface-sunken); border-radius: var(--radius-md); padding: var(--space-4); }
        .olp-remarks__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-bottom: var(--space-2); }
        .olp-remarks__text { font-size: 11px; color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6; font-family: var(--font-mono); overflow-x: auto; }
        .olp-note-input { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
        .olp-textarea { width: 100%; padding: var(--space-3); background: var(--surface-sunken); border: 1px solid var(--surface-border); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-body); font-size: var(--text-sm); resize: vertical; outline: none; }
        .olp-textarea:focus { border-color: var(--accent-400); }
        .olp-input { width: 100%; padding: 10px var(--space-3); background: var(--surface-sunken); border: 1px solid var(--surface-border); border-radius: var(--radius-md); color: var(--text-primary); font-family: var(--font-body); font-size: var(--text-sm); outline: none; margin-bottom: var(--space-2); }
        .olp-input:focus { border-color: var(--accent-400); }
        .olp-empty { color: var(--text-tertiary); font-size: var(--text-sm); text-align: center; padding: var(--space-6) 0; }
        .olp-note { background: var(--surface-sunken); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-3); }
        .olp-note__meta { display: flex; justify-content: space-between; margin-bottom: var(--space-2); }
        .olp-note__author { font-size: var(--text-xs); font-weight: 600; color: var(--text-accent); }
        .olp-note__time { font-size: 10px; color: var(--text-tertiary); }
        .olp-note__content { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6; }
        .olp-doc-request-form { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
        .olp-doc-item { background: var(--surface-sunken); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-2); }
        .olp-doc-item__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .olp-doc-item__type { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .olp-doc-item__reason { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 2px; }
        .olp-doc-item__date { font-size: 10px; color: var(--text-tertiary); }
        .olp-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
        .olp-modal { background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-xl); padding: var(--space-6); width: 100%; max-width: 440px; box-shadow: var(--shadow-lg); }
        .olp-modal__title { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-4); }
        .olp-decision-btns { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
        .olp-dec-btn { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; border: 2px solid var(--surface-border); background: var(--surface-sunken); color: var(--text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .olp-dec-btn--approve.olp-dec-btn--selected { border-color: var(--color-success); background: rgba(34,197,94,0.1); color: var(--color-success); }
        .olp-dec-btn--reject.olp-dec-btn--selected { border-color: var(--color-error); background: rgba(239,68,68,0.1); color: var(--color-error); }
        .olp-override-warn { font-size: var(--text-xs); color: var(--color-warning); background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2); }
        .olp-check { display: flex; align-items: center; gap: var(--space-2); color: var(--text-secondary); cursor: pointer; }
        .olp-modal__actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-4); }
      `}</style>
    </div>
  );
}
