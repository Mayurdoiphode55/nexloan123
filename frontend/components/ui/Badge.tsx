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
    bg: 'rgba(34,197,94,0.12)',
    text: '#22C55E',
    border: 'rgba(34,197,94,0.25)',
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    text: '#F59E0B',
    border: 'rgba(245,158,11,0.25)',
  },
  error: {
    bg: 'rgba(239,68,68,0.12)',
    text: '#EF4444',
    border: 'rgba(239,68,68,0.25)',
  },
  info: {
    bg: 'rgba(59,130,246,0.12)',
    text: '#3B82F6',
    border: 'rgba(59,130,246,0.25)',
  },
  accent: {
    bg: 'rgba(139,92,246,0.12)',
    text: '#A78BFA',
    border: 'rgba(139,92,246,0.25)',
  },
  neutral: {
    bg: 'rgba(161,161,170,0.12)',
    text: '#A1A1AA',
    border: 'rgba(161,161,170,0.25)',
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
