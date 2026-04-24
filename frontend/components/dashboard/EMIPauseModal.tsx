'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import { servicingAPI } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

interface EMIPauseModalProps {
  loanId: string
  nextEmiAmount: number
  nextDueDate: string
  pausesUsed: number
  onClose: () => void
  onPaused: () => void
}

export default function EMIPauseModal({
  loanId, nextEmiAmount, nextDueDate, pausesUsed, onClose, onPaused,
}: EMIPauseModalProps) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const canPause = pausesUsed < 1;

  const fmt = (n: number) => n.toLocaleString('en-IN');

  const handlePause = async () => {
    setLoading(true);
    try {
      await servicingAPI.pauseEMI(loanId, reason);
      showToast('EMI paused successfully!', 'success');
      onPaused();
      onClose();
    } catch {
      showToast('Failed to pause EMI. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={onClose}
    >
      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }} />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--surface-raised)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--surface-border)',
          padding: '32px',
          maxWidth: '460px', width: '100%',
          animation: 'modalIn 200ms ease forwards',
        }}
      >
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '20px',
          fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px',
        }}>
          Pause Your EMI
        </h2>

        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
          You can pause 1 EMI per year. Your next EMI will be moved to the end of your tenure with no penalty.
        </p>

        <div style={{
          background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)',
          padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Next EMI Amount</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              ₹{fmt(nextEmiAmount)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Due Date</span>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{nextDueDate}</span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
            Reason (optional)
          </label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Medical emergency"
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--surface-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)', fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {canPause ? (
          <div style={{
            fontSize: '13px', color: 'var(--color-warning)',
            marginBottom: '20px', padding: '10px 14px',
            background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)',
          }}>
            You have {1 - pausesUsed} pause remaining this year.
          </div>
        ) : (
          <div style={{
            fontSize: '13px', color: 'var(--color-error)',
            marginBottom: '20px', padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-md)',
          }}>
            You&apos;ve already used your pause for this year.
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} disabled={!canPause} onClick={handlePause}>
            Confirm Pause
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
