"use client";

import React from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

/**
 * Skeleton loader with shimmer animation.
 * Use to match the exact shape and size of the content it replaces.
 */
export default function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "var(--radius-md)",
  className = "",
}: SkeletonProps) {
  return (
    <div className={`nexloan-skeleton ${className}`} style={{ width, height, borderRadius }}>
      <style jsx>{`
        .nexloan-skeleton {
          background: var(--surface-overlay);
          background-image: linear-gradient(
            90deg,
            var(--surface-overlay) 0%,
            rgba(255, 255, 255, 0.06) 50%,
            var(--surface-overlay) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite ease-in-out;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton variants for common content shapes
 */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height="14px"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--surface-border)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
      }}
    >
      <Skeleton height="24px" width="40%" />
      <Skeleton height="48px" width="60%" />
      <SkeletonText lines={2} />
    </div>
  );
}
