'use client';
import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RateRulesPage() {
  const tenant = useTenant();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', priority: 0, description: '',
    condition_loan_purpose: '', condition_score_min: '', condition_score_max: '',
    condition_amount_min: '', condition_amount_max: '',
    rate_override: '', rate_adjustment: '',
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';

  async function fetchRules() {
    try {
      const res = await fetch(`${API}/api/risk/rate-rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRules(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchRules(); }, []);

  async function createRule() {
    const body: any = { ...form };
    ['condition_score_min','condition_score_max','priority'].forEach(k => { if(body[k]==='') delete body[k]; else body[k]=Number(body[k]); });
    ['condition_amount_min','condition_amount_max','rate_override','rate_adjustment'].forEach(k => { if(body[k]==='') delete body[k]; else body[k]=Number(body[k]); });
    if(!body.condition_loan_purpose) delete body.condition_loan_purpose;

    await fetch(`${API}/api/risk/rate-rules/create`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    setForm({ name: '', priority: 0, description: '', condition_loan_purpose: '', condition_score_min: '', condition_score_max: '', condition_amount_min: '', condition_amount_max: '', rate_override: '', rate_adjustment: '' });
    fetchRules();
  }

  async function toggleRule(id: string) {
    await fetch(`${API}/api/risk/rate-rules/${id}/toggle`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    });
    fetchRules();
  }

  async function deleteRule(id: string) {
    await fetch(`${API}/api/risk/rate-rules/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    fetchRules();
  }

  const primary = tenant.primary_color || '#4F46E5';

  return (
    <>
      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Dynamic Rate Rules</h1>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Configure interest rate overrides and adjustments</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ background: primary, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            + New Rule
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
        ) : rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: 36, margin: 0 }}>📐</p>
            <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>No rate rules configured</p>
            <p>Click "New Rule" to create your first dynamic rate rule</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Priority</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Conditions</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Rate Effect</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #F3F4F6', opacity: rule.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#EEF2FF', color: primary, padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
                        #{rule.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{rule.name}</div>
                      {rule.description && <div style={{ color: '#9CA3AF', fontSize: 12 }}>{rule.description}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {rule.condition_loan_purpose && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 4 }}>Purpose: {rule.condition_loan_purpose}</span>}
                        {(rule.condition_score_min || rule.condition_score_max) && <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '2px 6px', borderRadius: 4 }}>Score: {rule.condition_score_min || '*'}–{rule.condition_score_max || '*'}</span>}
                        {(rule.condition_amount_min || rule.condition_amount_max) && <span style={{ background: '#E0E7FF', color: '#3730A3', padding: '2px 6px', borderRadius: 4 }}>Amount: ₹{(rule.condition_amount_min||0).toLocaleString()}–₹{(rule.condition_amount_max||'∞').toLocaleString()}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {rule.rate_override != null && <span style={{ color: '#DC2626', fontWeight: 700 }}>Override: {rule.rate_override}%</span>}
                      {rule.rate_adjustment != null && <span style={{ color: rule.rate_adjustment > 0 ? '#DC2626' : '#16A34A', fontWeight: 700 }}>{rule.rate_adjustment > 0 ? '+' : ''}{rule.rate_adjustment}%</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button onClick={() => toggleRule(rule.id)} style={{ background: rule.is_active ? '#D1FAE5' : '#FEE2E2', color: rule.is_active ? '#065F46' : '#991B1B', border: 'none', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => deleteRule(rule.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13 }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#111827' }}>Create Rate Rule</h2>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={labelStyle}>Rule Name *</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} style={inputStyle} placeholder="e.g., Festive Season Discount" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Loan Purpose</label>
                  <input value={form.condition_loan_purpose} onChange={(e) => setForm({...form, condition_loan_purpose: e.target.value})} style={inputStyle} placeholder="Medical, Education..." />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Min Score</label>
                  <input type="number" value={form.condition_score_min} onChange={(e) => setForm({...form, condition_score_min: e.target.value})} style={inputStyle} placeholder="e.g., 600" />
                </div>
                <div>
                  <label style={labelStyle}>Max Score</label>
                  <input type="number" value={form.condition_score_max} onChange={(e) => setForm({...form, condition_score_max: e.target.value})} style={inputStyle} placeholder="e.g., 850" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Min Amount (₹)</label>
                  <input type="number" value={form.condition_amount_min} onChange={(e) => setForm({...form, condition_amount_min: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Max Amount (₹)</label>
                  <input type="number" value={form.condition_amount_max} onChange={(e) => setForm({...form, condition_amount_max: e.target.value})} style={inputStyle} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16, marginTop: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>Rate Effect (choose one)</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Rate Override (%)</label>
                    <input type="number" step="0.1" value={form.rate_override} onChange={(e) => setForm({...form, rate_override: e.target.value})} style={inputStyle} placeholder="Fixed rate e.g., 10.5" />
                  </div>
                  <div>
                    <label style={labelStyle}>Rate Adjustment (%)</label>
                    <input type="number" step="0.1" value={form.rate_adjustment} onChange={(e) => setForm({...form, rate_adjustment: e.target.value})} style={inputStyle} placeholder="e.g., -1.5 or +2.0" />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} style={{...inputStyle, minHeight: 60}} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button onClick={createRule} disabled={!form.name} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: primary, color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: form.name ? 1 : 0.5 }}>Create Rule</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
