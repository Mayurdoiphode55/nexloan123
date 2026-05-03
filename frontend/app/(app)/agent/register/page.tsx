'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AgentRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', mobile: '', agency_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/agent/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch (e) {
      setError('Network error');
    }
    setSubmitting(false);
  }

  if (result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 440, textAlign: 'center', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Registration Successful!</h2>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 20px' }}>Your agent code has been generated. An admin will verify your account.</p>
          <div style={{ background: '#EEF2FF', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Your Agent Code</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#4F46E5', fontFamily: 'monospace' }}>{result.agent_code}</div>
          </div>
          <button onClick={() => router.push('/')} style={{ background: '#4F46E5', color: '#fff', padding: '12px 28px', borderRadius: 10, border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 480, border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🤝</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Become a NexLoan Agent</h1>
          <p style={{ color: '#6B7280', fontSize: 14, marginTop: 6 }}>Earn commissions by referring loan applicants</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input required value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} style={inputStyle} placeholder="Your full name" />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} style={inputStyle} placeholder="agent@company.com" />
          </div>
          <div>
            <label style={labelStyle}>Mobile *</label>
            <input required value={form.mobile} onChange={(e) => setForm({...form, mobile: e.target.value})} style={inputStyle} placeholder="+91-XXXXXXXXXX" />
          </div>
          <div>
            <label style={labelStyle}>Agency Name (optional)</label>
            <input value={form.agency_name} onChange={(e) => setForm({...form, agency_name: e.target.value})} style={inputStyle} placeholder="Your company name" />
          </div>

          {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting} style={{ padding: '12px 0', borderRadius: 10, border: 'none', background: '#4F46E5', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 15, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Registering...' : 'Register as Agent'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
