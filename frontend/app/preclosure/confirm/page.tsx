'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface QuoteData {
  loan_number: string;
  outstanding_principal: number;
  preclosure_charge: number;
  total_payable: number;
  charge_rate: number;
  valid_until: string;
  token: string;
}

function fmtINR(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function PreClosureContent() {
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'expired' | 'error' | 'confirmed'>('loading');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const base = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    fetch(`${base}/api/config`).then(r => r.json()).then(setConfig).catch(() => {});

    if (!token) { setStatus('error'); setErrorMsg('No token provided.'); return; }

    fetch(`${base}/api/closure/preclosure/${encodeURIComponent(token)}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setStatus(data.detail?.includes('expired') ? 'expired' : 'error');
          setErrorMsg(data.detail || 'Invalid link.');
        } else {
          setQuote(data);
          setStatus('valid');
        }
      })
      .catch(() => { setStatus('error'); setErrorMsg('Could not load quote.'); });
  }, [token]);

  const handleConfirm = async () => {
    if (!agreed) return;
    setBusy(true);
    try {
      const res = await fetch(`${base}/api/closure/preclosure/${encodeURIComponent(token)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Confirmation failed');

      // Simulate payment by immediately completing it
      const completeRes = await fetch(`${base}/api/closure/preclosure/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!completeRes.ok) throw new Error('Payment simulation failed');

      setStatus('confirmed');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const primary = config?.primary_color || '#4F46E5';
  const clientName = config?.client_name || 'NexLoan';

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #F9FAFB; }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, background: '#F9FAFB' }}>

        {/* Header strip */}
        <div style={{ width: '100%', maxWidth: 520, marginBottom: 24, textAlign: 'center' }}>
          {config?.logo_url
            ? <img src={config.logo_url} alt={clientName} style={{ height: 36, objectFit: 'contain' }} />
            : <p style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{clientName}</p>
          }
        </div>

        <div style={{ width: '100%', maxWidth: 520, background: '#fff', border: '1px solid #E5E7EB',
          borderRadius: 12, overflow: 'hidden' }}>

          {/* ── Loading ──────────── */}
          {status === 'loading' && (
            <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
              Verifying your pre-closure request…
            </div>
          )}

          {/* ── Expired ──────────── */}
          {status === 'expired' && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Link Expired</h2>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>
                This pre-closure link has expired. Please request a new one from your loan dashboard.
              </p>
            </div>
          )}

          {/* ── Error ────────────── */}
          {status === 'error' && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Invalid Link</h2>
              <p style={{ fontSize: 14, color: '#DC2626' }}>{errorMsg}</p>
            </div>
          )}

          {/* ── Confirmed ────────── */}
          {status === 'confirmed' && (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Pre-Closure Confirmed</h2>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 24 }}>
                Your loan has been marked for pre-closure. A confirmation email has been sent to you.
                You will receive a final receipt once the payment is processed.
              </p>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                style={{
                  padding: '10px 24px', background: primary, color: '#fff', 
                  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>
                Return to Dashboard
              </button>
            </div>
          )}

          {/* ── Valid Quote ──────── */}
          {status === 'valid' && quote && (
            <>
              <div style={{ padding: '20px 28px', background: primary, color: '#fff' }}>
                <p style={{ fontSize: 12, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Pre-Closure Quote
                </p>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>Loan {quote.loan_number}</h1>
                <p style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
                  Valid until {new Date(quote.valid_until).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>

              <div style={{ padding: '24px 28px' }}>
                {/* Breakdown */}
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
                  {[
                    { label: 'Outstanding Principal', value: fmtINR(quote.outstanding_principal) },
                    { label: `Pre-Closure Charge (${quote.charge_rate}%)`, value: fmtINR(quote.preclosure_charge) },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid #E5E7EB' }}>
                      <span style={{ fontSize: 14, color: '#6B7280' }}>{row.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Total Payable</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: primary }}>{fmtINR(quote.total_payable)}</span>
                  </div>
                </div>

                {/* T&C checkbox */}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: primary, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    I confirm that I wish to pre-close Loan {quote.loan_number} by paying {fmtINR(quote.total_payable)}.
                    I understand that this action is irreversible and agree to the pre-closure terms
                    of {clientName}.
                  </span>
                </label>

                {errorMsg && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2',
                    border: '1px solid #FECACA', borderRadius: 6, fontSize: 13, color: '#DC2626' }}>
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={!agreed || busy}
                  style={{
                    width: '100%', padding: 13,
                    background: agreed ? primary : '#D1D5DB',
                    color: '#fff', border: 'none', borderRadius: 6,
                    fontSize: 15, fontWeight: 600,
                    cursor: agreed && !busy ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                  }}>
                  {busy ? 'Confirming…' : `Confirm Pre-Closure — ${fmtINR(quote.total_payable)}`}
                </button>

                <p style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 14 }}>
                  Contact {config?.support_email || 'support'} if you have questions.
                </p>
              </div>
            </>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: 11, color: '#9CA3AF' }}>Powered by NexLoan</p>
      </div>
    </>
  );
}

export default function PreClosureConfirmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}>Loading…</div>}>
      <PreClosureContent />
    </Suspense>
  );
}
