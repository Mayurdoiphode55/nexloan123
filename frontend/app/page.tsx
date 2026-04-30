'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import { storeToken, storeUser } from '@/lib/auth';

interface TenantConfig {
  client_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  tagline?: string;
  support_email?: string;
  registered_name?: string;
  rbi_registration?: string;
  terms_url?: string;
  privacy_url?: string;
  announcement_text?: string;
  announcement_active: boolean;
  announcement_color: string;
}

type AuthStep = 'entry' | 'otp';
type AuthMode = 'register' | 'login';

export default function WhiteLabelEntryPage() {
  const router = useRouter();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [authStep, setAuthStep] = useState<AuthStep>('entry');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [loginId, setLoginId] = useState('');
  const [otp, setOtp] = useState('');
  const [otpTarget, setOtpTarget] = useState('');
  const [otpTimer, setOtpTimer] = useState(300);

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('nexloan_token');
    if (token) { router.replace('/dashboard'); return; }
  }, [router]);

  // Load tenant config from API
  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${API}/api/config`)
      .then(r => r.json())
      .then((data: TenantConfig) => {
        setConfig(data);
        // Apply primary color as CSS var
        document.documentElement.style.setProperty('--client-primary', data.primary_color);
        document.documentElement.style.setProperty('--client-primary-hover',
          data.primary_color + 'DD');
      })
      .catch(() => {
        setConfig({
          client_name: 'NexLoan',
          primary_color: '#4F46E5',
          secondary_color: '#F5F5F5',
          tagline: 'AI-Powered Lending, Simplified.',
          announcement_active: false,
          announcement_color: '#F59E0B',
        });
        document.documentElement.style.setProperty('--client-primary', '#4F46E5');
      })
      .finally(() => setLoading(false));
  }, []);

  // OTP countdown
  useEffect(() => {
    if (authStep !== 'otp') return;
    const t = setInterval(() => setOtpTimer(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [authStep]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return setError('Full name is required');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Valid email required');
    if (!mobile.match(/^\d{10}$/)) return setError('Mobile must be 10 digits');
    setBusy(true); setError(''); setSuccess('');
    try {
      await authAPI.register({ full_name: fullName, email, mobile });
      setOtpTarget(email);
      setOtpTimer(300);
      setSuccess(`OTP sent to ${email}`);
      setAuthStep('otp');
    } catch (err: any) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: any) => x.msg || JSON.stringify(x)).join(', ') : 'Registration failed');
    } finally { setBusy(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim()) return setError('Email or mobile required');
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await authAPI.sendOTP({ identifier: loginId });
      setOtpTarget(res.data?.email || loginId);
      setOtpTimer(300);
      setSuccess(`OTP sent to ${res.data?.email || loginId}`);
      setAuthStep('otp');
    } catch (err: any) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'Login failed');
    } finally { setBusy(false); }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return setError('Enter the 6-digit OTP');
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await authAPI.verifyOTP({ identifier: otpTarget, otp });
      storeToken(res.data.access_token);
      storeUser(res.data.user);
      setSuccess('Verified! Redirecting…');
      setTimeout(() => router.push('/dashboard'), 900);
    } catch (err: any) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : 'OTP verification failed');
    } finally { setBusy(false); }
  };

  const primary = config?.primary_color || '#4F46E5';

  return (
    <>
      <style>{`
        :root { --client-primary: ${primary}; }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #fff; }

        .wl-root {
          display: flex;
          min-height: 100vh;
        }

        /* ── Left Panel ─────────────────────────── */
        .wl-left {
          width: 45%;
          background: var(--client-primary);
          display: flex;
          flex-direction: column;
          padding: 48px 40px;
          position: relative;
          overflow: hidden;
        }
        .wl-left::before {
          content: '';
          position: absolute;
          top: -120px; right: -120px;
          width: 400px; height: 400px;
          background: rgba(255,255,255,0.06);
          border-radius: 50%;
        }
        .wl-left::after {
          content: '';
          position: absolute;
          bottom: -80px; left: -80px;
          width: 300px; height: 300px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
        }
        .wl-left__content {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .wl-logo {
          width: auto;
          max-width: 180px;
          max-height: 60px;
          object-fit: contain;
          margin-bottom: 32px;
        }
        .wl-logo-text {
          font-size: 42px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: 16px;
        }
        .wl-tagline {
          font-size: 18px;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
          max-width: 340px;
        }
        .wl-divider {
          width: 48px;
          height: 3px;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          margin: 28px 0;
        }
        .wl-announcement {
          border-radius: 10px;
          padding: 16px;
          margin-top: 8px;
          position: relative;
        }
        .wl-announcement p {
          font-size: 14px;
          color: #fff;
          line-height: 1.5;
          padding-right: 24px;
        }
        .wl-announcement-close {
          position: absolute;
          top: 10px; right: 12px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }
        .wl-powered {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.05em;
          margin-top: 40px;
        }

        /* ── Right Panel ────────────────────────── */
        .wl-right {
          flex: 1;
          background: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }
        .wl-form-wrap {
          width: 100%;
          max-width: 380px;
        }

        /* Headings */
        .wl-form-title {
          font-size: 28px;
          font-weight: 700;
          color: #111111;
          margin-bottom: 6px;
        }
        .wl-form-sub {
          font-size: 14px;
          color: #6B7280;
          margin-bottom: 32px;
        }

        /* Inputs */
        .wl-field { margin-bottom: 16px; }
        .wl-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }
        .wl-input-wrap { position: relative; }
        .wl-input-addon {
          position: absolute;
          left: 14px; top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #6B7280;
          font-weight: 500;
          user-select: none;
        }
        .wl-input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
          font-size: 14px;
          color: #111827;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .wl-input:focus { border-color: var(--client-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
        .wl-input--addon { padding-left: 44px; }

        /* Button */
        .wl-btn {
          width: 100%;
          padding: 12px;
          background: var(--client-primary);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          margin-top: 8px;
        }
        .wl-btn:hover:not(:disabled) { opacity: 0.9; }
        .wl-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Alerts */
        .wl-alert {
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 14px;
        }
        .wl-alert--error { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .wl-alert--success { background: #F0FDF4; color: #16A34A; border: 1px solid #BBF7D0; }

        /* Toggle mode */
        .wl-toggle {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: #6B7280;
        }
        .wl-toggle button {
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 600;
          color: var(--client-primary);
          cursor: pointer;
          padding: 0;
        }

        /* OTP boxes */
        .wl-otp-wrap {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin: 20px 0;
        }
        .wl-otp-box {
          width: 44px; height: 52px;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          color: #111827;
          outline: none;
        }
        .wl-otp-box:focus { border-color: var(--client-primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }

        /* Timer */
        .wl-timer {
          text-align: center;
          font-size: 13px;
          color: #6B7280;
          margin-bottom: 8px;
        }
        .wl-timer strong { font-family: 'JetBrains Mono', monospace; color: #374151; }

        /* Footer */
        .wl-footer {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #F3F4F6;
          text-align: center;
        }
        .wl-footer p { font-size: 11px; color: #9CA3AF; line-height: 1.6; }
        .wl-footer a { color: #9CA3AF; text-decoration: none; }
        .wl-footer a:hover { text-decoration: underline; }

        /* Skeleton */
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .wl-root { flex-direction: column; }
          .wl-left {
            width: 100%;
            height: 80px;
            padding: 0 20px;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
          .wl-left__content {
            flex-direction: row;
            align-items: center;
            gap: 16px;
            justify-content: flex-start;
          }
          .wl-logo-text { font-size: 22px; margin: 0; }
          .wl-tagline, .wl-divider, .wl-announcement, .wl-powered { display: none; }
          .wl-right { padding: 32px 20px; }
        }
      `}</style>

      <div className="wl-root">
        {/* ── LEFT PANEL ─────────────────────────── */}
        <div className="wl-left">
          <div className="wl-left__content">
            {loading ? (
              <>
                <div className="skeleton" style={{ width: 160, height: 36, marginBottom: 28 }} />
                <div className="skeleton" style={{ width: '80%', height: 18, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: '60%', height: 18 }} />
              </>
            ) : (
              <>
                {config?.logo_url ? (
                  <img src={config.logo_url} alt={config.client_name} className="wl-logo" />
                ) : (
                  <div className="wl-logo-text">{config?.client_name}</div>
                )}
                {config?.tagline && <p className="wl-tagline">{config.tagline}</p>}

                {config?.announcement_active && config.announcement_text && !announcementDismissed && (
                  <>
                    <div className="wl-divider" />
                    <div
                      className="wl-announcement"
                      style={{ background: config.announcement_color + '30', borderLeft: `3px solid ${config.announcement_color}` }}
                    >
                      <p>📢 {config.announcement_text}</p>
                      <button className="wl-announcement-close" onClick={() => setAnnouncementDismissed(true)}>×</button>
                    </div>
                  </>
                )}
              </>
            )}
            <p className="wl-powered">Powered by NexLoan</p>
          </div>
        </div>

        {/* ── RIGHT PANEL ────────────────────────── */}
        <div className="wl-right">
          <div className="wl-form-wrap">
            {authStep === 'entry' ? (
              <>
                {authMode === 'login' ? (
                  <form onSubmit={handleLogin}>
                    <h1 className="wl-form-title">Welcome back</h1>
                    <p className="wl-form-sub">Sign in to your account</p>

                    {error && <div className="wl-alert wl-alert--error">{error}</div>}
                    {success && <div className="wl-alert wl-alert--success">{success}</div>}

                    <div className="wl-field">
                      <label className="wl-label">Email or Mobile</label>
                      <input
                        className="wl-input"
                        type="text"
                        value={loginId}
                        onChange={e => { setLoginId(e.target.value); setError(''); }}
                        placeholder="you@example.com or 9876543210"
                        autoFocus
                      />
                    </div>

                    <button className="wl-btn" type="submit" disabled={busy}>
                      {busy ? 'Sending OTP…' : 'Continue →'}
                    </button>

                    <div className="wl-toggle">
                      Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => { setAuthMode('register'); setError(''); setSuccess(''); }}>
                        Register
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRegister}>
                    <h1 className="wl-form-title">Create account</h1>
                    <p className="wl-form-sub">Join in minutes. No paperwork.</p>

                    {error && <div className="wl-alert wl-alert--error">{error}</div>}
                    {success && <div className="wl-alert wl-alert--success">{success}</div>}

                    <div className="wl-field">
                      <label className="wl-label">Full Name</label>
                      <input className="wl-input" type="text" value={fullName}
                        onChange={e => { setFullName(e.target.value); setError(''); }}
                        placeholder="Mayur Doiphode" autoFocus />
                    </div>
                    <div className="wl-field">
                      <label className="wl-label">Email Address</label>
                      <input className="wl-input" type="email" value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        placeholder="you@example.com" />
                    </div>
                    <div className="wl-field">
                      <label className="wl-label">Mobile Number</label>
                      <div className="wl-input-wrap">
                        <span className="wl-input-addon">+91</span>
                        <input className="wl-input wl-input--addon" type="tel" value={mobile}
                          onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                          placeholder="9876543210" maxLength={10} />
                      </div>
                    </div>

                    <button className="wl-btn" type="submit" disabled={busy}>
                      {busy ? 'Registering…' : 'Continue →'}
                    </button>

                    <div className="wl-toggle">
                      Already registered?{' '}
                      <button type="button" onClick={() => { setAuthMode('login'); setError(''); setSuccess(''); }}>
                        Sign in
                      </button>
                    </div>
                  </form>
                )}

                {/* Footer */}
                {config && (
                  <div className="wl-footer">
                    <p>
                      {config.registered_name && <>{config.registered_name}<br /></>}
                      {config.rbi_registration && <>Reg: {config.rbi_registration}<br /></>}
                      {config.terms_url && <><a href={config.terms_url}>Terms</a> · </>}
                      {config.privacy_url && <><a href={config.privacy_url}>Privacy</a></>}
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* ── OTP Step ─────────────────────── */
              <form onSubmit={handleVerifyOTP}>
                <button type="button" onClick={() => { setAuthStep('entry'); setOtp(''); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', marginBottom: 24, display: 'block' }}>
                  ← Back
                </button>

                <h1 className="wl-form-title">Verify identity</h1>
                <p className="wl-form-sub">We sent a 6-digit code to <strong style={{ color: '#111827' }}>{otpTarget}</strong></p>

                {error && <div className="wl-alert wl-alert--error">{error}</div>}
                {success && <div className="wl-alert wl-alert--success">{success}</div>}

                {/* OTP boxes */}
                <div className="wl-otp-wrap">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="wl-otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[i] || ''}
                      autoFocus={i === 0}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        const arr = otp.split('');
                        arr[i] = val;
                        const newOtp = arr.join('').slice(0, 6);
                        setOtp(newOtp);
                        if (val && i < 5) {
                          (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !otp[i] && i > 0) {
                          (document.getElementById(`otp-${i - 1}`) as HTMLInputElement)?.focus();
                        }
                      }}
                    />
                  ))}
                </div>

                <div className="wl-timer">
                  {otpTimer > 0
                    ? <span>Code expires in <strong>{formatTime(otpTimer)}</strong></span>
                    : <span style={{ color: '#DC2626' }}>Code expired.</span>}
                </div>

                <button className="wl-btn" type="submit" disabled={busy || otp.length < 6}>
                  {busy ? 'Verifying…' : 'Verify →'}
                </button>

                <div className="wl-toggle">
                  Didn&apos;t receive it?{' '}
                  <button type="button" disabled={otpTimer > 0 || busy}
                    style={{ color: otpTimer > 0 ? '#9CA3AF' : 'var(--client-primary)' }}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await authAPI.sendOTP({ identifier: otpTarget });
                        setOtpTimer(300); setSuccess('OTP resent!');
                      } catch { setError('Failed to resend'); } finally { setBusy(false); }
                    }}>
                    Resend OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
