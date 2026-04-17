"use client";

import React, { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

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
  onPayEMI?: (installmentNo: number) => Promise<void>;
}

const statusVariant = (s: string) => {
  switch (s?.toUpperCase()) {
    case "PAID": return "success";
    case "OVERDUE": return "error";
    case "PENDING": return "warning";
    default: return "neutral";
  }
};

export default function EMIScheduleTable({ schedule, onPayEMI }: EMIScheduleTableProps) {
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paidIds, setPaidIds] = useState<Set<number>>(new Set());

  const handlePay = async (installmentNo: number) => {
    if (!onPayEMI) return;
    setPayingId(installmentNo);
    try {
      await onPayEMI(installmentNo);
      setPaidIds((prev) => new Set(prev).add(installmentNo));
    } catch {
      // handled by parent
    } finally {
      setPayingId(null);
    }
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
