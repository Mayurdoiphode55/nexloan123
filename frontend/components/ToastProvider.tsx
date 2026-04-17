"use client";

import React, { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  dismissing?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

const BORDER_COLORS: Record<ToastVariant, string> = {
  success: "var(--color-success)",
  error: "var(--color-error)",
  info: "var(--accent-400)",
};

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`nexloan-toast ${toast.dismissing ? "nexloan-toast--dismiss" : ""}`}
      style={{ borderLeftColor: BORDER_COLORS[toast.variant] }}
    >
      <p>{toast.message}</p>

      <style jsx>{`
        .nexloan-toast {
          background: var(--surface-overlay);
          border-radius: var(--radius-lg);
          border-left: 4px solid;
          padding: var(--space-4) var(--space-5);
          max-width: 380px;
          width: 100%;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          box-shadow: var(--shadow-lg);
          animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .nexloan-toast--dismiss {
          animation: slideDown 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .nexloan-toast p {
          margin: 0;
          line-height: 1.5;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(16px); }
        }
      `}</style>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = React.useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-2)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
