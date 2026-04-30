'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant';

interface PendingTask {
  type: string; icon: string; label: string;
  customer_name: string; loan_id?: string;
  loan_number?: string; time_elapsed: string;
  cta: string; cta_url: string;
}
interface KPIs {
  active_loans: number; total_disbursed: number;
  total_loans: number; npa_rate: number;
  pending_kyc: number; pending_callbacks: number;
}
interface Loan {
  id: string; loan_number: string; loan_amount: number;
  loan_type: string; status: string; tenure_months: number;
  interest_rate: number; disbursed_amount?: number;
  total_paid?: number; monthly_emi?: number;
  created_at: string; credit_score?: number; dti_ratio?: number;
}
interface EMI {
  installment_no: number; due_date: string; emi_amount: number;
  principal: number; interest: number; status: string;
  outstanding_balance: number;
}

const STATUS_STEPS = [
  'INQUIRY','APPLICATION','KYC_PENDING','KYC_VERIFIED',
  'UNDERWRITING','APPROVED','DISBURSED','ACTIVE',
];
const STATUS_LABELS: Record<string,string> = {
  INQUIRY:'Inquiry', APPLICATION:'Application', KYC_PENDING:'KYC',
  KYC_VERIFIED:'KYC Verified', UNDERWRITING:'Underwriting',
  APPROVED:'Approved', COUNTER_OFFERED:'Counter Offer',
  DISBURSED:'Disbursed', ACTIVE:'Active', REJECTED:'Rejected',
  PRE_CLOSED:'Pre-Closed', CLOSED:'Closed',
};
const TASK_ICONS: Record<string,string> = {
  document:'📄', phone:'📞', ticket:'🎫',
  alert:'⚠️', closure:'🔒', default:'📋',
};

