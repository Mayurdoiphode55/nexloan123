'use client';

import React from 'react';

interface SkeletonProps {
  width?: string
  height?: string
  borderRadius?: string
  className?: string
}

export default function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-md)',
  className = '',
}: SkeletonProps) {
  return (
    <div
      className={`nexloan-skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--surface-overlay)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style jsx>{`
        .nexloan-skeleton::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.04),
            transparent
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
