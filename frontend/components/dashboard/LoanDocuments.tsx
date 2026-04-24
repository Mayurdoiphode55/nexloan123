'use client';

import Badge from '@/components/ui/Badge';
import type { LoanStatus } from '@/types/loan';

interface LoanDocumentsProps {
  loanId: string;
  loanStatus: LoanStatus;
}

const DOCS = [
  { name: 'Key Fact Statement (KFS)', path: 'kfs', availableAfter: ['APPROVED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'PRE_CLOSED'] },
  { name: 'Sanction Letter', path: 'sanction', availableAfter: ['APPROVED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'PRE_CLOSED'] },
  { name: 'EMI Schedule', path: 'schedule', availableAfter: ['DISBURSED', 'ACTIVE', 'CLOSED', 'PRE_CLOSED'] },
  { name: 'No-Dues Certificate', path: 'nodues', availableAfter: ['CLOSED', 'PRE_CLOSED'] },
];

export default function LoanDocuments({ loanId, loanStatus }: LoanDocumentsProps) {
  const openDocument = (path: string) => {
    window.open(`/documents/${path}/${loanId}`, '_blank');
  };

  return (
    <div className="loan-docs">
      {DOCS.map(doc => {
        const available = doc.availableAfter.includes(loanStatus);
        return (
          <div key={doc.path} className="loan-docs__row">
            <div className="loan-docs__info">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="loan-docs__name">{doc.name}</span>
            </div>
            <div className="loan-docs__actions">
              <Badge variant={available ? 'success' : 'neutral'}>
                {available ? 'Available' : 'Not Available'}
              </Badge>
              {available && (
                <button className="loan-docs__btn" onClick={() => openDocument(doc.path)}>
                  Download ↗
                </button>
              )}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .loan-docs {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }
        .loan-docs__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-5);
          border-bottom: 1px solid var(--surface-border);
          transition: background var(--transition-fast);
        }
        .loan-docs__row:last-child {
          border-bottom: none;
        }
        .loan-docs__row:hover {
          background: var(--surface-sunken);
        }
        .loan-docs__info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          color: var(--text-secondary);
        }
        .loan-docs__name {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-primary);
        }
        .loan-docs__actions {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .loan-docs__btn {
          background: transparent;
          border: 1px solid var(--accent-500);
          color: var(--accent-400);
          padding: 6px 14px;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .loan-docs__btn:hover {
          background: var(--accent-500);
          color: white;
        }
      `}</style>
    </div>
  );
}
