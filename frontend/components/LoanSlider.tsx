"use client";

import React, { useRef, useState, useEffect } from "react";

interface LoanSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  formatMin?: string;
  formatMax?: string;
  suffix?: string;
}

export default function LoanSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatValue,
  formatMin,
  formatMax,
  suffix,
}: LoanSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const percentage = ((value - min) / (max - min)) * 100;

  const displayValue = formatValue ? formatValue(value) : value.toLocaleString("en-IN");

  return (
    <div className="nexloan-slider">
      <label className="nexloan-slider__label">{label}</label>

      <div className="nexloan-slider__value">
        <span className="nexloan-slider__amount">{displayValue}</span>
        {suffix && <span className="nexloan-slider__suffix">{suffix}</span>}
      </div>

      <div className="nexloan-slider__track-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="nexloan-slider__input"
          style={{ '--fill-percent': `${percentage}%` } as React.CSSProperties}
        />
      </div>

      <div className="nexloan-slider__range">
        <span>{formatMin || min.toLocaleString("en-IN")}</span>
        <span>{formatMax || max.toLocaleString("en-IN")}</span>
      </div>

      <style jsx>{`
        .nexloan-slider {
          width: 100%;
        }

        .nexloan-slider__label {
          display: block;
          font-family: var(--font-body);
          font-size: var(--text-xs);
          font-weight: 500;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: var(--space-3);
        }

        .nexloan-slider__value {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .nexloan-slider__amount {
          font-family: var(--font-mono);
          font-size: var(--text-4xl);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          transition: all var(--transition-fast);
        }

        .nexloan-slider__suffix {
          font-family: var(--font-body);
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          font-weight: 500;
        }

        .nexloan-slider__track-wrap {
          position: relative;
          width: 100%;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .nexloan-slider__input {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: linear-gradient(
            to right,
            var(--accent-500) 0%,
            var(--accent-500) var(--fill-percent),
            var(--surface-sunken) var(--fill-percent),
            var(--surface-sunken) 100%
          );
          outline: none;
          cursor: pointer;
        }

        .nexloan-slider__input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent-400);
          border: 2px solid var(--neutral-0);
          box-shadow: var(--shadow-accent);
          cursor: pointer;
          transition: transform var(--transition-fast);
        }

        .nexloan-slider__input::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .nexloan-slider__input::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--accent-400);
          border: 2px solid var(--neutral-0);
          box-shadow: var(--shadow-accent);
          cursor: pointer;
        }

        .nexloan-slider__range {
          display: flex;
          justify-content: space-between;
          margin-top: var(--space-2);
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
