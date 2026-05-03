'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchAgents() {
    try {
      const res = await fetch(`${API}/api/agent/admin/list`, { headers });
      if (res.ok) setAgents(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchAgents(); }, []);

  async function approveAgent(id: string) {
    await fetch(`${API}/api/agent/admin/approve/${id}`, { method: 'POST', headers });
    fetchAgents();
  }

  async function setRate(id: string, rate: number) {
    await fetch(`${API}/api/agent/admin/${id}/commission-rate`, {
      method: 'PUT', headers, body: JSON.stringify({ commission_rate_pct: rate }),
    });
    fetchAgents();
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Agent Management</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Manage DSA agents, approvals, and commissions</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 36, margin: 0 }}>👤</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>No agents registered</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {agents.map(a => (
            <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{a.full_name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{a.agent_code}</span>
                    {a.kyc_verified ? (
                      <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Verified</span>
                    ) : (
                      <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280' }}>{a.email} · {a.agency_name || 'Individual'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Commission Rate</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#4F46E5' }}>{a.commission_rate_pct}%</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Applications</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{a.total_applications}</div>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Disbursed</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A' }}>{a.total_disbursed}</div>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Commission Earned</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>₹{(a.total_commission_earned || 0).toLocaleString()}</div>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Registered</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{a.registered_at ? new Date(a.registered_at).toLocaleDateString() : ''}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {!a.kyc_verified && (
                  <button onClick={() => approveAgent(a.id)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Approve Agent</button>
                )}
                <button onClick={() => { const r = prompt('New commission rate %:', String(a.commission_rate_pct)); if (r) setRate(a.id, parseFloat(r)); }} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12, color: '#374151' }}>Set Rate</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
