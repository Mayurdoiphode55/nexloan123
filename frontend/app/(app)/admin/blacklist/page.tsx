'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BlacklistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ identifier_type: 'PAN', identifier_value: '', reason: '' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';

  async function fetchData() {
    try {
      const res = await fetch(`${API}/api/risk/blacklist`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setEntries(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function addEntry() {
    await fetch(`${API}/api/risk/blacklist/add`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowAdd(false);
    setForm({ identifier_type: 'PAN', identifier_value: '', reason: '' });
    fetchData();
  }

  async function removeEntry(id: string) {
    await fetch(`${API}/api/risk/blacklist/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  }

  const typeIcons: Record<string, string> = { PAN: '🆔', AADHAAR: '🪪', MOBILE: '📱', EMAIL: '📧', BANK_ACCOUNT: '🏦' };

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Blacklist Management</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Block identifiers from future applications</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>+ Add to Blacklist</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 36, margin: 0 }}>🛡️</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>Blacklist is empty</p>
          <p style={{ color: '#6B7280' }}>No identifiers have been blocked</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry) => (
            <div key={entry.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 24 }}>{typeIcons[entry.identifier_type] || '🚫'}</span>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{entry.identifier_type}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: '#111827' }}>{entry.identifier_value}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{entry.reason}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ''}</span>
                <button onClick={() => removeEntry(entry.id)} style={{ background: '#FEE2E2', color: '#DC2626', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 440, boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Add to Blacklist</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Identifier Type</label>
                <select value={form.identifier_type} onChange={(e) => setForm({...form, identifier_type: e.target.value})} style={inputStyle}>
                  <option value="PAN">PAN Number</option>
                  <option value="AADHAAR">Aadhaar Number</option>
                  <option value="MOBILE">Mobile Number</option>
                  <option value="EMAIL">Email Address</option>
                  <option value="BANK_ACCOUNT">Bank Account</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Identifier Value *</label>
                <input value={form.identifier_value} onChange={(e) => setForm({...form, identifier_value: e.target.value})} style={inputStyle} placeholder="e.g., ABCDE1234F" />
              </div>
              <div>
                <label style={labelStyle}>Reason *</label>
                <textarea value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} style={{...inputStyle, minHeight: 60}} placeholder="Reason for blacklisting..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addEntry} disabled={!form.identifier_value || !form.reason} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: form.identifier_value && form.reason ? 1 : 0.5 }}>Add to Blacklist</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
