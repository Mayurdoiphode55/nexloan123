"use client";

import React, { useState, useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  addon?: string; // Left addon like "+91"
}

export default function Input({
  label,
  error,
  addon,
  value,
  onFocus,
  onBlur,
  className = "",
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const hasValue = value !== undefined && value !== "";
  const isFloating = focused || hasValue;

  return (
    <div className={`nexloan-input-wrapper ${error ? "nexloan-input-wrapper--error" : ""} ${className}`}>
      <div className="nexloan-input-container">
        {addon && (
          <span className="nexloan-input-addon">{addon}</span>
        )}
        <div className="nexloan-input-field-wrap">
          <input
            id={id}
            className={`nexloan-input-field ${addon ? "nexloan-input-field--with-addon" : ""}`}
            value={value}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />
          <label
            htmlFor={id}
            className={`nexloan-input-label ${isFloating ? "nexloan-input-label--float" : ""}`}
          >
            {label}
          </label>
        </div>
      </div>
      {error && <p className="nexloan-input-error">{error}</p>}

      <style jsx>{`
        .nexloan-input-wrapper {
          position: relative;
          width: 100%;
        }

        .nexloan-input-container {
          display: flex;
          align-items: stretch;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          transition: all var(--transition-base);
        }

        .nexloan-input-container:focus-within {
          border-color: var(--accent-400);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .nexloan-input-wrapper--error .nexloan-input-container {
          border-color: var(--color-error);
        }
        .nexloan-input-wrapper--error .nexloan-input-container:focus-within {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .nexloan-input-addon {
          display: flex;
          align-items: center;
          padding: 0 12px 0 16px;
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-tertiary);
          border-right: 1px solid var(--surface-border);
          user-select: none;
          white-space: nowrap;
        }

        .nexloan-input-field-wrap {
          position: relative;
          flex: 1;
          min-height: 52px;
        }

        .nexloan-input-label {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-tertiary);
          pointer-events: none;
          transition: all var(--transition-base);
          transform-origin: left center;
        }

        .nexloan-input-label--float,
        .nexloan-input-field:-webkit-autofill ~ .nexloan-input-label {
          top: 8px;
          transform: translateY(0);
          font-size: var(--text-xs);
          color: var(--text-accent);
          letter-spacing: 0.02em;
        }

        .nexloan-input-field {
          width: 100%;
          height: 100%;
          padding: 22px 16px 8px 16px;
          background: transparent;
          border: none;
          outline: none;
          font-family: var(--font-body);
          font-size: var(--text-base);
          color: var(--text-primary);
          line-height: 1.4;
        }

        .nexloan-input-field--with-addon {
          padding-left: 12px;
        }

        .nexloan-input-field::placeholder {
          color: transparent;
        }

        .nexloan-input-field:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nexloan-input-error {
          margin-top: var(--space-1);
          font-size: var(--text-sm);
          color: var(--color-error);
          padding-left: var(--space-1);
        }
      `}</style>
    </div>
  );
}
