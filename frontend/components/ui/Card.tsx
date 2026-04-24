'use client';

import React from 'react';

interface CardProps {
  variant?: 'default' | 'elevated' | 'accent-border'
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

export default function Card({
  variant = 'default',
  hover = false,
  padding = 'md',
  children,
  className = '',
  style = {},
  id,
}: CardProps) {
  const paddingMap = { sm: '16px', md: '24px', lg: '32px' }

  const baseStyles: React.CSSProperties = {
    background: 'var(--surface-raised)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-xl)',
    padding: paddingMap[padding],
    transition: 'all var(--transition-base)',
    ...style,
  }

  if (variant === 'accent-border') {
    baseStyles.borderColor = 'var(--accent-500)'
    baseStyles.boxShadow = 'var(--shadow-accent)'
  } else if (variant === 'elevated') {
    baseStyles.boxShadow = 'var(--shadow-md)'
  }

  return (
    <div
      id={id}
      className={`nexloan-card ${hover ? 'nexloan-card--hover' : ''} ${className}`}
      style={baseStyles}
    >
      {children}
      <style jsx>{`
        .nexloan-card--hover:hover {
          transform: translateY(-2px);
          border-color: var(--surface-border-strong) !important;
        }
      `}</style>
    </div>
  )
}
