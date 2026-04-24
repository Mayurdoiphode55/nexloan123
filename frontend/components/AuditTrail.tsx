"use client";

import React from "react";
import type { AuditLogEntry } from "@/types/loan";

interface AuditTrailProps {
  entries: AuditLogEntry[];
}

export default function AuditTrail({ entries }: AuditTrailProps) {
  if (!entries || entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
        No audit entries yet.
      </div>
    );
  }

  return (
    <div className="audit-trail">
      <h3 className="audit-trail__title">AUDIT TRAIL</h3>
      <div className="audit-trail__list">
        {entries.map((entry, i) => (
          <div key={entry.id} className="audit-trail__item">
            <div className="audit-trail__dot-col">
              <div className="audit-trail__dot" />
              {i < entries.length - 1 && <div className="audit-trail__line" />}
            </div>
            <div className="audit-trail__content">
              <p className="audit-trail__action">{entry.action?.replace(/_/g, ' ')}</p>
              {entry.from_status && entry.to_status && (
                <p className="audit-trail__status">
                  {entry.from_status} → {entry.to_status}
                </p>
              )}
              <p className="audit-trail__meta">
                {new Date(entry.created_at).toLocaleString()} · {entry.actor}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .audit-trail__title {
          font-size: var(--text-xs);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          margin-bottom: var(--space-4);
        }
        .audit-trail__list {
          display: flex;
          flex-direction: column;
        }
        .audit-trail__item {
          display: flex;
          gap: var(--space-3);
        }
        .audit-trail__dot-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex-shrink: 0;
          width: 16px;
        }
        .audit-trail__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-400);
          flex-shrink: 0;
          margin-top: 6px;
        }
        .audit-trail__line {
          width: 1px;
          flex: 1;
          background: var(--surface-border);
          min-height: 16px;
        }
        .audit-trail__content {
          padding-bottom: var(--space-4);
        }
        .audit-trail__action {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-primary);
          text-transform: capitalize;
        }
        .audit-trail__status {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin-top: 2px;
          font-family: var(--font-mono);
        }
        .audit-trail__meta {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          font-family: var(--font-mono);
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
