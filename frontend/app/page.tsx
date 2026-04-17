'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { register, verifyOTP, sendOTP } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import OTPInput from '@/components/OTPInput';
import { ThemeToggle } from '@/components/ThemeToggle';
import Background3D from '@/components/3d/Background3D';

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Entry, 2: OTP
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    mobile: '',
  });
  const [loginIdentifier, setLoginIdentifier] = useState('');

  // OTP state
  const [otp, setOtp] = useState('');
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [otpTimer, setOtpTimer] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);

  // OTP countdown timer
  useEffect(() => {
    if (step !== 2 || otpTimer <= 0) {
      if (otpTimer <= 0) setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, otpTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.full_name.trim()) throw new Error('Full name is required');
      if (!formData.email.trim()) throw new Error('Email is required');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) throw new Error('Invalid email format');
      if (!formData.mobile.match(/^\d{10}$/)) throw new Error('Mobile number must be 10 digits');

      const response = await register(formData);
      setSuccess(response.message);
      setOtpIdentifier(formData.email);
      setOtpTimer(300);
      setCanResend(false);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!loginIdentifier.trim()) throw new Error('Email or mobile is required');
      await sendOTP({ identifier: loginIdentifier });
      setSuccess('OTP sent successfully!');
      setOtpIdentifier(loginIdentifier);
      setOtpTimer(300);
      setCanResend(false);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!otp.match(/^\d{6}$/)) throw new Error('OTP must be 6 digits');
      await verifyOTP({ identifier: otpIdentifier, otp });
      setSuccess('OTP verified! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    setLoading(true);
    setError('');
    try {
      await sendOTP({ identifier: otpIdentifier });
      setSuccess('OTP resent successfully!');
      setOtpTimer(300);
      setCanResend(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Background3D />
      <ThemeToggle />
      <div className="auth-card animate-card-entrance">

        {step === 1 ? (
          <>
            {/* ── Logo ────────────── */}
            <div className="auth-card__logo">
              <h1>NexLoan</h1>
              <p>Powered by Theoremlabs</p>
            </div>
            <div className="auth-card__divider" />

            {!isLoginMode ? (
              /* ── Register Form ────── */
              <form onSubmit={handleRegister}>
                <div className="auth-card__heading">
                  <h2>Create your account</h2>
                  <p>Join thousands of members. No paperwork.</p>
                </div>

                <div className="auth-card__fields">
                  <div className="animate-stagger" style={{ '--stagger-index': 0 } as React.CSSProperties}>
                    <Input
                      label="Full Name"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="animate-stagger" style={{ '--stagger-index': 1 } as React.CSSProperties}>
                    <Input
                      label="Email Address"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      required
                    />
                  </div>
                  <div className="animate-stagger" style={{ '--stagger-index': 2 } as React.CSSProperties}>
                    <Input
                      label="Mobile Number"
                      type="tel"
                      addon="+91"
                      value={formData.mobile}
                      onChange={(e) => handleInputChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>
                </div>

                {error && <div className="auth-card__alert auth-card__alert--error">{error}</div>}
                {success && <div className="auth-card__alert auth-card__alert--success">{success}</div>}

                <div className="auth-card__cta">
                  <Button type="submit" size="lg" fullWidth loading={loading}>
                    Continue →
                  </Button>
                </div>

                <div className="auth-card__or">
                  <span>or</span>
                </div>

                <p className="auth-card__switch">
                  Already a member?{' '}
                  <button type="button" onClick={() => { setIsLoginMode(true); setError(''); setSuccess(''); }}>
                    Sign in
                  </button>
                </p>
              </form>
            ) : (
              /* ── Login Form ──────── */
              <form onSubmit={handleLogin}>
                <div className="auth-card__heading">
                  <h2>Welcome back</h2>
                  <p>Sign in to your NexLoan account.</p>
                </div>

                <div className="auth-card__fields">
                  <div className="animate-stagger" style={{ '--stagger-index': 0 } as React.CSSProperties}>
                    <Input
                      label="Email or Mobile Number"
                      value={loginIdentifier}
                      onChange={(e) => { setLoginIdentifier(e.target.value); setError(''); }}
                      required
                    />
                  </div>
                </div>

                {error && <div className="auth-card__alert auth-card__alert--error">{error}</div>}
                {success && <div className="auth-card__alert auth-card__alert--success">{success}</div>}

                <div className="auth-card__cta">
                  <Button type="submit" size="lg" fullWidth loading={loading}>
                    Send OTP →
                  </Button>
                </div>

                <div className="auth-card__or">
                  <span>or</span>
                </div>

                <p className="auth-card__switch">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setIsLoginMode(false); setError(''); setSuccess(''); }}>
                    Create one
                  </button>
                </p>
              </form>
            )}

            <div className="auth-card__footer">
              <p>© 2026 NexLoan · Secured by AES-256 Encryption</p>
            </div>
          </>
        ) : (
          /* ── OTP Step ──────────── */
          <form onSubmit={handleVerifyOTP}>
            <button type="button" className="auth-card__back" onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}>
              ← Back
            </button>

            <div className="auth-card__lock-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>

            <div className="auth-card__heading" style={{ textAlign: 'center' }}>
              <h2>Verify your identity</h2>
              <p>
                We sent a 6-digit code to <strong>{otpIdentifier}</strong>
              </p>
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <OTPInput value={otp} onChange={setOtp} disabled={loading} />
            </div>

            <div className={`auth-card__timer ${otpTimer < 60 ? 'auth-card__timer--warning' : ''} ${otpTimer === 0 ? 'auth-card__timer--expired' : ''}`}>
              {otpTimer > 0 ? (
                <span>Code expires in <strong>{formatTime(otpTimer)}</strong></span>
              ) : (
                <span>Code expired.</span>
              )}
            </div>

            {error && <div className="auth-card__alert auth-card__alert--error">{error}</div>}
            {success && <div className="auth-card__alert auth-card__alert--success">{success}</div>}

            <div className="auth-card__cta">
              <Button type="submit" size="lg" fullWidth loading={loading} disabled={otp.length !== 6}>
                Verify →
              </Button>
            </div>

            <p className="auth-card__resend">
              Didn&apos;t receive it?{' '}
              <button type="button" onClick={handleResendOTP} disabled={!canResend || loading} className={canResend ? 'active' : ''}>
                Resend OTP
              </button>
            </p>
          </form>
        )}
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          padding: var(--space-6);
        }

        .auth-card {
          width: 420px;
          max-width: 100%;
          position: relative;
          z-index: 10;
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-2xl);
          padding: var(--space-10);
        }

        /* ── Logo ─────────────────── */
        .auth-card__logo {
          text-align: center;
          margin-bottom: var(--space-8);
        }
        .auth-card__logo h1 {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--text-primary);
        }
        .auth-card__logo p {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: var(--space-1);
        }

        .auth-card__divider {
          height: 1px;
          background: var(--surface-border);
          margin-bottom: var(--space-8);
        }

        /* ── Heading ──────────────── */
        .auth-card__heading {
          margin-bottom: var(--space-6);
        }
        .auth-card__heading h2 {
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--text-primary);
        }
        .auth-card__heading p {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-1);
        }
        .auth-card__heading strong {
          color: var(--text-primary);
        }

        /* ── Fields ───────────────── */
        .auth-card__fields {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        /* ── Alerts ───────────────── */
        .auth-card__alert {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          margin-top: var(--space-4);
        }
        .auth-card__alert--error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          color: var(--color-error);
        }
        .auth-card__alert--success {
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          color: var(--color-success);
        }

        /* ── CTA ──────────────────── */
        .auth-card__cta {
          margin-top: var(--space-6);
        }

        /* ── Or divider ───────────── */
        .auth-card__or {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin: var(--space-6) 0;
        }
        .auth-card__or::before,
        .auth-card__or::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--surface-border);
        }
        .auth-card__or span {
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        }

        /* ── Switch ───────────────── */
        .auth-card__switch {
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }
        .auth-card__switch button {
          color: var(--text-accent);
          font-weight: 600;
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          font-size: inherit;
          text-decoration: none;
        }
        .auth-card__switch button:hover {
          text-decoration: underline;
        }

        /* ── Footer ───────────────── */
        .auth-card__footer {
          margin-top: var(--space-8);
          text-align: center;
        }
        .auth-card__footer p {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        }

        /* ── OTP: Back button ─────── */
        .auth-card__back {
          background: none;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          cursor: pointer;
          padding: 0;
          margin-bottom: var(--space-6);
          transition: color var(--transition-fast);
        }
        .auth-card__back:hover {
          color: var(--text-primary);
        }

        /* ── OTP: Lock icon ───────── */
        .auth-card__lock-icon {
          display: flex;
          justify-content: center;
          margin-bottom: var(--space-4);
          color: var(--accent-400);
        }

        /* ── OTP: Timer ───────────── */
        .auth-card__timer {
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-4);
        }
        .auth-card__timer strong {
          font-family: var(--font-mono);
          font-weight: 700;
        }
        .auth-card__timer--warning strong {
          color: var(--color-warning);
        }
        .auth-card__timer--expired {
          color: var(--color-error);
        }

        /* ── OTP: Resend ──────────── */
        .auth-card__resend {
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-4);
        }
        .auth-card__resend button {
          background: none;
          border: none;
          font-family: var(--font-body);
          font-size: inherit;
          cursor: pointer;
          color: var(--text-disabled);
          font-weight: 600;
        }
        .auth-card__resend button.active {
          color: var(--text-accent);
          cursor: pointer;
        }
        .auth-card__resend button.active:hover {
          text-decoration: underline;
        }
        .auth-card__resend button:disabled {
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .auth-card {
            padding: var(--space-6);
          }
        }
      `}</style>
    </div>
  );
}
