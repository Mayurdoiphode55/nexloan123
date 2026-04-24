"use client";

import React, { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import { paymentAPI } from "@/lib/api";

interface PaymentRecord {
  id: string;
  installment_no: number;
  amount: number;
  status: string;
  method: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function PaymentHistory({ loanId }: { loanId: string }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    paymentAPI.history(loanId).then(r => setPayments(r.data as PaymentRecord[])).catch(() => {});
  }, [loanId]);

  if (!payments.length) return null;

  const statusVariant = (s: string) => {
    if (s === "CAPTURED") return "success";
    if (s === "FAILED") return "error";
    return "warning";
  };

  const fmt = (d: string) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="ph-wrap">
      <p className="ph-label">PAYMENT HISTORY</p>
      <div className="ph-list">
        {payments.map(p => (
          <div key={p.id} className="ph-item" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
            <div className="ph-row">
              <div>
                <span className="ph-inst">EMI #{p.installment_no}</span>
                <span className="ph-date">{fmt(p.created_at)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className="ph-amount">₹{p.amount.toLocaleString("en-IN")}</span>
                <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
              </div>
            </div>
            {expanded === p.id && (
              <div className="ph-detail">
                {p.method && <div className="ph-detail-row"><span>Method</span><span>{p.method}</span></div>}
                {p.razorpay_payment_id && (
                  <div className="ph-detail-row"><span>Payment ID</span><code className="ph-code">{p.razorpay_payment_id}</code></div>
                )}
                {p.completed_at && <div className="ph-detail-row"><span>Completed</span><span>{fmt(p.completed_at)}</span></div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{`
        .ph-wrap { margin-top: var(--space-6); }
        .ph-label { font-size: var(--text-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: var(--space-3); }
        .ph-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .ph-item { background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-md); padding: var(--space-4); cursor: pointer; transition: background var(--transition-fast); }
        .ph-item:hover { background: var(--surface-overlay); }
        .ph-row { display: flex; justify-content: space-between; align-items: center; }
        .ph-inst { font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); display: block; }
        .ph-date { font-size: var(--text-xs); color: var(--text-tertiary); }
        .ph-amount { font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
        .ph-detail { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--surface-border); display: flex; flex-direction: column; gap: var(--space-2); }
        .ph-detail-row { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--text-secondary); }
        .ph-code { font-family: var(--font-mono); font-size: 11px; color: var(--accent-400); background: var(--surface-sunken); padding: 2px 6px; border-radius: 4px; }
      `}</style>
    </div>
  );
}
