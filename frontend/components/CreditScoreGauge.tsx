"use client";

import React, { useEffect, useState } from "react";

interface CreditScoreGaugeProps {
  score: number;
  maxScore?: number;
  minScore?: number;
}

export default function CreditScoreGauge({
  score,
  maxScore = 850,
  minScore = 300,
}: CreditScoreGaugeProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Calculate arc
  const radius = 80;
  const strokeWidth = 12;
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;
  const circumference = (totalAngle / 360) * 2 * Math.PI * radius;
  const filledPercent = Math.min(Math.max((score - minScore) / (maxScore - minScore), 0), 1);
  const filledOffset = circumference * (1 - filledPercent);

  // Color based on score band
  const getColor = () => {
    if (score < 600) return "var(--color-error)";
    if (score < 650) return "var(--color-warning)";
    if (score < 700) return "#EAB308";
    if (score < 750) return "var(--color-success)";
    return "var(--gold-400)";
  };

  const getBandLabel = () => {
    if (score < 600) return "Poor";
    if (score < 650) return "Fair";
    if (score < 700) return "Good";
    if (score < 750) return "Very Good";
    return "Excellent";
  };

  const color = getColor();

  // SVG arc path
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const start = polarToCartesian(100, 100, radius, startAngle);
  const end = polarToCartesian(100, 100, radius, endAngle);
  const largeArc = totalAngle > 180 ? 1 : 0;
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  return (
    <div className="credit-gauge">
      <p className="credit-gauge__label">THEOREMLABS CREDIT SCORE</p>

      <div className="credit-gauge__svg-wrap">
        <svg viewBox="0 0 200 200" width="200" height="200">
          {/* Track */}
          <path
            d={arcPath}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? filledOffset : circumference}
            style={{
              transition: animated ? "stroke-dashoffset 1.2s ease-out" : "none",
            }}
          />
        </svg>

        {/* Center text */}
        <div className="credit-gauge__center">
          <span className="credit-gauge__score" style={{ color }}>{score}</span>
          <span className="credit-gauge__band" style={{ color }}>{getBandLabel()}</span>
        </div>

        {/* Min/Max */}
        <span className="credit-gauge__min">{minScore}</span>
        <span className="credit-gauge__max">{maxScore}</span>
      </div>

      <style jsx>{`
        .credit-gauge {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .credit-gauge__label {
          font-size: var(--text-xs);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          margin-bottom: var(--space-4);
        }
        .credit-gauge__svg-wrap {
          position: relative;
          width: 200px;
          height: 200px;
        }
        .credit-gauge__center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -40%);
          text-align: center;
        }
        .credit-gauge__score {
          display: block;
          font-family: var(--font-display);
          font-size: var(--text-5xl);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .credit-gauge__band {
          display: block;
          font-size: var(--text-sm);
          font-weight: 600;
          margin-top: var(--space-1);
        }
        .credit-gauge__min,
        .credit-gauge__max {
          position: absolute;
          bottom: 24px;
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          font-family: var(--font-mono);
        }
        .credit-gauge__min { left: 16px; }
        .credit-gauge__max { right: 16px; }
      `}</style>
    </div>
  );
}
