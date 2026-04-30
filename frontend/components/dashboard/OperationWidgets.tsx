"use client";

import React, { useEffect, useState } from "react";
import { dashboardAPI } from "@/lib/api";

interface PipelineStage {
  stage: string;
  count: number;
}

interface RepaymentData {
  month: string;
  paid: number;
  pending: number;
  overdue: number;
  paused: number;
  total: number;
}

export default function OperationWidgets() {
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [repayment, setRepayment] = useState<RepaymentData | null>(null);

  useEffect(() => {
    dashboardAPI.getPipeline().then(r => setPipeline(r.data.stages || [])).catch(() => {});
    dashboardAPI.getRepaymentHealth().then(r => setRepayment(r.data)).catch(() => {});
  }, []);

  const activePipeline = pipeline.filter(s =>
    ["INQUIRY", "KYC_PENDING", "KYC_VERIFIED", "UNDERWRITING", "APPROVED", "DISBURSED", "ACTIVE"].includes(s.stage)
  );
  const maxCount = Math.max(...activePipeline.map(s => s.count), 1);

  const stageLabels: Record<string, string> = {
    INQUIRY: "Inquiry",
    KYC_PENDING: "KYC Pending",
    KYC_VERIFIED: "KYC Verified",
    UNDERWRITING: "Underwriting",
    APPROVED: "Approved",
    DISBURSED: "Disbursed",
    ACTIVE: "Active",
  };

  return (
    <div className="ops-widgets">
      {/* Pipeline Widget */}
      <div className="ops-widget">
        <h4 className="ops-widget__title">Loan Origination Pipeline</h4>
        <div className="pipeline-bars">
          {activePipeline.map((s, i) => (
            <div key={s.stage} className="pipeline-row">
              <span className="pipeline-label">{stageLabels[s.stage] || s.stage}</span>
              <div className="pipeline-bar-track">
                <div
                  className="pipeline-bar-fill"
                  style={{
                    width: `${Math.max((s.count / maxCount) * 100, 4)}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              </div>
              <span className="pipeline-count">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Repayment Health Widget */}
      <div className="ops-widget">
        <h4 className="ops-widget__title">
          Repayment Health
          {repayment && <span className="ops-widget__subtitle">{repayment.month}</span>}
        </h4>
        {repayment ? (
          <div className="repayment-grid">
            <div className="repayment-stat">
              <div className="repayment-dot" style={{ background: "var(--color-success)" }} />
              <div>
                <span className="repayment-value">{repayment.paid}</span>
                <span className="repayment-label">On-time</span>
              </div>
            </div>
            <div className="repayment-stat">
              <div className="repayment-dot" style={{ background: "var(--color-warning)" }} />
              <div>
                <span className="repayment-value">{repayment.pending}</span>
                <span className="repayment-label">Pending</span>
              </div>
            </div>
            <div className="repayment-stat">
              <div className="repayment-dot" style={{ background: "var(--color-error)" }} />
              <div>
                <span className="repayment-value">{repayment.overdue}</span>
                <span className="repayment-label">Overdue</span>
              </div>
            </div>
            <div className="repayment-stat">
              <div className="repayment-dot" style={{ background: "var(--text-tertiary)" }} />
              <div>
                <span className="repayment-value">{repayment.paused}</span>
                <span className="repayment-label">Paused</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="ops-widget__empty">Loading...</p>
        )}
      </div>

      <style jsx>{`
        .ops-widgets {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }
        @media (max-width: 768px) { .ops-widgets { grid-template-columns: 1fr; } }

        .ops-widget {
          background: var(--surface-base);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
        }
        .ops-widget__title {
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .ops-widget__subtitle {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-tertiary);
          background: var(--surface-sunken);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }
        .ops-widget__empty {
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          text-align: center;
          padding: var(--space-6);
        }

        .pipeline-bars { display: flex; flex-direction: column; gap: 8px; }
        .pipeline-row {
          display: grid;
          grid-template-columns: 90px 1fr 36px;
          align-items: center;
          gap: var(--space-2);
        }
        .pipeline-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pipeline-bar-track {
          height: 20px;
          background: var(--surface-sunken);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .pipeline-bar-fill {
          height: 100%;
          background: var(--accent-primary);
          border-radius: var(--radius-sm);
          animation: barGrow 500ms ease forwards;
          opacity: 0.85;
          transition: width 300ms ease;
        }
        .pipeline-count {
          font-size: var(--text-xs);
          font-weight: 700;
          color: var(--text-primary);
          text-align: right;
          font-family: var(--font-mono);
        }

        .repayment-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        .repayment-stat {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .repayment-dot {
          width: 10px;
          height: 10px;
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }
        .repayment-value {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--text-primary);
          display: block;
          line-height: 1.2;
        }
        .repayment-label {
          font-size: 11px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 500;
        }

        @keyframes barGrow {
          from { width: 0; }
        }
      `}</style>
    </div>
  );
}
