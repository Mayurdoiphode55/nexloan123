"use client";

import React, { useEffect, useState } from "react";
import { dashboardAPI } from "@/lib/api";

interface KPIData {
  active_loans: number;
  total_disbursed: number;
  total_loans: number;
  npa_rate: number;
  pending_kyc: number;
  pending_callbacks: number;
}

export default function KPICards() {
  const [data, setData] = useState<KPIData | null>(null);

  useEffect(() => {
    dashboardAPI.getKPIs().then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="kpi-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="kpi-card kpi-card--skeleton">
            <div className="kpi-skeleton-line" style={{ width: '60%', height: 12 }} />
            <div className="kpi-skeleton-line" style={{ width: '40%', height: 28, marginTop: 8 }} />
          </div>
        ))}
        <style jsx>{styles}</style>
      </div>
    );
  }

  const cards = [
    { label: "Active Loans", value: data.active_loans.toLocaleString('en-IN'), icon: "📋", color: "var(--accent-primary)" },
    { label: "Total Disbursed", value: `₹${formatCurrency(data.total_disbursed)}`, icon: "💰", color: "var(--color-success)" },
    { label: "NPA Rate", value: `${data.npa_rate}%`, icon: "⚠️", color: data.npa_rate > 5 ? "var(--color-error)" : "var(--color-success)" },
    { label: "Pending KYC", value: data.pending_kyc.toLocaleString('en-IN'), icon: "📄", color: "var(--color-warning)" },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, i) => (
        <div key={i} className="kpi-card" style={{ '--stagger-index': i } as React.CSSProperties}>
          <div className="kpi-card__header">
            <span className="kpi-card__label">{card.label}</span>
            <span className="kpi-card__icon">{card.icon}</span>
          </div>
          <span className="kpi-card__value" style={{ color: card.color }}>{card.value}</span>
        </div>
      ))}
      <style jsx>{styles}</style>
    </div>
  );
}

function formatCurrency(n: number): string {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return n.toLocaleString('en-IN');
}

const styles = `
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .kpi-grid { grid-template-columns: 1fr; } }

  .kpi-card {
    background: var(--surface-base);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    animation: cardEntrance 300ms ease forwards;
    animation-delay: calc(var(--stagger-index, 0) * 60ms);
    opacity: 0;
  }
  .kpi-card--skeleton {
    animation: none;
    opacity: 1;
  }
  .kpi-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kpi-card__label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-tertiary);
  }
  .kpi-card__icon {
    font-size: 18px;
  }
  .kpi-card__value {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .kpi-skeleton-line {
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
    animation: shimmer 1.5s infinite;
    background: linear-gradient(90deg, var(--surface-sunken) 25%, var(--surface-border) 50%, var(--surface-sunken) 75%);
    background-size: 200% 100%;
  }
`;
