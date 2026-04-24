'use client';

import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
  id?: string
  fullWidth?: boolean
  style?: React.CSSProperties
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  onClick,
  type = 'button',
  className = '',
  id,
  fullWidth = false,
  style = {},
}: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-fast)',
    border: 'none',
    opacity: disabled ? 0.5 : 1,
    position: 'relative',
    whiteSpace: 'nowrap',
  }

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '7px 14px', fontSize: '13px' },
    md: { padding: '10px 20px', fontSize: '14px' },
    lg: { padding: '14px 28px', fontSize: '16px' },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent-500)',
      color: '#FFFFFF',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--surface-border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: 'none',
    },
    destructive: {
      background: 'transparent',
      color: 'var(--color-error)',
      border: '1px solid rgba(239,68,68,0.3)',
    },
  }

  return (
    <button
      id={id}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`nexloan-btn nexloan-btn--${variant} ${className}`}
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {loading ? (
        <span
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 600ms linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        children
      )}
      <style jsx>{`
        .nexloan-btn--primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: var(--shadow-accent);
          background: var(--accent-400) !important;
        }
        .nexloan-btn--primary:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
        }
        .nexloan-btn--secondary:hover:not(:disabled) {
          border-color: var(--accent-400) !important;
          color: var(--accent-400) !important;
        }
        .nexloan-btn--ghost:hover:not(:disabled) {
          color: var(--text-primary) !important;
        }
        .nexloan-btn--destructive:hover:not(:disabled) {
          background: rgba(239,68,68,0.08) !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
