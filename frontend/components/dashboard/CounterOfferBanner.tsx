'use client';

import React from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { underwritingAPI } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

interface CounterOfferBannerProps {
  loanId: string
  loanNumber: string
  originalAmount: number
  counterAmount: number
  counterRate: number
  onAccepted: () => void
  onDeclined: () => void
}

export default function CounterOfferBanner({
  loanId, loanNumber, originalAmount, counterAmount, counterRate, onAccepted, onDeclined,
}: CounterOfferBannerProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const fmt = (n: number) => n.toLocaleString('en-IN');

  // Estimate EMI (rough)
  const r = counterRate / (12 * 100);
  const n = 36;
  const emi = (counterAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await underwritingAPI.acceptCounter(loanId);
      showToast('Counter offer accepted! Loan approved.', 'success');
      onAccepted();
    } catch {
      showToast('Failed to accept offer. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      await underwritingAPI.declineCounter(loanId);
      showToast('Offer declined.', 'info');
      onDeclined();
    } catch {
      showToast('Failed to decline offer.', 'error');
    }
  };

  return (
    <div
      className="counter-offer-banner"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap',
        animation: 'slideDown 400ms ease forwards',
      }}
    >
      <div style={{ flex: 1, minWidth: '260px' }}>
        <Badge variant="warning">Special Offer Available</Badge>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: 700, color: 'var(--text-primary)', marginTop: '12px',
        }}>
          We can offer you ₹{fmt(counterAmount)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '14px',
          color: 'var(--text-secondary)', marginTop: '4px',
        }}>
          at {counterRate}% p.a. — EMI: ₹{fmt(Math.round(emi))}/month
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
          Your requested ₹{fmt(originalAmount)} is above our current limit for your profile.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px' }}>
        <Button variant="primary" size="md" loading={loading} onClick={handleAccept}>
          Accept Offer →
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDecline}>
          Decline
        </Button>
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
