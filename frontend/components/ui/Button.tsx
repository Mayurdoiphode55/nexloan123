"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`nexloan-btn nexloan-btn--${variant} nexloan-btn--${size} ${fullWidth ? "nexloan-btn--full" : ""} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <span className="nexloan-btn__spinner" aria-label="Loading" />
      ) : (
        children
      )}

      <style jsx>{`
        .nexloan-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          font-family: var(--font-body);
          font-weight: 600;
          letter-spacing: 0.01em;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
        }

        .nexloan-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
        }

        /* ── Sizes ───────────────────────── */
        .nexloan-btn--sm {
          padding: 7px 14px;
          font-size: var(--text-sm);
        }
        .nexloan-btn--md {
          padding: 10px 20px;
          font-size: var(--text-base);
        }
        .nexloan-btn--lg {
          padding: 14px 28px;
          font-size: var(--text-base);
        }

        /* ── Full width ──────────────────── */
        .nexloan-btn--full {
          width: 100%;
        }

        /* ── Primary ─────────────────────── */
        .nexloan-btn--primary {
          background: var(--btn-primary-bg);
          color: var(--btn-primary-text);
        }
        .nexloan-btn--primary:hover:not(:disabled) {
          background: var(--btn-primary-bg-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-accent);
        }
        .nexloan-btn--primary:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
          box-shadow: none;
        }

        /* ── Secondary ───────────────────── */
        .nexloan-btn--secondary {
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
        }
        .nexloan-btn--secondary:hover:not(:disabled) {
          border-color: var(--accent-400);
          color: var(--accent-400);
        }
        .nexloan-btn--secondary:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        /* ── Ghost ────────────────────────── */
        .nexloan-btn--ghost {
          background: transparent;
          color: var(--btn-ghost-text);
        }
        .nexloan-btn--ghost:hover:not(:disabled) {
          color: var(--text-primary);
          background: var(--surface-border);
        }
        .nexloan-btn--ghost:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }

        /* ── Destructive ─────────────────── */
        .nexloan-btn--destructive {
          background: var(--color-error);
          color: var(--neutral-0);
        }
        .nexloan-btn--destructive:hover:not(:disabled) {
          background: #DC2626;
          transform: translateY(-1px);
          box-shadow: 0 0 24px rgba(239, 68, 68, 0.25);
        }
        .nexloan-btn--destructive:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
          box-shadow: none;
        }

        /* ── Spinner ─────────────────────── */
        .nexloan-btn__spinner {
          display: inline-block;
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: currentColor;
          border-radius: 50%;
          animation: spin 600ms linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
