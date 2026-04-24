"use client";

import React, { useEffect, useState } from "react";
import { trackingAPI } from "@/lib/api";
import type { Milestone, MilestoneResponse, DocumentStatusInfo, DocumentsResponse } from "@/types/loan";

interface LoanTrackerProps {
  loanId: string;
  compact?: boolean; // When true, shows only current milestone and is expandable
}

export default function LoanTracker({ loanId, compact = false }: LoanTrackerProps) {
  const [milestoneData, setMilestoneData] = useState<MilestoneResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentStatusInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [msRes, docRes] = await Promise.all([
          trackingAPI.getMilestones(loanId),
          trackingAPI.getDocuments(loanId),
        ]);
        setMilestoneData(msRes.data);
        setDocuments(docRes.data.documents || []);
      } catch (err) {
        console.error("Failed to load tracking data", err);
      } finally {
        setLoading(false);
      }
    };
    if (loanId) fetchData();
  }, [loanId]);

  if (loading) {
    return (
      <div className="tracker-skeleton">
        <div className="tracker-skeleton__line" />
        <div className="tracker-skeleton__line tracker-skeleton__line--short" />
        <div className="tracker-skeleton__line tracker-skeleton__line--short" />
      </div>
    );
  }

  if (!milestoneData || milestoneData.milestones.length === 0) {
    return (
      <div className="tracker-empty">
        <p>No tracking data available yet.</p>
      </div>
    );
  }

  const currentMilestone = milestoneData.milestones.find(m => m.status === "CURRENT");
  const currentIdx = milestoneData.milestones.findIndex(m => m.status === "CURRENT");

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) + ", " + d.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDocStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED": return "✅";
      case "FAILED": return "❌";
      default: return "⏳";
    }
  };

  return (
    <div className="loan-tracker">
      {/* Compact Header (when embeddable in dashboard) */}
      {compact && (
        <button
          className="tracker-compact-header"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="tracker-compact-header__left">
            <span className="tracker-compact-header__label">LOAN JOURNEY</span>
            {currentMilestone && (
              <span className="tracker-compact-header__current">
                <span className="tracker-compact-header__dot" />
                {currentMilestone.description}
              </span>
            )}
          </div>
          <svg
            className={`tracker-compact-header__chevron ${expanded ? "tracker-compact-header__chevron--open" : ""}`}
            width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Timeline */}
      <div
        className="tracker-timeline-wrap"
        style={{
          maxHeight: expanded ? "2000px" : "0",
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.4s ease, opacity 0.3s ease",
        }}
      >
        <div className="tracker-timeline">
          {milestoneData.milestones.map((ms, idx) => (
            <div key={ms.id} className={`tracker-milestone tracker-milestone--${ms.status.toLowerCase()}`}>
              {/* Connector Line */}
              {idx < milestoneData.milestones.length - 1 && (
                <div className={`tracker-milestone__line ${ms.status === "DONE" ? "tracker-milestone__line--done" : ""}`} />
              )}

              {/* Circle */}
              <div className={`tracker-milestone__circle tracker-milestone__circle--${ms.status.toLowerCase()}`}>
                {ms.status === "DONE" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              {/* Content */}
              <div className="tracker-milestone__content">
                <span className="tracker-milestone__title">{ms.description}</span>
                {ms.status === "DONE" && ms.completed_at && (
                  <span className="tracker-milestone__date">{formatDate(ms.completed_at)}</span>
                )}
                {ms.status === "CURRENT" && (
                  <span className="tracker-milestone__estimate">
                    {milestoneData.estimated_timeline}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Document Verification */}
        {documents.length > 0 && (
          <div className="tracker-documents">
            <h4 className="tracker-documents__title">Document Verification</h4>
            {documents.map((doc) => (
              <div key={doc.document_type} className="tracker-documents__row">
                <span className="tracker-documents__type">
                  {doc.document_type === "PAN" ? "PAN Card" : "Aadhaar Card"}
                </span>
                <span className={`tracker-documents__badge tracker-documents__badge--${doc.status.toLowerCase()}`}>
                  {getDocStatusIcon(doc.status)} {doc.status === "VERIFIED" ? "Verified" : doc.status === "FAILED" ? "Failed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .loan-tracker {
          width: 100%;
        }

        /* ── Skeleton ────────────────────── */
        .tracker-skeleton {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding: var(--space-4);
        }
        .tracker-skeleton__line {
          height: 16px;
          border-radius: var(--radius-sm);
          background: var(--surface-sunken);
          animation: shimmer 1.5s infinite;
          width: 100%;
        }
        .tracker-skeleton__line--short { width: 60%; }

        .tracker-empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }

        /* ── Compact Header ──────────────── */
        .tracker-compact-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: var(--space-4);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          transition: background var(--transition-fast);
          border-radius: var(--radius-md);
        }
        .tracker-compact-header:hover {
          background: var(--surface-sunken);
        }
        .tracker-compact-header__left {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
        .tracker-compact-header__label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }
        .tracker-compact-header__current {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-primary);
        }
        .tracker-compact-header__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-400);
          animation: pulse-dot 2s infinite;
        }
        .tracker-compact-header__chevron {
          color: var(--text-tertiary);
          transition: transform 0.3s ease;
        }
        .tracker-compact-header__chevron--open {
          transform: rotate(180deg);
        }

        /* ── Timeline ────────────────────── */
        .tracker-timeline {
          padding: var(--space-4) var(--space-6);
          display: flex;
          flex-direction: column;
        }

        .tracker-milestone {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
          position: relative;
          padding-bottom: var(--space-6);
        }
        .tracker-milestone:last-child {
          padding-bottom: 0;
        }

        /* Vertical line */
        .tracker-milestone__line {
          position: absolute;
          left: 11px;
          top: 24px;
          bottom: 0;
          width: 2px;
          background: var(--surface-border);
          border-left: 2px dashed var(--surface-border);
        }
        .tracker-milestone__line--done {
          border-left: none;
          background: var(--color-success);
        }

        /* Circle indicators */
        .tracker-milestone__circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }
        .tracker-milestone__circle--done {
          background: var(--color-success);
        }
        .tracker-milestone__circle--current {
          background: transparent;
          border: 3px solid var(--accent-400);
          animation: pulse-ring 2s infinite;
        }
        .tracker-milestone__circle--pending {
          background: transparent;
          border: 2px solid var(--surface-border);
        }

        /* Content */
        .tracker-milestone__content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-top: 2px;
        }
        .tracker-milestone__title {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-primary);
        }
        .tracker-milestone--pending .tracker-milestone__title {
          color: var(--text-tertiary);
        }
        .tracker-milestone__date {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          font-family: var(--font-mono);
        }
        .tracker-milestone__estimate {
          font-size: var(--text-xs);
          color: var(--accent-400);
          font-weight: 500;
        }

        /* ── Documents ───────────────────── */
        .tracker-documents {
          margin: var(--space-4) var(--space-6);
          padding: var(--space-4);
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
        }
        .tracker-documents__title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: var(--space-3);
        }
        .tracker-documents__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-2) 0;
        }
        .tracker-documents__row:not(:last-child) {
          border-bottom: 1px solid var(--surface-border);
        }
        .tracker-documents__type {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-primary);
        }
        .tracker-documents__badge {
          font-size: var(--text-xs);
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 100px;
        }
        .tracker-documents__badge--verified {
          color: var(--color-success);
          background: rgba(34, 197, 94, 0.1);
        }
        .tracker-documents__badge--failed {
          color: var(--color-error);
          background: rgba(239, 68, 68, 0.1);
        }
        .tracker-documents__badge--pending {
          color: var(--color-warning);
          background: rgba(245, 158, 11, 0.1);
        }

        /* ── Animations ──────────────────── */
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
          50% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
