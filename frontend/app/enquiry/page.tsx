'use client';

import { useState, useEffect } from 'react';
import { enquiryAPI } from '@/lib/api';

const LOAN_TYPES = ['Personal Loan', 'Business Loan', 'Home Loan', 'Gold Loan', 'Vehicle Loan', 'Education Loan', 'Collateral Loan'];
const AMOUNT_RANGES = ['₹50K – ₹2L', '₹2L – ₹5L', '₹5L – ₹10L', '₹10L – ₹25L', '₹25L+'];

export default function EnquiryPage() {
  const [config, setConfig] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', email: '', mobile: '',
    loan_type_interest: '', loan_amount_range: '', message: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${API}/api/config`).then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  const primary = config?.primary_color || '#4F46E5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.mobile.match(/^\d{10}$/)) {
      setError('Please fill in all required fields correctly.'); return;
    }
    setBusy(true); setError('');
    try {
      await enquiryAPI.submit(form);
      setDone(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally { setBusy(false); }
  };

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F9FAFB', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center',
        border: '1px solid #E5E7EB', maxWidth: 440 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Enquiry Received!</h2>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6 }}>
          Thank you for your interest. Our team will contact you within 24 hours.
        </p>
        <button onClick={() => { setDone(false); setForm({ name:'', email:'', mobile:'',
          loan_type_interest:'', loan_amount_range:'', message:'' }); }}
          style={{ marginTop: 28, padding: '10px 24px', background: primary, color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Submit Another
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #F9FAFB; }
        .enq-pill { padding: 8px 16px; border: 1px solid #E5E7EB; border-radius: 20px;
          background: #fff; font-size: 13px; color: #374151; cursor: pointer; transition: all 0.15s; }
        .enq-pill:hover { border-color: var(--p, #4F46E5); color: var(--p, #4F46E5); }
        .enq-pill--active { background: var(--p, #4F46E5); color: #fff; border-color: var(--p, #4F46E5); }
        .enq-input { width: 100%; padding: 11px 14px; border: 1px solid #E5E7EB; border-radius: 6px;
          font-size: 14px; color: #111827; outline: none; }
        .enq-input:focus { border-color: var(--p, #4F46E5); }
        .enq-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
      `}</style>

      <div style={{ '--p': primary } as React.CSSProperties}>
        {/* Header */}
        <div style={{ background: primary, padding: '40px 24px', textAlign: 'center', color: '#fff' }}>
          {config?.logo_url
            ? <img src={config.logo_url} alt={config.client_name} style={{ height: 40, objectFit: 'contain', marginBottom: 16 }} />
            : <p style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{config?.client_name || 'NexLoan'}</p>
          }
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Interested in a Loan?</h1>
          <p style={{ fontSize: 16, opacity: 0.8 }}>Fill in your details and we'll reach out within 24 hours.</p>
        </div>

        {/* Form Card */}
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
          <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 12, padding: '32px 28px' }}>

            {error && (
              <div style={{ marginBottom: 20, padding: '10px 14px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}

            {/* Name / Email / Mobile */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label className="enq-label">Full Name *</label>
                <input className="enq-input" value={form.name} placeholder="Mayur Doiphode"
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="enq-label">Mobile *</label>
                <input className="enq-input" value={form.mobile} placeholder="10-digit number"
                  onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g,'').slice(0,10) }))} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="enq-label">Email *</label>
              <input className="enq-input" type="email" value={form.email} placeholder="you@example.com"
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>

            {/* Loan Type Pills */}
            <div style={{ marginBottom: 20 }}>
              <label className="enq-label">Loan Type (optional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {LOAN_TYPES.map(t => (
                  <button key={t} type="button"
                    className={`enq-pill ${form.loan_type_interest === t ? 'enq-pill--active' : ''}`}
                    onClick={() => setForm(p => ({ ...p, loan_type_interest: p.loan_type_interest === t ? '' : t }))}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Range */}
            <div style={{ marginBottom: 20 }}>
              <label className="enq-label">Loan Amount Range (optional)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {AMOUNT_RANGES.map(r => (
                  <button key={r} type="button"
                    className={`enq-pill ${form.loan_amount_range === r ? 'enq-pill--active' : ''}`}
                    onClick={() => setForm(p => ({ ...p, loan_amount_range: p.loan_amount_range === r ? '' : r }))}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div style={{ marginBottom: 24 }}>
              <label className="enq-label">Message (optional)</label>
              <textarea className="enq-input" rows={3} value={form.message}
                placeholder="Tell us more about your requirement…"
                onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>

            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '13px', background: primary, color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}>
              {busy ? 'Submitting…' : 'Submit Enquiry →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 16 }}>
              No login required. We&apos;ll contact you directly.
            </p>
          </form>

          {config && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 20 }}>
              {config.registered_name} · {config.support_email}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
