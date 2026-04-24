'use client';

import React, { useState, useEffect } from 'react';
import Badge from '@/components/ui/Badge';
import { Check } from 'lucide-react';

interface UnderwritingStep {
  label: string
  result?: string
  badge?: { text: string; variant: 'success' | 'warning' | 'error' | 'info' | 'accent' }
}

interface UnderwritingDisplayProps {
  kycVerdict: string
  creditScore: number | null
  creditTier: string | null
  dtiRatio: number | null
  finalStatus: string
  visible: boolean
}

export default function UnderwritingDisplay({
  kycVerdict, creditScore, creditTier, dtiRatio, finalStatus, visible,
}: UnderwritingDisplayProps) {
  const [activeStep, setActiveStep] = useState(-1);

  const dtiPass = (dtiRatio || 0) < 0.5;
  const statusEmoji = finalStatus === 'APPROVED' ? '🎉' : finalStatus === 'COUNTER_OFFERED' ? '🔄' : '📋';

  const steps: UnderwritingStep[] = [
    { label: 'Identity documents received' },
    { label: 'Groq Vision AI — extracting document fields' },
    { label: 'LayoutLM — verifying document structure' },
    { label: 'BERT NER — cross-referencing name match' },
    {
      label: `KYC Result: `,
      badge: {
        text: kycVerdict || 'PASS',
        variant: kycVerdict === 'PASS' ? 'success' : kycVerdict === 'FAIL' ? 'error' : 'warning',
      },
    },
    { label: 'Running Theoremlabs Credit Score...' },
    {
      label: `Score: ${creditScore || '—'} — ${creditTier || '—'}`,
      badge: {
        text: creditTier || 'N/A',
        variant: (creditScore || 0) >= 650 ? 'success' : (creditScore || 0) >= 450 ? 'warning' : 'error',
      },
    },
    {
      label: `DTI Check: ${((dtiRatio || 0) * 100).toFixed(1)}%`,
      badge: {
        text: dtiPass ? 'Pass' : 'Fail',
        variant: dtiPass ? 'success' : 'error',
      },
    },
    {
      label: `Decision: ${finalStatus}`,
      badge: {
        text: `${statusEmoji} ${finalStatus}`,
        variant: finalStatus === 'APPROVED' ? 'success' : finalStatus === 'COUNTER_OFFERED' ? 'warning' : 'error',
      },
    },
  ];

  useEffect(() => {
    if (!visible) return;
    const timers: NodeJS.Timeout[] = [];
    steps.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveStep(i), i * 1200));
    });
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--surface-border)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-8)',
      marginTop: '24px',
    }}>
      <div style={{
        fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
        marginBottom: '20px', fontFamily: 'var(--font-display)',
      }}>
        Live Underwriting Process
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {steps.map((step, i) => {
          const isActive = i <= activeStep;
          const isCurrent = i === activeStep && i < steps.length - 1;

          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'rgba(139,92,246,0.04)' : 'transparent',
                opacity: i > activeStep + 1 ? 0.3 : 1,
                transition: 'all 400ms ease',
                animation: isActive ? 'stepFadeIn 400ms ease forwards' : 'none',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '24px', height: '24px',
                borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isActive && !isCurrent ? (
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--color-success)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </div>
                ) : isCurrent ? (
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: '2px solid var(--accent-400)',
                    borderTopColor: 'transparent',
                    animation: 'spin 600ms linear infinite',
                  }} />
                ) : (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--text-tertiary)',
                  }} />
                )}
              </div>

              {/* Text */}
              <span style={{
                fontSize: '13px',
                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                flex: 1,
              }}>
                {step.label}
              </span>

              {/* Badge */}
              {isActive && step.badge && (
                <Badge variant={step.badge.variant}>{step.badge.text}</Badge>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes stepFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
