"use client";

import React from "react";

type CardVariant = "default" | "elevated" | "bordered" | "interactive";

interface CardProps {
  variant?: CardVariant;
  padding?: "default" | "large";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({
  variant = "default",
  padding = "default",
  children,
  className = "",
  onClick,
}: CardProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      className={`nexloan-card nexloan-card--${variant} nexloan-card--pad-${padding} ${className}`}
      onClick={onClick}
      {...(Tag === "button" ? { type: "button" as const } : {})}
    >
      {children}

      <style jsx>{`
        .nexloan-card {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          transition: all var(--transition-base);
          text-align: left;
          width: 100%;
        }

        .nexloan-card--pad-default {
          padding: var(--space-6);
        }
        .nexloan-card--pad-large {
          padding: var(--space-8);
        }

        /* ── Elevated ────────────────────── */
        .nexloan-card--elevated {
          box-shadow: var(--shadow-md);
        }

        /* ── Bordered ────────────────────── */
        .nexloan-card--bordered {
          border-width: 2px;
        }

        /* ── Interactive ─────────────────── */
        .nexloan-card--interactive {
          cursor: pointer;
          border: 1px solid var(--surface-border);
        }
        .nexloan-card--interactive:hover {
          border-color: var(--surface-border-hover);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .nexloan-card--interactive:active {
          transform: translateY(0);
        }

        button.nexloan-card {
          cursor: pointer;
          font: inherit;
          color: inherit;
          outline: none;
        }
      `}</style>
    </Tag>
  );
}
