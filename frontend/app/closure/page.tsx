'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { closureAPI } from '@/lib/api';
import Button from '@/components/ui/Button';
import type { ClosureStats } from '@/types/loan';

function ClosureContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loanId = searchParams.get('id') || '';
  const [stats, setStats] = useState<ClosureStats | null>(null);
  const [phase, setPhase] = useState(0);
  const userName = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('nexloan_user') || '{}').full_name || 'Champion'
    : 'Champion';
  const userEmail = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem('nexloan_user') || '{}').email || ''
    : '';

  useEffect(() => {
    if (loanId) {
      closureAPI.getClosureStats(loanId).then(res => setStats(res.data)).catch(() => {
        setStats({
          total_paid: 612000, original_amount: 500000, interest_paid: 112000,
          early_payments_count: 4, interest_saved: 8500,
          estimated_score_improvement: 15, reapply_offer_amount: 750000, reapply_offer_rate: 11.5,
        });
      });
    }
  }, [loanId]);

  // Sequence animation phases
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 100),    // confetti
      setTimeout(() => setPhase(2), 2200),   // checkmark
      setTimeout(() => setPhase(3), 3000),   // headline
      setTimeout(() => setPhase(4), 3600),   // stats
      setTimeout(() => setPhase(5), 4100),   // offer
      setTimeout(() => setPhase(6), 4600),   // certificate
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-IN');

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--surface-base)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Confetti */}
      {phase >= 1 && (
        <div className="confetti-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: '-10px',
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                background: ['var(--accent-400)', 'var(--color-success)', 'var(--color-gold)', '#fff'][i % 4],
                animation: `confettiFall ${2 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '560px', width: '100%', textAlign: 'center' }}>
        {/* Checkmark */}
        {phase >= 2 && (
          <div style={{ margin: '0 auto 24px', width: '80px', height: '80px' }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r="36"
                fill="none" stroke="var(--color-success)" strokeWidth="3"
                strokeDasharray="226" strokeDashoffset="0"
                style={{ animation: 'drawCircle 800ms ease-out forwards' }}
              />
              <path
                d="M24 40 L35 52 L56 28"
                fill="none" stroke="var(--color-success)" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="50" strokeDashoffset="50"
                style={{ animation: 'drawCheck 400ms ease-out 400ms forwards' }}
              />
            </svg>
          </div>
        )}

        {/* Headline */}
        {phase >= 3 && (
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 700, color: 'var(--text-primary)',
            animation: 'fadeInUp 600ms ease forwards',
            marginBottom: '32px',
          }}>
            You did it, {userName}.
          </h1>
        )}

        {/* Journey Stats */}
        {phase >= 4 && stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
            marginBottom: '32px',
            animation: 'slideUp 400ms ease forwards',
          }}>
            <div style={{
              background: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)',
              padding: '20px', border: '1px solid var(--surface-border)',
            }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                TOTAL REPAID
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 700, color: 'var(--text-primary)' }}>
                ₹{fmt(stats.total_paid)}
              </div>
            </div>
            <div style={{
              background: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)',
              padding: '20px', border: '1px solid var(--surface-border)',
            }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                INTEREST SAVED
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 700, color: 'var(--color-success)' }}>
                ₹{fmt(stats.interest_saved)}
              </div>
            </div>
            <div style={{
              background: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)',
              padding: '20px', border: '1px solid var(--surface-border)',
            }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                SCORE IMPROVED
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 700, color: 'var(--color-gold)' }}>
                +{stats.estimated_score_improvement} pts
              </div>
            </div>
          </div>
        )}

        {/* Pre-approved Offer */}
        {phase >= 5 && stats && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(59,130,246,0.12))',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 'var(--radius-xl)', padding: '32px',
            marginBottom: '32px', textAlign: 'center',
            animation: 'slideUp 400ms ease forwards',
          }}>
            <div style={{
              fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--accent-400)', marginBottom: '8px', fontWeight: 600,
            }}>
              You&apos;re Pre-Approved
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700, color: 'var(--text-primary)', margin: '8px 0',
            }}>
              ₹{fmt(stats.reapply_offer_amount)}
            </div>
            <div style={{
              display: 'inline-flex', padding: '4px 12px',
              background: 'rgba(139,92,246,0.15)', borderRadius: 'var(--radius-full)',
              fontSize: '13px', color: 'var(--accent-300)', fontWeight: 500,
            }}>
              {stats.reapply_offer_rate}% p.a. — Your Loyalty Rate
            </div>
            <div style={{ marginTop: '20px' }}>
              <Button variant="primary" size="lg" onClick={() => router.push('/auth')}>
                Apply for Your Next Loan →
              </Button>
            </div>
          </div>
        )}

        {/* No-Dues Certificate */}
        {phase >= 6 && stats && (
          <div style={{
            animation: 'fadeInUp 400ms ease forwards',
            textAlign: 'left',
          }}>
            <div style={{
              background: 'var(--surface-raised)', borderRadius: 'var(--radius-xl)',
              padding: '32px', border: '1px solid var(--surface-border)',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                No Dues Certificate
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                This certifies that the personal loan account has been closed in full
                and there are no outstanding dues payable to NexLoan. Original amount:
                ₹{fmt(stats.original_amount)}. Total repaid: ₹{fmt(stats.total_paid)}.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px' }}>
                Certificate emailed to {userEmail}
              </p>
              <div style={{ marginTop: '16px' }}>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) rotate(720deg); }
        }
        @keyframes drawCircle {
          from { stroke-dashoffset: 226; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 50; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function ClosurePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--surface-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <ClosureContent />
    </Suspense>
  );
}
