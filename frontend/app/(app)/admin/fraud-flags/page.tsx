'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function FraudFlagsPage() {
  const [flags, setFlags] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolveId, setResolveId] = useState<string|null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';

  async function fetchData() {
    try {
      const [flagsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/risk/fraud-flags`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/risk/fraud-stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (flagsRes.ok) setFlags(await flagsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function resolveFlag() {
    if (!resolveId) return;
    await fetch(`${API}/api/risk/fraud-flags/${resolveId}/resolve`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution_note: resolveNote }),
    });
    setResolveId(null);
    setResolveNote('');
    fetchData();
  }

  const severityColors: Record<string, { bg: string; color: string }> = {
    CRITICAL: { bg: '#FEE2E2', color: '#991B1B' },
    HIGH: { bg: '#FEF3C7', color: '#92400E' },
    MEDIUM: { bg: '#DBEAFE', color: '#1D4ED8' },
    LOW: { bg: '#D1FAE5', color: '#065F46' },
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Fraud Detection Dashboard</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Cross-application fraud pattern flags</p>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Total Flags</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{stats.total}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Unresolved</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{stats.unresolved}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Critical</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#991B1B' }}>{stats.by_severity?.CRITICAL || 0}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>High</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#92400E' }}>{stats.by_severity?.HIGH || 0}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: 36, margin: 0 }}>✅</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#065F46' }}>No active fraud flags</p>
          <p style={{ color: '#6B7280' }}>All clear — no suspicious patterns detected</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={thStyle}>Severity</th>
                <th style={thStyle}>Flag Type</th>
                <th style={thStyle}>Loan</th>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Detected</th>
                <th style={{...thStyle, textAlign: 'right'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const sev = severityColors[f.severity] || severityColors.MEDIUM;
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #F3F4F6', borderLeft: `4px solid ${sev.color}` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: sev.bg, color: sev.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{f.severity}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#111827' }}>{f.flag_type.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontFamily: 'monospace', fontSize: 13 }}>{f.loan_number}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', maxWidth: 300 }}>{f.description}</td>
                    <td style={{ padding: '12px 16px', color: '#9CA3AF', fontSize: 12 }}>{f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => setResolveId(f.id)} style={{ background: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Resolve</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setResolveId(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Resolve Fraud Flag</h3>
            <textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution note..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D1D5DB', minHeight: 80, fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setResolveId(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={resolveFlag} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Resolve</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' };
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' };