function fmtINR(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function fmtPct(n: number) { return n.toFixed(1) + '%'; }

export default function DashboardPage() {
  const router = useRouter();
  const tenant = useTenant();
  const [role, setRole] = useState('BORROWER');
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [emis, setEmis] = useState<EMI[]>([]);
  const [busy, setBusy] = useState(true);

  const isOps = ['LOAN_OFFICER','VERIFIER','UNDERWRITER','ADMIN','SUPER_ADMIN'].includes(role);

  useEffect(() => {
    const u = localStorage.getItem('nexloan_user');
    if (u) { try { setRole(JSON.parse(u).role || 'BORROWER'); } catch {} }

    const token = localStorage.getItem('nexloan_token');
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };

    const base = process.env.NEXT_PUBLIC_API_URL || '';

    const fetchAll = async () => {
      try {
        const [taskRes, kpiRes] = await Promise.all([
          fetch(`${base}/api/dashboard/pending-tasks`, { headers: h }),
          fetch(`${base}/api/dashboard/kpis`, { headers: h }),
        ]);
        if (taskRes.ok) setTasks(await taskRes.json());
        if (kpiRes.ok) setKpis(await kpiRes.json());

        // Borrower: fetch own loans
        const loanRes = await fetch(`${base}/api/application/my-loans`, { headers: h });
        if (loanRes.ok) {
          const data = await loanRes.json();
          setLoans(Array.isArray(data) ? data : [data]);
          // fetch EMIs for active loan
          const active = Array.isArray(data) ? data.find((l: Loan) => l.status === 'ACTIVE') : null;
          if (active) {
            const emiRes = await fetch(`${base}/api/servicing/${active.id}/schedule`, { headers: h });
            if (emiRes.ok) setEmis(await emiRes.json());
          }
        }
      } catch {}
      setBusy(false);
    };
    fetchAll();
  }, []);

  const primary = tenant.primary_color || '#4F46E5';
  const activeLoan = loans.find(l => l.status === 'ACTIVE') || loans[0];

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* ── Page Header ────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>
          {isOps ? 'Operations overview — pending tasks and portfolio health.'
            : 'Your loan summary and upcoming payments.'}
        </p>
      </div>

      {/* ── Pending Tasks (hidden if zero) ─── */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: '#9CA3AF', marginBottom: 12 }}>Pending Tasks</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.slice(0, 8).map((t, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#fff', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: 20 }}>{TASK_ICONS[t.icon] || TASK_ICONS.default}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{t.label}</p>
                  <p style={{ fontSize: 13, color: '#6B7280' }}>
                    {t.customer_name}{t.loan_number ? ` · ${t.loan_number}` : ''} · {t.time_elapsed}
                  </p>
                </div>
                <button
                  onClick={() => router.push(t.cta_url)}
                  style={{
                    padding: '7px 16px', borderRadius: 6,
                    background: primary, color: '#fff',
                    border: 'none', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ops KPI Cards ──────────────────── */}
      {isOps && kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Active Loans', value: kpis.active_loans.toLocaleString(), color: '#059669' },
            { label: 'Total Disbursed', value: fmtINR(kpis.total_disbursed), color: primary },
            { label: 'Total Applications', value: kpis.total_loans.toLocaleString(), color: '#2563EB' },
            { label: 'NPA Rate', value: fmtPct(kpis.npa_rate), color: kpis.npa_rate > 5 ? '#DC2626' : '#059669' },
            { label: 'KYC Pending', value: kpis.pending_kyc.toLocaleString(), color: '#D97706' },
            { label: 'Callbacks', value: kpis.pending_callbacks.toLocaleString(), color: '#7C3AED' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#fff', border: '1px solid #E5E7EB',
              borderRadius: 8, padding: '16px 18px',
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 8 }}>{card.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Borrower: Loan Summary ─────────── */}
      {!isOps && activeLoan && (
        <>
          {/* 3-card row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px 18px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: '#9CA3AF', marginBottom: 8 }}>Loan Amount</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: primary }}>{fmtINR(activeLoan.loan_amount)}</p>
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{activeLoan.loan_type || 'Personal Loan'}</p>
            </div>
            {activeLoan.credit_score && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: '#9CA3AF', marginBottom: 8 }}>Credit Score</p>
                <p style={{ fontSize: 24, fontWeight: 700,
                  color: activeLoan.credit_score >= 750 ? '#059669' : activeLoan.credit_score >= 650 ? '#D97706' : '#DC2626' }}>
                  {activeLoan.credit_score}
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {activeLoan.credit_score >= 750 ? 'Excellent' : activeLoan.credit_score >= 650 ? 'Good' : 'Needs Improvement'}
                </p>
              </div>
            )}
            {activeLoan.monthly_emi && (
              <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '16px 18px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: '#9CA3AF', marginBottom: 8 }}>Monthly EMI</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{fmtINR(activeLoan.monthly_emi)}</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{activeLoan.tenure_months} months · {activeLoan.interest_rate}% p.a.</p>
              </div>
            )}
          </div>

          {/* Loan Status Timeline */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '20px 24px', marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              color: '#9CA3AF', marginBottom: 20 }}>Application Progress</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
              {STATUS_STEPS.map((step, i) => {
                const steps = STATUS_STEPS;
                const currentIdx = steps.indexOf(activeLoan.status);
                const isCompleted = i < currentIdx;
                const isCurrent = i === currentIdx;
                const isFuture = i > currentIdx;
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isCompleted ? '#059669' : isCurrent ? primary : '#F3F4F6',
                        border: `2px solid ${isCompleted ? '#059669' : isCurrent ? primary : '#E5E7EB'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, color: isCompleted || isCurrent ? '#fff' : '#9CA3AF',
                        transition: 'all 0.2s',
                      }}>
                        {isCompleted ? '✓' : i + 1}
                      </div>
                      <p style={{ fontSize: 10, marginTop: 6, color: isCurrent ? primary : isCompleted ? '#059669' : '#9CA3AF',
                        fontWeight: isCurrent ? 700 : 500, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {STATUS_LABELS[step]}
                      </p>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div style={{
                        height: 2, width: 24, flexShrink: 0, marginBottom: 20,
                        background: isCompleted ? '#059669' : '#E5E7EB',
                        transition: 'background 0.2s',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
            {activeLoan.status === 'REJECTED' && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#FEF2F2',
                borderRadius: 6, border: '1px solid #FECACA' }}>
                <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                  Loan Status: {STATUS_LABELS[activeLoan.status]}
                </p>
              </div>
            )}
            
            {['CLOSED','PRE_CLOSED'].includes(activeLoan.status) && (
              <div style={{ 
                marginTop: 20, padding: '24px', background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
                borderRadius: 12, border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 20
              }}>
                <div style={{ fontSize: 48 }}>🎉</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                    Congratulations on clearing your loan!
                  </h3>
                  <p style={{ fontSize: 14, color: '#15803D', lineHeight: 1.5 }}>
                    Your {STATUS_LABELS[activeLoan.status].toLowerCase()} is now fully settled. 
                    Thank you for choosing NexLoan. We'd love to partner with you again for your future financial needs!
                  </p>
                  <button 
                    onClick={() => window.location.href = '/apply'}
                    style={{ 
                      marginTop: 12, padding: '8px 16px', background: '#166534', color: '#fff', 
                      border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' 
                    }}>
                    Apply for a New Loan →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* EMI Schedule */}
          {emis.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '20px 24px', marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9CA3AF' }}>
                  EMI Schedule
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button onClick={async () => {
                    if (!confirm("Are you sure you want to request a pre-closure for this loan? We will generate a secure link.")) return;
                    try {
                      const token = localStorage.getItem('nexloan_token');
                      const base = '';
                      const res = await fetch(`${base}/api/closure/${activeLoan.id}/request-preclosure`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      const data = await res.json();
                      if (res.ok && data.token) {
                        alert("Pre-closure request generated! Redirecting you to the secure link (Dev Mode)...");
                        window.location.href = `/preclosure/confirm?token=${data.token}`;
                      } else {
                        alert(`Failed: ${data.detail || 'Could not generate token'}`);
                      }
                    } catch (e: any) {
                      alert(`Network error: ${e.message || String(e)}`);
                      console.error(e);
                    }
                  }}
                    style={{ fontSize: 13, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    Request Pre-closure 🔒
                  </button>
                  <button onClick={() => {
                    const token = localStorage.getItem('nexloan_token');
                    window.open(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/statements/${activeLoan.id}/emi-statement?token=${token}`, '_blank');
                  }}
                    style={{ fontSize: 13, color: primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    Download Statement →
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {['#', 'Due Date', 'EMI', 'Principal', 'Interest', 'Balance', 'Status', 'Action'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.05em', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emis.map(e => {
                      const statusColor = e.status === 'PAID' ? '#059669'
                        : e.status === 'OVERDUE' ? '#DC2626' : '#D97706';
                      const statusBg = e.status === 'PAID' ? '#F0FDF4'
                        : e.status === 'OVERDUE' ? '#FEF2F2' : '#FFFBEB';
                      return (
                        <tr key={e.installment_no} style={{ borderBottom: '1px solid #F9FAFB' }}>
                          <td style={{ padding: '10px 12px', color: '#9CA3AF', fontFamily: 'monospace' }}>{e.installment_no}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>
                            {new Date(e.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>{fmtINR(e.emi_amount)}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtINR(e.principal)}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtINR(e.interest)}</td>
                          <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtINR(e.outstanding_balance)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 4,
                              background: statusBg, color: statusColor,
                              fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                              {e.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {e.status === 'PENDING' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const token = localStorage.getItem('nexloan_token');
                                    const base = process.env.NEXT_PUBLIC_API_URL || '';
                                    // 1. Create order
                                    const res = await fetch(`${base}/api/payments/${activeLoan.id}/create-order/${e.installment_no}`, {
                                      method: 'POST',
                                      headers: { Authorization: `Bearer ${token}` }
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.detail);
                                    
                                    // 2. Verify / Complete payment (Simulated)
                                    const verifyRes = await fetch(`${base}/api/payments/verify`, {
                                      method: 'POST',
                                      headers: { 
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}` 
                                      },
                                      body: JSON.stringify({
                                        order_id: data.order_id,
                                        payment_id: "pay_simulated_" + Date.now(),
                                        signature: "simulated_sig"
                                      })
                                    });
                                    if (!verifyRes.ok) throw new Error("Verification failed");
                                    
                                    alert("Payment successful! Loan status has been updated.");
                                    window.location.reload();
                                  } catch(err: any) {
                                    alert(`Payment error: ${err.message}`);
                                  }
                                }}
                                style={{
                                  background: primary, color: '#fff', border: 'none',
                                  padding: '4px 12px', borderRadius: 4, fontSize: 11,
                                  fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                Pay
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ────────────────────── */}
      {!isOps && loans.length === 0 && !busy && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          padding: '60px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 16 }}>🏦</p>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 8 }}>No loans yet</p>
          <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Apply for your first loan in minutes.</p>
          <button onClick={() => router.push('/apply')} style={{
            padding: '10px 24px', background: primary, color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Apply Now →</button>
        </div>
      )}

      {busy && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 90, flex: '1 1 180px', borderRadius: 8,
              background: 'linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)',
              backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite' }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </div>
  );
}
