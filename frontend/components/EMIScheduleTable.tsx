"use client";

import React, { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { paymentAPI } from "@/lib/api";

interface EMIRow {
  installment_no: number;
  due_date: string;
  emi_amount: number;
  principal: number;
  interest: number;
  outstanding_balance: number;
  status: string;
  paid_at?: string | null;
  paid_amount?: number | null;
}

interface EMIScheduleTableProps {
  schedule: EMIRow[];
  loanId?: string;
  onPayEMI?: (installmentNo: number) => Promise<void>;
  onRefresh?: () => void;
}

const statusVariant = (s: string) => {
  switch (s?.toUpperCase()) {
    case "PAID": return "success";
    case "OVERDUE": return "error";
    case "PENDING": return "warning";
    default: return "neutral";
  }
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function EMIScheduleTable({ schedule, loanId, onPayEMI, onRefresh }: EMIScheduleTableProps) {
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set());

  const handlePay = async (installmentNo: number) => {
    setPayingId(installmentNo);
    try {
      // If loanId provided, use Razorpay flow
      if (loanId) {
        const loaded = await loadRazorpayScript();
        const { data: order } = await paymentAPI.createOrder(loanId, installmentNo);

        if (!loaded || order.key_id === 'rzp_test_simulation') {
          // Simulation mode: directly verify with dummy data
          await paymentAPI.verify({
            order_id: order.order_id,
            payment_id: `pay_SIMULATED_${Date.now()}`,
            signature: 'simulated_signature',
          });
          setPaidIds((prev) => new Set(prev).add(installmentNo));
          onRefresh?.();
          return;
        }

        const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('nexloan_user') || '{}') : {};
        const options = {
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'NexLoan',
          description: `EMI Payment #${installmentNo}`,
          order_id: order.order_id,
          handler: async (response: any) => {
            try {
              await paymentAPI.verify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              setPaidIds((prev) => new Set(prev).add(installmentNo));
              onRefresh?.();
            } catch { /* silent */ }
          },
          prefill: { name: storedUser.full_name, email: storedUser.email, contact: storedUser.mobile },
          theme: { color: '#8B5CF6' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      }
      // Fallback to legacy onPayEMI prop
      if (onPayEMI) {
        await onPayEMI(installmentNo);
        setPaidIds((prev) => new Set(prev).add(installmentNo));
      }
    } catch { /* handled by Razorpay SDK */ }
    finally { setPayingId(null); }
  };

  if (!schedule || schedule.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No EMI schedule available.
      </div>
    );
  }

  return (
    <div className="emi-table-wrap">
      {/* Desktop table */}
      <table className="emi-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Due Date</th>
            <th>EMI</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, i) => {
            const isPaid = row.status?.toUpperCase() === "PAID" || paidIds.has(row.installment_no);
            const isOverdue = row.status?.toUpperCase() === "OVERDUE";
            return (
              <tr
                key={row.installment_no}
                className={`${isPaid ? 'emi-table__row--paid' : ''} ${isOverdue ? 'emi-table__row--overdue' : ''}`}
              >
                <td>{row.installment_no}</td>
                <td>{new Date(row.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td className="emi-table__mono">₹{row.emi_amount?.toLocaleString('en-IN')}</td>
                <td className="emi-table__mono">₹{row.principal?.toLocaleString('en-IN')}</td>
                <td className="emi-table__mono">₹{row.interest?.toLocaleString('en-IN')}</td>
                <td className="emi-table__mono">₹{row.outstanding_balance?.toLocaleString('en-IN')}</td>
                <td>
                  <Badge variant={isPaid ? "success" : statusVariant(row.status)}>
                    {isPaid ? "PAID" : row.status}
                  </Badge>
                </td>
                <td>
                  {!isPaid && row.status?.toUpperCase() !== "PAID" && onPayEMI && (
                    <Button
                      size="sm"
                      loading={payingId === row.installment_no}
                      onClick={() => handlePay(row.installment_no)}
                    >
                      {paidIds.has(row.installment_no) ? "✓" : "Pay"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile card layout */}
      <div className="emi-cards">
        {schedule.map((row) => {
          const isPaid = row.status?.toUpperCase() === "PAID" || paidIds.has(row.installment_no);
          return (
            <div key={row.installment_no} className={`emi-card ${isPaid ? 'emi-card--paid' : ''}`}>
              <div className="emi-card__header">
                <span className="emi-card__no">#{row.installment_no}</span>
                <Badge variant={isPaid ? "success" : statusVariant(row.status)}>
                  {isPaid ? "PAID" : row.status}
                </Badge>
              </div>
              <div className="emi-card__row">
                <span>Due</span>
                <span>{new Date(row.due_date).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="emi-card__row">
                <span>EMI</span>
                <span className="emi-table__mono">₹{row.emi_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="emi-card__row">
                <span>Balance</span>
                <span className="emi-table__mono">₹{row.outstanding_balance?.toLocaleString('en-IN')}</span>
              </div>
              {!isPaid && onPayEMI && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Button size="sm" fullWidth loading={payingId === row.installment_no} onClick={() => handlePay(row.installment_no)}>
                    Pay EMI
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .emi-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        /* ── Desktop Table ───────────────── */
        .emi-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-sm);
        }

        .emi-table thead tr {
          background: var(--surface-overlay);
        }
        .emi-table th {
          padding: var(--space-3) var(--space-4);
          text-align: left;
          font-size: var(--text-xs);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          white-space: nowrap;
        }
        .emi-table td {
          padding: var(--space-3) var(--space-4);
          color: var(--text-primary);
          white-space: nowrap;
          border-bottom: 1px solid var(--surface-border);
        }
        .emi-table tbody tr:nth-child(even) {
          background: rgba(255,255,255,0.02);
        }
        .emi-table tbody tr:hover {
          background: rgba(124,58,237,0.06);
        }

        .emi-table__row--paid td {
          color: var(--text-tertiary);
        }
        .emi-table__row--overdue {
          border-left: 3px solid var(--color-error);
        }

        .emi-table__mono {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
        }

        /* ── Mobile Cards ────────────────── */
        .emi-cards {
          display: none;
          flex-direction: column;
          gap: var(--space-3);
        }
        .emi-card {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }
        .emi-card--paid {
          opacity: 0.6;
        }
        .emi-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-3);
        }
        .emi-card__no {
          font-weight: 700;
          font-size: var(--text-sm);
          color: var(--text-primary);
        }
        .emi-card__row {
          display: flex;
          justify-content: space-between;
          padding: var(--space-1) 0;
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .emi-table { display: none; }
          .emi-cards { display: flex; }
        }
      `}</style>
    </div>
  );
}
