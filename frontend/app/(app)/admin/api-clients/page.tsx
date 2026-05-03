'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function APIClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [form, setForm] = useState({ client_name: '', webhook_url: '', monthly_request_limit: 1000 });

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchClients() {
    try {
      const res = await fetch(`${API}/api/embed/admin/clients`, { headers });
      if (res.ok) setClients(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchClients(); }, []);

  async function createClient() {
    const res = await fetch(`${API}/api/embed/admin/clients`, {
      method: 'POST', headers, body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.api_key);
      fetchClients();
    }
  }

  async function deactivateClient(id: string) {
    await fetch(`${API}/api/embed/admin/clients/${id}`, { method: 'DELETE', headers });
    fetchClients();
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>API Clients — Embedded Lending</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Manage partner API keys and webhooks</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ New Client</button>
      </div>

      {/* New API Key Display */}
      {newKey && (
        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#065F46', marginBottom: 8 }}>🔑 API Key Generated — Copy it now!</div>
          <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 14, color: '#111827', wordBreak: 'break-all', border: '1px solid #D1FAE5' }}>
            {newKey}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(newKey); setNewKey(''); setShowCreate(false); }} style={{ marginTop: 12, background: '#16A34A', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>📋 Copy & Close</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 36 }}>🔌</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>No API clients</p>
          <p style={{ color: '#6B7280' }}>Create an API client to enable embedded lending</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {clients.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{c.client_name}</span>
                    {c.is_active ? (
                      <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Active</span>
                    ) : (
                      <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Inactive</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', fontFamily: 'monospace' }}>Key: {c.api_key_masked}</div>
                  {c.webhook_url && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Webhook: {c.webhook_url}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Requests This Month</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{c.requests_this_month} / {c.monthly_request_limit}</div>
                  <div style={{ height: 4, width: 120, background: '#F3F4F6', borderRadius: 4, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (c.requests_this_month / c.monthly_request_limit) * 100)}%`, background: c.requests_this_month > c.monthly_request_limit * 0.8 ? '#DC2626' : '#4F46E5', borderRadius: 4 }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {c.is_active && (
                  <button onClick={() => deactivateClient(c.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Deactivate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && !newKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 460, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Create API Client</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Client Name *</label>
                <input value={form.client_name} onChange={(e) => setForm({...form, client_name: e.target.value})} style={inputStyle} placeholder="e.g., PayTM, PhonePe" />
              </div>
              <div>
                <label style={labelStyle}>Webhook URL</label>
                <input value={form.webhook_url} onChange={(e) => setForm({...form, webhook_url: e.target.value})} style={inputStyle} placeholder="https://partner.com/webhook" />
              </div>
              <div>
                <label style={labelStyle}>Monthly Request Limit</label>
                <input type="number" value={form.monthly_request_limit} onChange={(e) => setForm({...form, monthly_request_limit: parseInt(e.target.value)})} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createClient} disabled={!form.client_name} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: form.client_name ? 1 : 0.5 }}>Generate API Key</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
