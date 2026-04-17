"use client";

import React from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "accent";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const BADGE_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: {
    bg: "rgba(34,197,94,0.12)",
    text: "var(--color-success)",
    border: "rgba(34,197,94,0.30)",
  },
  warning: {
    bg: "rgba(245,158,11,0.12)",
    text: "var(--color-warning)",
    border: "rgba(245,158,11,0.30)",
  },
  error: {
    bg: "rgba(239,68,68,0.12)",
    text: "var(--color-error)",
    border: "rgba(239,68,68,0.30)",
  },
  info: {
    bg: "rgba(59,130,246,0.12)",
    text: "var(--color-info)",
    border: "rgba(59,130,246,0.30)",
  },
  neutral: {
    bg: "rgba(107,101,96,0.12)",
    text: "var(--text-secondary)",
    border: "rgba(107,101,96,0.30)",
  },
  accent: {
    bg: "rgba(124,58,237,0.12)",
    text: "var(--accent-400)",
    border: "rgba(124,58,237,0.30)",
  },
};

export default function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  const colors = BADGE_COLORS[variant];

  return (
    <span
      className={`nexloan-badge animate-scale-in ${className}`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `2px solid ${colors.border}`,
      }}
    >
      {children}

      <style jsx>{`
        .nexloan-badge {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-family: var(--font-body);
          font-size: var(--text-xs);
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1.4;
        }
      `}</style>
    </span>
  );
}
