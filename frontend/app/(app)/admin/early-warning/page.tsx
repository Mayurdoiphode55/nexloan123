'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function EarlyWarningPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchData() {
    try {
      const res = await fetch(`${API}/api/risk/early-warning`, { headers });
      if (res.ok) setFlags(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function resolveFlag(id: string) {
    await fetch(`${API}/api/risk/early-warning/${id}/resolve`, { method: 'POST', headers });
    fetchData();
  }

  const highFlags = flags.filter(f => f.risk_label === 'HIGH');
  const mediumFlags = flags.filter(f => f.risk_label === 'MEDIUM');

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Early Warning System</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>AI-powered predictive default detection</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Total Warnings</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{flags.length}</div>
        </div>
        <div style={{ background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>High Risk</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{highFlags.length}</div>
        </div>
        <div style={{ background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A', padding: '20px 24px' }}>
          <div style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>Medium Risk</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#D97706' }}>{mediumFlags.length}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Analyzing repayment patterns...</div>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: 36 }}>✅</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#065F46' }}>No early warnings</p>
          <p style={{ color: '#6B7280' }}>All borrowers are on track with their repayments</p>
        </div>
      ) : (
        <>
          {/* HIGH Risk */}
          {highFlags.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#DC2626', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
                HIGH RISK ({highFlags.length})
              </h3>
              {highFlags.map(f => renderFlag(f))}
            </div>
          )}

          {/* MEDIUM Risk */}
          {mediumFlags.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#D97706', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} />
                MEDIUM RISK ({mediumFlags.length})
              </h3>
              {mediumFlags.map(f => renderFlag(f))}
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderFlag(f: any) {
    const isHigh = f.risk_label === 'HIGH';
    const isExpanded = expanded === f.id;
    const basis = f.prediction_basis || {};

    return (
      <div key={f.id} style={{
        background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '16px 20px', marginBottom: 10,
        borderLeft: `4px solid ${isHigh ? '#DC2626' : '#D97706'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{f.borrower_name}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{f.loan_number}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Risk Score Gauge */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: isHigh ? '#DC2626' : '#D97706' }}>
                {(f.risk_score * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>Risk Score</div>
            </div>
            {f.action_taken && (
              <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {f.action_taken.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Expandable Analysis */}
        <button onClick={() => setExpanded(isExpanded ? null : f.id)} style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 8, padding: 0 }}>
          {isExpanded ? '▼ Hide Analysis' : '▶ Show AI Analysis'}
        </button>

        {isExpanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
            {f.ai_analysis && (
              <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                💡 {f.ai_analysis}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, fontSize: 12 }}>
              <div style={{ background: '#F3F4F6', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#6B7280', fontSize: 10 }}>Avg Days Late</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{basis.avg_days_late || 0}</div>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#6B7280', fontSize: 10 }}>Late Payments</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{basis.late_payments || 0}/{basis.total_paid || 0}</div>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#6B7280', fontSize: 10 }}>Late Rate</div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{((basis.late_rate || 0) * 100).toFixed(1)}%</div>
              </div>
              <div style={{ background: '#F3F4F6', borderRadius: 6, padding: 8 }}>
                <div style={{ color: '#6B7280', fontSize: 10 }}>Trend</div>
                <div style={{ fontWeight: 700, color: basis.payment_trend === 'deteriorating' ? '#DC2626' : '#16A34A' }}>
                  {basis.payment_trend === 'deteriorating' ? '📉 Worsening' : '📈 Improving'}
                </div>
              </div>
            </div>
            <button onClick={() => resolveFlag(f.id)} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Mark Resolved</button>
          </div>
        )}
      </div>
    );
  }
}
