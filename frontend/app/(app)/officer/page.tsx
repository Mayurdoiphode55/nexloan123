"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { officerAPI } from "@/lib/api";
import { isOfficerOrAbove } from "@/lib/auth";
import type { OfficerQueueItem, OfficerMetrics } from "@/types/loan";
import OfficerQueueList from "@/components/officer/OfficerQueueList";
import OfficerLoanPanel from "@/components/officer/OfficerLoanPanel";

export default function OfficerDashboardPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<OfficerQueueItem[]>([]);
  const [metrics, setMetrics] = useState<OfficerMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && !isOfficerOrAbove()) {
      router.push("/dashboard");
    }
  }, [router]);

  const loadQueue = useCallback(async () => {
    try {
      const filter = statusFilter === "ALL" ? undefined : statusFilter;
      const [qRes, mRes] = await Promise.all([
        officerAPI.getQueue(filter),
        officerAPI.getMetrics(),
      ]);
      setQueue(qRes.data);
      setMetrics(mRes.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleDecision = () => {
    setSelectedId(null);
    loadQueue();
  };

  return (
    <div className="od-page">
      {/* ── Header ─────────────────── */}
      <div className="od-header">
        <div>
          <h1 className="od-title">Officer Dashboard</h1>
          <p className="od-subtitle">Loan review queue · Real-time decisions</p>
        </div>
        {metrics && (
          <div className="od-metrics">
            <div className="od-metric">
              <span className="od-metric__val">{metrics.approval_rate}%</span>
              <span className="od-metric__label">Approval Rate</span>
            </div>
            <div className="od-metric">
              <span className="od-metric__val">{metrics.processed_today}</span>
              <span className="od-metric__label">Today</span>
            </div>
            <div className="od-metric">
              <span className="od-metric__val">{metrics.processed_this_week}</span>
              <span className="od-metric__label">This Week</span>
            </div>
            <div className="od-metric">
              <span className="od-metric__val">{metrics.total_decisions}</span>
              <span className="od-metric__label">Total</span>
            </div>
            <div className="od-metric">
              <span className="od-metric__val">{metrics.avg_processing_time}</span>
              <span className="od-metric__label">Avg Time</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Split Layout ─────────────────── */}
      <div className="od-layout">
        {/* Left: Queue */}
        <div className="od-queue-pane">
          <div className="od-pane-header">
            <span className="od-pane-title">LOAN QUEUE</span>
            <span className="od-pane-count">{queue.length} loans</span>
          </div>
          {loading ? (
            <div className="od-loading">Loading queue…</div>
          ) : (
            <OfficerQueueList
              items={queue}
              selectedId={selectedId}
              onSelect={setSelectedId}
              statusFilter={statusFilter}
              onFilterChange={f => { setStatusFilter(f); setSelectedId(null); }}
            />
          )}
        </div>

        {/* Right: Detail */}
        <div className="od-detail-pane">
          {selectedId ? (
            <OfficerLoanPanel loanId={selectedId} onDecision={handleDecision} />
          ) : (
            <div className="od-empty-state">
              <div className="od-empty-icon">📋</div>
              <p className="od-empty-text">Select a loan from the queue to review</p>
              <p className="od-empty-hint">Click any loan on the left to see full details, KYC documents, and make a decision.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .od-page { max-width: 1400px; margin: 0 auto; height: calc(100vh - 48px); display: flex; flex-direction: column; }

        .od-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: var(--space-4) 0 var(--space-6);
          flex-shrink: 0;
          flex-wrap: wrap;
          gap: var(--space-4);
        }
        .od-title { font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
        .od-subtitle { font-size: var(--text-xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

        .od-metrics { display: flex; gap: var(--space-4); flex-wrap: wrap; }
        .od-metric {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: var(--space-3) var(--space-5);
          text-align: center;
          min-width: 80px;
        }
        .od-metric__val { display: block; font-family: var(--font-display); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
        .od-metric__label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); margin-top: 2px; }

        .od-layout {
          flex: 1;
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: var(--space-4);
          min-height: 0;
        }

        .od-queue-pane, .od-detail-pane {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .od-pane-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4) var(--space-4) var(--space-2);
        }
        .od-pane-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
        .od-pane-count { font-size: var(--text-xs); color: var(--text-tertiary); background: var(--surface-sunken); padding: 2px 8px; border-radius: var(--radius-full); }

        .od-loading { text-align: center; padding: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); }

        .od-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: var(--space-12);
          text-align: center;
        }
        .od-empty-icon { font-size: 48px; margin-bottom: var(--space-4); opacity: 0.4; }
        .od-empty-text { font-size: var(--text-base); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-2); }
        .od-empty-hint { font-size: var(--text-sm); color: var(--text-tertiary); max-width: 320px; line-height: 1.6; }

        @media (max-width: 900px) {
          .od-layout { grid-template-columns: 1fr; height: auto; }
          .od-queue-pane { height: 400px; }
          .od-detail-pane { min-height: 500px; }
        }
      `}</style>
    </div>
  );
}
