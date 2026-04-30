'use client';

import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const colorMap: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: {
    bg: 'var(--color-success-bg)',
    text: 'var(--color-success)',
    border: 'rgba(22, 163, 74, 0.2)',
  },
  warning: {
    bg: 'var(--color-warning-bg)',
    text: 'var(--color-warning)',
    border: 'rgba(217, 119, 6, 0.2)',
  },
  error: {
    bg: 'var(--color-error-bg)',
    text: 'var(--color-error)',
    border: 'rgba(220, 38, 38, 0.2)',
  },
  info: {
    bg: 'var(--color-info-bg)',
    text: 'var(--color-info)',
    border: 'rgba(37, 99, 235, 0.2)',
  },
  accent: {
    bg: 'var(--accent-subtle)',
    text: 'var(--accent-primary)',
    border: 'rgba(79, 70, 229, 0.2)',
  },
  neutral: {
    bg: 'var(--surface-sunken)',
    text: 'var(--text-secondary)',
    border: 'var(--surface-border)',
  },
}

export default function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  const colors = colorMap[variant]

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
