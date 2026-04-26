'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Milestone {
  key: string;
  label: string;
  status: 'completed' | 'current' | 'upcoming';
  timestamp: string | null;
  detail: string | null;
  estimated_date?: string | null;
}

interface TimelineData {
  loan_id: string;
  progress_percent: number;
  milestones: Milestone[];
}

interface LoanTimelineProps {
  loanId: string;
}

export default function LoanTimeline({ loanId }: LoanTimelineProps) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const res = await api.get(`/api/tracking/${loanId}/timeline`);
        setData(res.data);
      } catch {
        // Use default milestones if API not available
        setData({
          loan_id: loanId,
          progress_percent: 0,
          milestones: [],
        });
      }
      setLoading(false);
    };
    if (loanId) fetchTimeline();
  }, [loanId]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
        Loading timeline...
      </div>
    );
  }

  if (!data || data.milestones.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>
        No timeline data available
      </div>
    );
  }

  const progress = data.progress_percent;

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#a3a3a3', fontSize: '13px' }}>Loan Progress</span>
          <span style={{ color: '#a855f7', fontSize: '13px', fontWeight: 600 }}>{progress}%</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #a855f7, #10b981)',
              borderRadius: '4px',
              transition: 'width 1s ease-out',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#525252', fontSize: '11px' }}>Applied</span>
          <span style={{ color: '#525252', fontSize: '11px' }}>Closed</span>
        </div>
      </div>

      {/* Milestone list */}
      <div style={{ position: 'relative' }}>
        {data.milestones.map((m, i) => {
          const isLast = i === data.milestones.length - 1;

          return (
            <div key={m.key} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
              {/* Vertical line + circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', flexShrink: 0 }}>
                {/* Circle */}
                <div
                  style={{
                    width: m.status === 'current' ? '20px' : '16px',
                    height: m.status === 'current' ? '20px' : '16px',
                    borderRadius: '50%',
                    background:
                      m.status === 'completed' ? '#10b981' :
                      m.status === 'current' ? '#a855f7' :
                      'rgba(255,255,255,0.1)',
                    border:
                      m.status === 'completed' ? '3px solid #059669' :
                      m.status === 'current' ? '3px solid #7c3aed' :
                      '2px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    zIndex: 2,
                    animation: m.status === 'current' ? 'milestonePulse 2s infinite' : 'none',
                    boxShadow: m.status === 'current' ? '0 0 12px rgba(168,85,247,0.4)' : 'none',
                  }}
                >
                  {m.status === 'completed' && (
                    <span style={{ color: 'white', fontSize: '10px', fontWeight: 700 }}>✓</span>
                  )}
                </div>
                {/* Connecting line */}
                {!isLast && (
                  <div
                    style={{
                      width: '2px',
                      flex: 1,
                      minHeight: '32px',
                      background:
                        m.status === 'completed' ? '#10b981' :
                        m.status === 'current' ? 'linear-gradient(to bottom, #a855f7, rgba(255,255,255,0.08))' :
                        'rgba(255,255,255,0.08)',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingBottom: isLast ? 0 : '24px', minHeight: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: m.status === 'current' ? 700 : m.status === 'completed' ? 500 : 400,
                        color:
                          m.status === 'completed' ? '#e5e5e5' :
                          m.status === 'current' ? '#a855f7' :
                          '#525252',
                      }}
                    >
                      {m.label}
                    </span>
                    {m.status === 'current' && (
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '11px',
                          background: 'rgba(168,85,247,0.15)',
                          color: '#a855f7',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                  <span style={{ color: '#525252', fontSize: '12px', flexShrink: 0 }}>
                    {m.timestamp
                      ? new Date(m.timestamp).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : m.estimated_date
                        ? `Est. ${new Date(m.estimated_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                        : '—'
                    }
                  </span>
                </div>
                {m.detail && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#737373' }}>
                    {m.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes milestonePulse {
          0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.3); }
          50% { box-shadow: 0 0 20px rgba(168,85,247,0.6); }
        }
      `}</style>
    </div>
  );
}
