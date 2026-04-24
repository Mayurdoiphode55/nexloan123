'use client';

import { useState, useMemo } from 'react';

interface PrepaymentCalculatorProps {
  outstandingBalance: number;
  monthlyRate: number;
  remainingMonths: number;
  emiAmount: number;
}

export default function PrepaymentCalculator({
  outstandingBalance,
  monthlyRate,
  remainingMonths,
  emiAmount,
}: PrepaymentCalculatorProps) {
  const [prepayAmount, setPrepayAmount] = useState(0);

  const impact = useMemo(() => {
    if (prepayAmount <= 0 || prepayAmount >= outstandingBalance) {
      return { interestSaved: 0, monthsSaved: 0, newMonths: remainingMonths };
    }

    // Interest without prepayment
    const totalWithout = emiAmount * remainingMonths;
    const interestWithout = totalWithout - outstandingBalance;

    // Interest with prepayment
    const newBalance = outstandingBalance - prepayAmount;
    const denominator = emiAmount - newBalance * monthlyRate;
    if (denominator <= 0) return { interestSaved: 0, monthsSaved: 0, newMonths: remainingMonths };

    const newMonths = Math.max(1, Math.ceil(
      Math.log(emiAmount / denominator) / Math.log(1 + monthlyRate)
    ));
    const totalWith = emiAmount * newMonths;
    const interestWith = totalWith - newBalance;

    return {
      interestSaved: Math.max(0, interestWithout - interestWith),
      monthsSaved: Math.max(0, remainingMonths - newMonths),
      newMonths,
    };
  }, [prepayAmount, outstandingBalance, monthlyRate, remainingMonths, emiAmount]);

  const percent = outstandingBalance > 0 ? (prepayAmount / outstandingBalance) * 100 : 0;

  return (
    <div className="prepay">
      <div className="prepay__slider-section">
        <label className="prepay__label">PREPAYMENT AMOUNT</label>
        <div className="prepay__value">₹{prepayAmount.toLocaleString('en-IN')}</div>
        <input
          type="range"
          min={0}
          max={outstandingBalance}
          step={1000}
          value={prepayAmount}
          onChange={(e) => setPrepayAmount(Number(e.target.value))}
          className="prepay__slider"
          style={{
            background: `linear-gradient(to right, var(--accent-500) ${percent}%, var(--surface-border) ${percent}%)`
          }}
        />
        <div className="prepay__range">
          <span>₹0</span>
          <span>₹{outstandingBalance.toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="prepay__results">
        <div className="prepay__result-card prepay__result-card--success">
          <span className="prepay__result-label">INTEREST SAVED</span>
          <span className="prepay__result-value" style={{ color: 'var(--color-success)' }}>
            ₹{Math.round(impact.interestSaved).toLocaleString('en-IN')}
          </span>
        </div>
        <div className="prepay__result-card prepay__result-card--accent">
          <span className="prepay__result-label">MONTHS SAVED</span>
          <span className="prepay__result-value" style={{ color: 'var(--accent-400)' }}>
            {impact.monthsSaved}
          </span>
        </div>
      </div>

      {prepayAmount > 0 && (
        <div className="prepay__summary">
          <p>New tenure: <strong>{impact.newMonths} months</strong> (was {remainingMonths} months)</p>
        </div>
      )}

      <style jsx>{`
        .prepay {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
        }
        .prepay__label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .prepay__value {
          font-family: var(--font-mono);
          font-size: var(--text-3xl);
          font-weight: 700;
          color: var(--text-primary);
          margin: var(--space-2) 0 var(--space-4);
        }
        .prepay__slider {
          width: 100%;
          height: 6px;
          appearance: none;
          border-radius: 3px;
          outline: none;
          cursor: pointer;
        }
        .prepay__slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent-500);
          border: 3px solid var(--surface-base);
          box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
          cursor: pointer;
          transition: transform var(--transition-fast);
        }
        .prepay__slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .prepay__range {
          display: flex;
          justify-content: space-between;
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: var(--space-2);
        }
        .prepay__results {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          margin-top: var(--space-6);
        }
        .prepay__result-card {
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          text-align: center;
        }
        .prepay__result-label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          display: block;
          margin-bottom: var(--space-2);
        }
        .prepay__result-value {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: 700;
        }
        .prepay__summary {
          text-align: center;
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          padding: var(--space-3);
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
        }
        .prepay__summary strong {
          color: var(--accent-400);
        }
      `}</style>
    </div>
  );
}
