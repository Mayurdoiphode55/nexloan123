'use client';

import React, { useState, useId } from 'react';

interface InputProps {
  label: string
  value: string
  onChange?: (value: string) => void
  type?: string
  error?: string
  disabled?: boolean
  placeholder?: string
  prefix?: string
  addon?: string
  required?: boolean
  maxLength?: number
  className?: string
  id?: string
}

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  error,
  disabled = false,
  placeholder,
  prefix,
  addon,
  required = false,
  maxLength,
  className = '',
  id,
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const generatedId = useId()
  const inputId = id || generatedId
  const isActive = focused || (value?.length ?? 0) > 0

  return (
    <div className={className} style={{ position: 'relative', marginBottom: error ? '4px' : '0' }}>
      <div style={{ position: 'relative' }}>
        {(prefix || addon) && (
          <span
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-tertiary)',
              fontSize: '14px',
              fontFamily: 'var(--font-mono)',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            {prefix || addon}
          </span>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          required={required}
          maxLength={maxLength}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={isActive ? placeholder : ''}
          style={{
            width: '100%',
            padding: (prefix || addon) ? '16px 16px 8px 50px' : '16px 16px 8px 16px',
            paddingTop: isActive ? '22px' : '16px',
            paddingBottom: isActive ? '8px' : '16px',
            background: 'var(--surface-sunken)',
            border: `1px solid ${error ? 'var(--color-error)' : focused ? 'var(--accent-400)' : 'var(--surface-border)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: 'var(--font-body)',
            outline: 'none',
            transition: 'all var(--transition-base)',
            boxShadow: focused && !error ? '0 0 0 3px var(--accent-glow)' : 'none',
          }}
        />
        <label
          htmlFor={inputId}
          style={{
            position: 'absolute',
            left: (prefix || addon) && !isActive ? '50px' : '16px',
            top: isActive ? '8px' : '50%',
            transform: isActive ? 'none' : 'translateY(-50%)',
            fontSize: isActive ? '11px' : '14px',
            color: isActive ? (error ? 'var(--color-error)' : 'var(--accent-400)') : 'var(--text-tertiary)',
            fontWeight: isActive ? 500 : 400,
            pointerEvents: 'none',
            transition: 'all var(--transition-base)',
            letterSpacing: isActive ? '0.02em' : '0',
          }}
        >
          {label}
        </label>
      </div>
      {error && (
        <p
          style={{
            color: 'var(--color-error)',
            fontSize: '12px',
            marginTop: '6px',
            paddingLeft: '4px',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
