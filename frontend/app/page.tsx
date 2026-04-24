'use client';

if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && (args[0].includes('THREE.Clock') || args[0].includes('THREE.WebGLProgram'))) return;
    originalWarn(...args);
  };
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readinessAPI } from '@/lib/api';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import dynamic from 'next/dynamic';
const Background3D = dynamic(() => import('@/components/3d/Background3D'), { ssr: false });
import type { ReadinessResult } from '@/types/loan';
import { Shield, Zap, TrendingUp } from 'lucide-react';

type Step = 1 | 2 | 3
type Employment = 'SALARIED' | 'BUSINESS' | 'SELF_EMPLOYED' | 'OTHER'
type Tenure = 12 | 24 | 36 | 48 | 60

export default function LandingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  // Client-side only — avoids SSR/CSR hydration mismatch
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const check = () => setIsWide(window.innerWidth > 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Form state
  const [income, setIncome] = useState('');
  const [employment, setEmployment] = useState<Employment | ''>('');
  const [existingEmi, setExistingEmi] = useState('0');
  const [loanAmount, setLoanAmount] = useState('');
  const [tenure, setTenure] = useState<Tenure>(36);

  const handleCheckScore = async () => {
    setLoading(true);
    try {
      const res = await readinessAPI.check({
        monthly_income: parseFloat(income) || 0,
        employment_type: employment || 'OTHER',
        existing_emi: parseFloat(existingEmi) || 0,
        loan_amount: parseFloat(loanAmount) || 0,
        tenure_months: tenure,
      });
      setResult(res.data);
      setStep(3);
    } catch {
      // Fallback for demo
      setResult({
        readiness_score: 72,
        estimated_amount_min: (parseFloat(loanAmount) || 100000) * 0.8,
        estimated_amount_max: parseFloat(loanAmount) || 100000,
        estimated_rate_min: 12.0,
        estimated_rate_max: 14.0,
        likely_approved: true,
        score_breakdown: { income: 22, employment: 20, dti: 22, loan_to_income: 8 },
        improvement_tips: [],
      });
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--accent-400)';
    if (score >= 40) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  const fmt = (n: number) => n.toLocaleString('en-IN');

  const employmentOptions: { value: Employment; label: string }[] = [
    { value: 'SALARIED', label: 'Salaried' },
    { value: 'BUSINESS', label: 'Business' },
    { value: 'SELF_EMPLOYED', label: 'Self-Employed' },
    { value: 'OTHER', label: 'Other' },
  ];

  const tenureOptions: Tenure[] = [12, 24, 36, 48, 60];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <Background3D />
      <div style={{
        position: 'relative', zIndex: 1, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div suppressHydrationWarning style={{
          display: 'grid',
          gridTemplateColumns: isWide ? '40% 60%' : '1fr',
          gap: '48px', maxWidth: '1100px', width: '100%', alignItems: 'center',
        }}>
          {/* Left Panel */}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', color: 'var(--text-primary)' }}>
              NexLoan
            </div>
            <div style={{
              fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-tertiary)', marginTop: '4px',
            }}>
              POWERED BY THEOREMLABS
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)', margin: '20px 0' }} />

            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', marginTop: '48px',
            }}>
              Know before<br />you apply.
            </h1>
            <p style={{
              fontSize: '18px', color: 'var(--text-secondary)', marginTop: '16px',
              lineHeight: 1.6, maxWidth: '400px',
            }}>
              Get your Loan Readiness Score in 60 seconds. No KYC. No credit check. No commitment.
            </p>

            <div style={{ display: 'flex', gap: '20px', marginTop: '32px', flexWrap: 'wrap' }}>
              {[
                { icon: <Shield size={14} />, text: 'No KYC required' },
                { icon: <Zap size={14} />, text: 'Instant result' },
                { icon: <TrendingUp size={14} />, text: '0 impact on credit score' },
              ].map((badge, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '13px', color: 'var(--text-tertiary)',
                }}>
                  <span style={{ color: 'var(--accent-400)' }}>{badge.icon}</span>
                  {badge.text}
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel — Readiness Checker */}
          <Card padding="lg" variant="elevated" style={{ backdropFilter: 'blur(12px)' }}>
            {step === 1 && (
              <div style={{ animation: 'fadeInUp 400ms ease forwards' }}>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '20px',
                  fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px',
                }}>
                  Step 1 of 2
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                    Monthly Income (₹)
                  </label>
                  <input
                    type="number"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    placeholder="e.g. 50000"
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '16px', fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
                    Employment Type
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {employmentOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setEmployment(opt.value)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid',
                          borderColor: employment === opt.value ? 'var(--accent-500)' : 'var(--surface-border)',
                          background: employment === opt.value ? 'var(--accent-500)' : 'transparent',
                          color: employment === opt.value ? '#fff' : 'var(--text-secondary)',
                          fontSize: '13px', fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary" size="lg"
                  disabled={!income || !employment}
                  onClick={() => setStep(2)}
                  className="w-full"
                >
                  Next →
                </Button>
              </div>
            )}

            {step === 2 && (
              <div style={{ animation: 'fadeInUp 400ms ease forwards' }}>
                <h2 style={{
                  fontFamily: 'var(--font-display)', fontSize: '20px',
                  fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px',
                }}>
                  Step 2 of 2
                </h2>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                    Existing Monthly EMIs (₹)
                  </label>
                  <input
                    type="number"
                    value={existingEmi}
                    onChange={e => setExistingEmi(e.target.value)}
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', fontSize: '16px', fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                  {parseFloat(income) > 0 && (
                    <div style={{
                      marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)',
                    }}>
                      Debt burden: {((parseFloat(existingEmi) || 0) / parseFloat(income) * 100).toFixed(0)}%
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                    Loan Amount Needed (₹)
                  </label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={e => setLoanAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    style={{
                      width: '100%', padding: '14px 16px',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', fontSize: '16px', fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', display: 'block' }}>
                    Tenure
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tenureOptions.map(t => (
                      <button
                        key={t}
                        onClick={() => setTenure(t)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid',
                          borderColor: tenure === t ? 'var(--accent-500)' : 'var(--surface-border)',
                          background: tenure === t ? 'var(--accent-500)' : 'transparent',
                          color: tenure === t ? '#fff' : 'var(--text-secondary)',
                          fontSize: '13px', fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        {t}M
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button
                    variant="primary" size="lg" loading={loading}
                    disabled={!loanAmount}
                    onClick={handleCheckScore}
                    style={{ flex: 1 }}
                  >
                    Check My Score →
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && result && (
              <div style={{ animation: 'fadeInUp 400ms ease forwards', textAlign: 'center' }}>
                {/* Score Circle */}
                <div style={{ position: 'relative', width: '180px', height: '180px', margin: '0 auto 24px' }}>
                  <svg width="180" height="180" viewBox="0 0 180 180">
                    <circle
                      cx="90" cy="90" r="78"
                      fill="none" stroke="var(--surface-overlay)" strokeWidth="8"
                    />
                    <circle
                      cx="90" cy="90" r="78"
                      fill="none"
                      stroke={getScoreColor(result.readiness_score)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 78}`}
                      strokeDashoffset={`${2 * Math.PI * 78 * (1 - result.readiness_score / 100)}`}
                      transform="rotate(-90 90 90)"
                      style={{
                        transition: 'stroke-dashoffset 1.2s ease-out',
                      }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)', textAlign: 'center',
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '48px',
                      fontWeight: 800, color: getScoreColor(result.readiness_score),
                    }}>
                      {result.readiness_score}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: 'var(--text-tertiary)', marginBottom: '16px',
                }}>
                  READINESS SCORE
                </div>

                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '14px',
                  color: 'var(--text-secondary)', marginBottom: '20px',
                }}>
                  Estimated offer: ₹{fmt(result.estimated_amount_min)} – ₹{fmt(result.estimated_amount_max)} at {result.estimated_rate_min}–{result.estimated_rate_max}% p.a.
                </div>

                {/* Approval banner */}
                {result.likely_approved ? (
                  <div style={{
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px',
                    color: 'var(--color-success)', fontSize: '14px', fontWeight: 500,
                  }}>
                    ✓ You&apos;re likely to be approved
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px',
                    textAlign: 'left',
                  }}>
                    <div style={{ color: 'var(--color-warning)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                      Tips to improve
                    </div>
                    {result.improvement_tips.map((tip, i) => (
                      <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                        • {tip}
                      </p>
                    ))}
                  </div>
                )}

                <Button variant="primary" size="lg" onClick={() => router.push('/dashboard')} style={{ width: '100%' }}>
                  Apply Now →
                </Button>
                <button
                  onClick={() => { setStep(1); setResult(null); }}
                  style={{
                    marginTop: '12px', background: 'none', border: 'none',
                    color: 'var(--text-tertiary)', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  Check again
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
