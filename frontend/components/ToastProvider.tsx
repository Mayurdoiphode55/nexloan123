'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let toastId = 0

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  const borderColors: Record<ToastVariant, string> = {
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    info: 'var(--accent-400)',
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="nexloan-toast"
            style={{
              background: 'var(--surface-overlay)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 20px',
              borderLeft: `3px solid ${borderColors[toast.variant]}`,
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              boxShadow: 'var(--shadow-md)',
              pointerEvents: 'auto',
              animation: 'toastIn 300ms cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes toastIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
