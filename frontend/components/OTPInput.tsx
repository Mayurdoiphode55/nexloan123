"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
}

export default function OTPInput({
  length = 6,
  value,
  onChange,
  disabled = false,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback(
    (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!/^\d*$/.test(val)) return;

      const digit = val.slice(-1);
      const newOtp = digits.slice();
      newOtp[index] = digit;
      const otpString = newOtp.join("");
      onChange(otpString);

      if (digit && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, length, focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const newOtp = digits.slice();
        if (newOtp[index]) {
          newOtp[index] = "";
          onChange(newOtp.join(""));
        } else if (index > 0) {
          newOtp[index - 1] = "";
          onChange(newOtp.join(""));
          focusInput(index - 1);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, length, focusInput]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (pasteData) {
        onChange(pasteData);
        focusInput(Math.min(pasteData.length, length - 1));
      }
    },
    [onChange, length, focusInput]
  );

  return (
    <div className="nexloan-otp" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => setActiveIndex(i)}
          onBlur={() => setActiveIndex(-1)}
          disabled={disabled}
          className={`nexloan-otp__box ${digits[i] ? "nexloan-otp__box--filled" : ""} ${activeIndex === i ? "nexloan-otp__box--focused" : ""}`}
          autoComplete="one-time-code"
        />
      ))}

      <style jsx>{`
        .nexloan-otp {
          display: flex;
          gap: var(--space-3);
          justify-content: center;
        }

        .nexloan-otp__box {
          width: 52px;
          height: 64px;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          font-family: var(--font-mono);
          font-size: var(--text-3xl);
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
          outline: none;
          caret-color: var(--accent-400);
          transition: all var(--transition-base);
        }

        .nexloan-otp__box--focused {
          border-color: var(--accent-400);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }

        .nexloan-otp__box--filled {
          animation: digitPop 150ms cubic-bezier(0.4, 0, 0.2, 1);
          border-color: var(--surface-border-hover);
        }

        .nexloan-otp__box:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes digitPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }

        @media (max-width: 640px) {
          .nexloan-otp__box {
            width: 44px;
            height: 52px;
            font-size: var(--text-2xl);
          }
        }
      `}</style>
    </div>
  );
}
