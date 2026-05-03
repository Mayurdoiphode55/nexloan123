'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', traffic_split: 0.5,
    policy_a_min_score: 600, policy_a_max_dti: 0.50,
    policy_b_min_score: 550, policy_b_max_dti: 0.45,
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchExperiments() {
    try {
      const res = await fetch(`${API}/api/experiments/list`, { headers });
      if (res.ok) setExperiments(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchExperiments(); }, []);

  async function createExperiment() {
    await fetch(`${API}/api/experiments/create`, {
      method: 'POST', headers, body: JSON.stringify(form),
    });
    setShowCreate(false);
    fetchExperiments();
  }

  async function concludeExperiment(id: string) {
    await fetch(`${API}/api/experiments/${id}/conclude`, { method: 'POST', headers });
    fetchExperiments();
  }

  async function pauseExperiment(id: string) {
    await fetch(`${API}/api/experiments/${id}/pause`, { method: 'POST', headers });
    fetchExperiments();
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: '#D1FAE5', color: '#065F46' },
    PAUSED: { bg: '#FEF3C7', color: '#92400E' },
    CONCLUDED: { bg: '#E5E7EB', color: '#374151' },
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>A/B Credit Policy Testing</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Test alternative underwriting policies in production</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>+ New Experiment</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
      ) : experiments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 36 }}>🧪</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>No experiments yet</p>
          <p style={{ color: '#6B7280' }}>Create your first A/B credit policy test</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {experiments.map(exp => {
            const sc = statusColors[exp.status] || statusColors.ACTIVE;
            return (
              <div key={exp.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{exp.name}</h3>
                      <span style={{ background: sc.bg, color: sc.color, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{exp.status}</span>
                    </div>
                    {exp.description && <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>{exp.description}</p>}
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      Traffic split: {(exp.traffic_split * 100).toFixed(0)}% / {((1 - exp.traffic_split) * 100).toFixed(0)}%
                      {exp.start_date && ` · Started ${new Date(exp.start_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {exp.status === 'ACTIVE' && (
                      <>
                        <button onClick={() => pauseExperiment(exp.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Pause</button>
                        <button onClick={() => concludeExperiment(exp.id)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#4F46E5', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Conclude</button>
                      </>
                    )}
                  </div>
                </div>

                {/* A/B Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Policy A */}
                  <div style={{ background: '#F0F9FF', borderRadius: 10, padding: 16, border: '1px solid #BAE6FD' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: '#0369A1', fontSize: 14 }}>Policy A — Control</span>
                      {exp.winner === 'A' && <span style={{ background: '#16A34A', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🏆 Winner</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                      <div><span style={{ color: '#6B7280' }}>Min Score:</span> <span style={{ fontWeight: 600 }}>{exp.policy_a.min_score}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Max DTI:</span> <span style={{ fontWeight: 600 }}>{exp.policy_a.max_dti}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Loans:</span> <span style={{ fontWeight: 600 }}>{exp.policy_a.assignments}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Approval:</span> <span style={{ fontWeight: 600 }}>{exp.policy_a.approval_rate != null ? `${(exp.policy_a.approval_rate * 100).toFixed(1)}%` : '—'}</span></div>
                    </div>
                  </div>
                  {/* Policy B */}
                  <div style={{ background: '#FDF4FF', borderRadius: 10, padding: 16, border: '1px solid #E9D5FF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: '#7C3AED', fontSize: 14 }}>Policy B — Challenger</span>
                      {exp.winner === 'B' && <span style={{ background: '#16A34A', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🏆 Winner</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                      <div><span style={{ color: '#6B7280' }}>Min Score:</span> <span style={{ fontWeight: 600 }}>{exp.policy_b.min_score || '—'}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Max DTI:</span> <span style={{ fontWeight: 600 }}>{exp.policy_b.max_dti || '—'}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Loans:</span> <span style={{ fontWeight: 600 }}>{exp.policy_b.assignments}</span></div>
                      <div><span style={{ color: '#6B7280' }}>Approval:</span> <span style={{ fontWeight: 600 }}>{exp.policy_b.approval_rate != null ? `${(exp.policy_b.approval_rate * 100).toFixed(1)}%` : '—'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCreate(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 32, width: 540, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Create A/B Experiment</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={labelStyle}>Experiment Name *</label><input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} style={inputStyle} placeholder="e.g., Q3 Relaxed DTI Test" /></div>
              <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} style={{...inputStyle, minHeight: 60}} /></div>
              <div><label style={labelStyle}>Traffic Split to Policy B (%)</label><input type="number" value={form.traffic_split * 100} onChange={(e) => setForm({...form, traffic_split: parseFloat(e.target.value) / 100})} style={inputStyle} min={10} max={90} /></div>

              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: '#F0F9FF', borderRadius: 8, padding: 14 }}>
                    <p style={{ fontWeight: 700, color: '#0369A1', margin: '0 0 10px', fontSize: 13 }}>Policy A (Control)</p>
                    <label style={labelStyle}>Min Score</label>
                    <input type="number" value={form.policy_a_min_score} onChange={(e) => setForm({...form, policy_a_min_score: parseInt(e.target.value)})} style={inputStyle} />
                    <label style={{...labelStyle, marginTop: 8}}>Max DTI</label>
                    <input type="number" step="0.01" value={form.policy_a_max_dti} onChange={(e) => setForm({...form, policy_a_max_dti: parseFloat(e.target.value)})} style={inputStyle} />
                  </div>
                  <div style={{ background: '#FDF4FF', borderRadius: 8, padding: 14 }}>
                    <p style={{ fontWeight: 700, color: '#7C3AED', margin: '0 0 10px', fontSize: 13 }}>Policy B (Challenger)</p>
                    <label style={labelStyle}>Min Score</label>
                    <input type="number" value={form.policy_b_min_score} onChange={(e) => setForm({...form, policy_b_min_score: parseInt(e.target.value)})} style={inputStyle} />
                    <label style={{...labelStyle, marginTop: 8}}>Max DTI</label>
                    <input type="number" step="0.01" value={form.policy_b_max_dti} onChange={(e) => setForm({...form, policy_b_max_dti: parseFloat(e.target.value)})} style={inputStyle} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createExperiment} disabled={!form.name} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: form.name ? 1 : 0.5 }}>Launch Experiment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
