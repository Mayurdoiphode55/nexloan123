'use client';

import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { servicingAPI } from '@/lib/api';
import type { FinancialHealth } from '@/types/loan';
import { Sparkles } from 'lucide-react';

interface HealthDashboardProps {
  loanId: string
}

export default function HealthDashboard({ loanId }: HealthDashboardProps) {
  const [data, setData] = useState<FinancialHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => n.toLocaleString('en-IN');

  useEffect(() => {
    servicingAPI.getHealth(loanId)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loanId]);

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        <div style={{ height: '200px', background: 'var(--surface-overlay)', borderRadius: 'var(--radius-xl)', animation: 'pulse 1.5s infinite' }} />
      </div>
    );
  }

  if (!data) return null;

  const trajectoryBadge = data.credit_score_trajectory === 'improving'
    ? <Badge variant="success">Improving ↑</Badge>
    : <Badge variant="warning">Stable →</Badge>;

  return (
    <div>
      <div style={{
        fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--text-tertiary)', marginBottom: '16px', fontWeight: 600,
      }}>
        FINANCIAL HEALTH
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Card 1: Prepayment Impact */}
        <Card padding="md">
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Prepayment Impact
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{
              background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)',
              padding: '14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                Pay ₹10,000 extra today
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--color-success)' }}>
                Save ₹{fmt(data.interest_saved_if_prepay_10k)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cut {data.tenure_reduction_if_prepay_10k} months
              </div>
            </div>
            <div style={{
              background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)',
              padding: '14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                Pay ₹25,000 extra today
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--color-success)' }}>
                Save ₹{fmt(data.interest_saved_if_prepay_25k)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cut {data.tenure_reduction_if_prepay_25k} months
              </div>
            </div>
          </div>
        </Card>

        {/* Card 2: Score Trajectory */}
        <Card padding="md">
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Score Trajectory
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              On-time payments: <strong style={{ color: 'var(--text-primary)' }}>{data.on_time_payments}</strong>
            </span>
            {trajectoryBadge}
          </div>
          {/* Progress bar */}
          <div style={{
            height: '6px', background: 'var(--surface-sunken)',
            borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '12px',
          }}>
            <div style={{
              height: '100%', width: `${Math.min(data.on_time_payments / 24 * 100, 100)}%`,
              background: 'var(--color-success)', borderRadius: 'var(--radius-full)',
              transition: 'width 1s ease',
            }} />
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {data.next_milestone}
          </p>
        </Card>

        {/* Card 3: AI Tip */}
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-400)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              AI Tip of the Week
            </span>
          </div>
          <p style={{
            fontSize: '14px', color: 'var(--text-secondary)',
            fontStyle: 'italic', lineHeight: 1.6,
          }}>
            {data.groq_tip}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
            Powered by Groq
          </p>
        </Card>
      </div>
    </div>
  );
}
