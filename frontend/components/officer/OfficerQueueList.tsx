"use client";
import React from "react";
import Badge from "@/components/ui/Badge";
import type { OfficerQueueItem } from "@/types/loan";

const STATUS_PRIORITY: Record<string, string> = {
  KYC_VERIFIED: "REVIEW",
  KYC_PENDING: "KYC",
  UNDERWRITING: "UW",
  APPLICATION: "NEW",
};

const aiColor = (r: string | null) =>
  r === "APPROVE" ? "success" : r === "REJECT" ? "error" : "neutral";

interface Props {
  items: OfficerQueueItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter: string;
  onFilterChange: (f: string) => void;
}

export default function OfficerQueueList({ items, selectedId, onSelect, statusFilter, onFilterChange }: Props) {
  const FILTERS = ["ALL", "KYC_VERIFIED", "UNDERWRITING", "APPROVED", "REJECTED"];

  return (
    <div className="oq-wrap">
      <div className="oq-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`oq-filter ${statusFilter === f ? "oq-filter--active" : ""}`}
            onClick={() => onFilterChange(f)}
          >
            {f === "ALL" ? "All" : STATUS_PRIORITY[f] ?? f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="oq-empty">No loans in queue</div>
      )}

      <div className="oq-list">
        {items.map(item => (
          <div
            key={item.id}
            className={`oq-item ${selectedId === item.id ? "oq-item--selected" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <div className="oq-item__top">
              <span className="oq-item__num">{item.loan_number}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {item.loan_type === "COLLATERAL" && (
                  <Badge variant="warning">COLLATERAL</Badge>
                )}
                {item.ai_recommendation && (
                  <Badge variant={aiColor(item.ai_recommendation)}>
                    AI: {item.ai_recommendation}
                  </Badge>
                )}
              </div>
            </div>
            <div className="oq-item__name">{item.borrower_name}</div>
            <div className="oq-item__meta">
              <span>₹{(item.loan_amount ?? 0).toLocaleString("en-IN")}</span>
              <span>·</span>
              <span>Score: {item.credit_score ?? "—"}</span>
              <span>·</span>
              <span>{item.status.replace(/_/g, " ")}</span>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .oq-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .oq-filters { display: flex; gap: var(--space-2); flex-wrap: wrap; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--surface-border); }
        .oq-filter { padding: 4px 10px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid var(--surface-border); background: transparent; color: var(--text-tertiary); cursor: pointer; transition: all var(--transition-fast); }
        .oq-filter--active { background: var(--accent-500); border-color: var(--accent-500); color: white; }
        .oq-list { flex: 1; overflow-y: auto; }
        .oq-empty { text-align: center; padding: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); }
        .oq-item { padding: var(--space-4); border-bottom: 1px solid var(--surface-border); cursor: pointer; transition: background var(--transition-fast); }
        .oq-item:hover { background: var(--surface-overlay); }
        .oq-item--selected { background: rgba(124,58,237,0.08); border-left: 3px solid var(--accent-500); }
        .oq-item__top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .oq-item__num { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-accent); font-weight: 600; }
        .oq-item__name { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
        .oq-item__meta { font-size: 11px; color: var(--text-tertiary); display: flex; gap: 6px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
