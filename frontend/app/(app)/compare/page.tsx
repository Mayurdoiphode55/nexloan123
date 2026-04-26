'use client';

import { useState, useEffect } from 'react';

function calculateEMI(principal: number, annualRate: number, tenureMonths: number) {
  if (annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12 / 100;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}

interface LoanOption {
  amount: number;
  rate: number;
  tenure: number;
}

const DEFAULT_OPTIONS: LoanOption[] = [
  { amount: 300000, rate: 13, tenure: 24 },
  { amount: 300000, rate: 13, tenure: 36 },
];

export default function ComparePage() {
  const [options, setOptions] = useState<LoanOption[]>(DEFAULT_OPTIONS);
  const [userIncome, setUserIncome] = useState(75000);

  const updateOption = (idx: number, field: keyof LoanOption, value: number) => {
    setOptions(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const results = options.map(opt => {
    const emi = calculateEMI(opt.amount, opt.rate, opt.tenure);
    const totalCost = emi * opt.tenure;
    const totalInterest = totalCost - opt.amount;
    const incomePercent = (emi / userIncome) * 100;
    return { emi, totalCost, totalInterest, incomePercent };
  });

  const minInterest = Math.min(...results.map(r => r.totalInterest));
  const minEmi = Math.min(...results.map(r => r.emi));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#e5e5e5', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>
          ⚖️ Loan Comparison Tool
        </h1>
        <p style={{ color: '#737373', fontSize: '14px', margin: 0 }}>
          Compare different loan options side-by-side to find the best fit for you
        </p>
      </div>

      {/* Income input */}
      <div
        style={{
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#a3a3a3', fontSize: '13px' }}>Your monthly income:</span>
        <input
          type="number"
          value={userIncome}
          onChange={e => setUserIncome(Number(e.target.value) || 0)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            color: '#e5e5e5',
            padding: '8px 12px',
            fontSize: '14px',
            width: '140px',
            outline: 'none',
          }}
        />
        <span style={{ color: '#525252', fontSize: '12px' }}>
          Used for affordability analysis
        </span>
      </div>

      {/* Comparison cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {options.map((opt, idx) => {
          const r = results[idx];
          const isBestInterest = r.totalInterest === minInterest;
          const isBestEmi = r.emi === minEmi;

          return (
            <div
              key={idx}
              style={{
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#a855f7', fontSize: '16px', margin: '0 0 4px', fontWeight: 600 }}>
                  Option {String.fromCharCode(65 + idx)}
                </h3>
                {(isBestInterest || isBestEmi) && (
                  <span
                    style={{
                      fontSize: '11px',
                      background: isBestInterest ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                      color: isBestInterest ? '#10b981' : '#3b82f6',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {isBestInterest && isBestEmi ? '🏆 Best Overall' : isBestInterest ? '💰 Save More' : '📉 Lower EMI'}
                  </span>
                )}
              </div>

              {/* Loan Amount Slider */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Loan Amount</span>
                  <span style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600 }}>
                    ₹{opt.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={1000000}
                  step={10000}
                  value={opt.amount}
                  onChange={e => updateOption(idx, 'amount', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              {/* Interest Rate */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Interest Rate (% p.a.)</span>
                  <span style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600 }}>{opt.rate}%</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  step={0.5}
                  value={opt.rate}
                  onChange={e => updateOption(idx, 'rate', Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#a855f7' }}
                />
              </div>

              {/* Tenure */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '12px' }}>Tenure</span>
                  <span style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600 }}>{opt.tenure} months</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[6, 12, 18, 24, 36, 48, 60].map(t => (
                    <button
                      key={t}
                      onClick={() => updateOption(idx, 'tenure', t)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: opt.tenure === t ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                        background: opt.tenure === t ? 'rgba(124,58,237,0.2)' : 'transparent',
                        color: opt.tenure === t ? '#a855f7' : '#737373',
                        transition: 'all 0.15s',
                      }}
                    >
                      {t}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '13px' }}>Monthly EMI</span>
                  <span style={{ color: '#e5e5e5', fontSize: '20px', fontWeight: 700 }}>
                    ₹{Math.round(r.emi).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '13px' }}>Total Interest</span>
                  <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600 }}>
                    ₹{Math.round(r.totalInterest).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '13px' }}>Total Cost</span>
                  <span style={{ color: '#e5e5e5', fontSize: '14px', fontWeight: 600 }}>
                    ₹{Math.round(r.totalCost).toLocaleString('en-IN')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#a3a3a3', fontSize: '13px' }}>EMI / Income</span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: r.incomePercent <= 20 ? '#10b981' : r.incomePercent <= 35 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {r.incomePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(16,185,129,0.1))',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: '12px',
          padding: '20px 24px',
        }}
      >
        <h4 style={{ color: '#e5e5e5', fontSize: '15px', margin: '0 0 8px', fontWeight: 600 }}>
          💡 Recommendation
        </h4>
        <p style={{ color: '#a3a3a3', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
          {results[0].emi < results[1].emi ? (
            <>
              <strong style={{ color: '#a855f7' }}>Option A</strong> has a lower EMI of ₹{Math.round(results[0].emi).toLocaleString('en-IN')} ({results[0].incomePercent.toFixed(1)}% of income).
              {results[0].totalInterest < results[1].totalInterest
                ? ` It also saves you ₹${Math.round(results[1].totalInterest - results[0].totalInterest).toLocaleString('en-IN')} in interest — best overall choice.`
                : ` However, Option B saves ₹${Math.round(results[0].totalInterest - results[1].totalInterest).toLocaleString('en-IN')} in total interest.`
              }
            </>
          ) : (
            <>
              <strong style={{ color: '#a855f7' }}>Option B</strong> has a lower EMI of ₹{Math.round(results[1].emi).toLocaleString('en-IN')} ({results[1].incomePercent.toFixed(1)}% of income).
              {results[1].totalInterest < results[0].totalInterest
                ? ` It also saves you ₹${Math.round(results[0].totalInterest - results[1].totalInterest).toLocaleString('en-IN')} in interest — best overall choice.`
                : ` However, Option A saves ₹${Math.round(results[1].totalInterest - results[0].totalInterest).toLocaleString('en-IN')} in total interest.`
              }
            </>
          )}
          {' '}
          {Math.min(results[0].incomePercent, results[1].incomePercent) <= 20
            ? 'Both options are within a comfortable affordability range. ✅'
            : Math.min(results[0].incomePercent, results[1].incomePercent) <= 35
              ? 'Consider the option with a lower EMI-to-income ratio for financial flexibility.'
              : '⚠️ Both options exceed 35% of your income. Consider a smaller loan amount or longer tenure.'
          }
        </p>
      </div>
    </div>
  );
}
