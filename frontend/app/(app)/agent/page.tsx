'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AgentPortalPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'applications' | 'commissions'>('overview');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  async function fetchData() {
    try {
      const [dRes, cRes] = await Promise.all([
        fetch(`${API}/api/agent/dashboard`, { headers }),
        fetch(`${API}/api/agent/commissions`, { headers }),
      ]);
      if (dRes.ok) setDashboard(await dRes.json());
      if (cRes.ok) setCommissions(await cRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>Loading agent portal...</div>;

  if (!dashboard) return (
    <div style={{ padding: '32px', maxWidth: 600, margin: '80px auto', textAlign: 'center' }}>
      <p style={{ fontSize: 48 }}>👤</p>
      <h2 style={{ color: '#111827', margin: '12px 0 8px' }}>Agent Portal</h2>
      <p style={{ color: '#6B7280', marginBottom: 24 }}>You need to register as an agent to access this portal.</p>
      <a href="/agent/register" style={{ background: '#4F46E5', color: '#fff', padding: '12px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 600 }}>Register as Agent</a>
    </div>
  );

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Agent Portal</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', background: '#EEF2FF', color: '#4F46E5', padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 13 }}>{dashboard.agent_code}</span>
            {dashboard.kyc_verified ? (
              <span style={{ background: '#D1FAE5', color: '#065F46', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✓ Verified</span>
            ) : (
              <span style={{ background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Pending Verification</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Commission Rate</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4F46E5' }}>{dashboard.commission_rate_pct}%</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Applications</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{dashboard.total_applications}</div>
          <div style={{ fontSize: 12, color: '#16A34A' }}>{dashboard.approved} approved</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Approval Rate</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#16A34A' }}>{dashboard.approval_rate}%</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Total Earned</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>₹{(dashboard.total_commission_earned || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>₹{(dashboard.total_commission_paid || 0).toLocaleString()} paid</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>Pending Payout</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>₹{(dashboard.pending_commission || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#F3F4F6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['overview', 'applications', 'commissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280',
            fontWeight: 600, fontSize: 13, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && dashboard.recent_applications && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recent Applications</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              <th style={thStyle}>Loan #</th>
              <th style={thStyle}>Amount</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Date</th>
            </tr></thead>
            <tbody>
              {dashboard.recent_applications.map((app: any) => (
                <tr key={app.loan_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{app.loan_number}</td>
                  <td style={{ padding: '10px 16px' }}>₹{(app.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: ['APPROVED','ACTIVE','DISBURSED'].includes(app.status) ? '#D1FAE5' : app.status === 'REJECTED' ? '#FEE2E2' : '#FEF3C7',
                      color: ['APPROVED','ACTIVE','DISBURSED'].includes(app.status) ? '#065F46' : app.status === 'REJECTED' ? '#991B1B' : '#92400E',
                    }}>{app.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#9CA3AF' }}>{app.created_at ? new Date(app.created_at).toLocaleDateString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'commissions' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              <th style={thStyle}>Disbursed Amt</th>
              <th style={thStyle}>Rate</th>
              <th style={thStyle}>Commission</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Paid At</th>
            </tr></thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 16px' }}>₹{(c.disbursed_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 16px' }}>{c.commission_rate}%</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: '#16A34A' }}>₹{(c.commission_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      background: c.status === 'PAID' ? '#D1FAE5' : '#FEF3C7', color: c.status === 'PAID' ? '#065F46' : '#92400E',
                    }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#9CA3AF' }}>{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {commissions.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No commissions yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const kpiCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' };
const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' };
