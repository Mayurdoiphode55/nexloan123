"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loanAPI } from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LoanTimeline from "@/components/dashboard/LoanTimeline";
import CallbackModal from "@/components/dashboard/CallbackModal";

export default function TrackPage() {
  const router = useRouter();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCallback, setShowCallback] = useState(false);

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const res = await loanAPI.getMyLoans();
        const loans = res.data;
        if (loans && loans.length > 0) {
          setLoan(loans[0]);
        }
      } catch (err) {
        console.error("Failed to load loans", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoan();
  }, [router]);

  const getStatusVariant = (s: string): "success" | "error" | "warning" | "info" | "accent" => {
    switch (s) {
      case "APPROVED": case "ACTIVE": case "CLOSED": return "success";
      case "REJECTED": return "error";
      case "COUNTER_OFFERED": case "KYC_PENDING": return "warning";
      default: return "info";
    }
  };

  if (loading) {
    return (
      <div className="track-page">
        <div className="track-skeleton">
          <div className="track-skeleton__bar" />
          <div className="track-skeleton__bar track-skeleton__bar--short" />
          <div className="track-skeleton__bar track-skeleton__bar--med" />
        </div>
        <style jsx>{`
          .track-page { max-width: 700px; margin: 0 auto; }
          .track-skeleton { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-8) 0; }
          .track-skeleton__bar { height: 20px; border-radius: var(--radius-sm); background: var(--surface-sunken); animation: tsk 1.5s infinite; width: 100%; }
          .track-skeleton__bar--short { width: 40%; }
          .track-skeleton__bar--med { width: 70%; }
          @keyframes tsk { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        `}</style>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="track-page">
        <h1 className="track-page__title">Track Loan</h1>
        <Card className="text-center" style={{ padding: "var(--space-12)" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            No loan application to track.
          </p>
          <button
            onClick={() => router.push("/apply")}
            style={{
              padding: "var(--space-3) var(--space-6)",
              background: "var(--accent-400)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Apply for a Loan
          </button>
        </Card>
        <style jsx>{`
          .track-page { max-width: 700px; margin: 0 auto; }
          .track-page__title {
            font-family: var(--font-display);
            font-size: var(--text-3xl);
            font-weight: 700;
            margin-bottom: var(--space-6);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="track-page">
      <h1 className="track-page__title">Track Your Loan</h1>

      {/* Loan Header */}
      <div className="track-header">
        <div className="track-header__info">
          <span className="track-header__number">{loan.loan_number}</span>
          <span className="track-header__amount">
            ₹{loan.loan_amount?.toLocaleString("en-IN")}
          </span>
        </div>
        <Badge variant={getStatusVariant(loan.status)}>
          {loan.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Live Loan Timeline with Visual Progress Bar */}
      <Card variant="elevated" style={{ marginTop: "var(--space-6)" }}>
        <div className="track-card-header">
          <h2 className="track-card-header__title">📊 Live Loan Status Tracker</h2>
        </div>
        <div style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}>
          <LoanTimeline loanId={loan.id} />
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="track-actions">
        <button
          className="track-action-btn"
          onClick={() => setShowCallback(true)}
        >
          📞 Request a Callback
        </button>
        <button
          className="track-action-btn track-action-btn--outline"
          onClick={() => router.push("/dashboard")}
        >
          📋 View Dashboard
        </button>
      </div>

      {/* Callback Modal */}
      <CallbackModal
        isOpen={showCallback}
        onClose={() => setShowCallback(false)}
        loanId={loan.id}
      />

      <style jsx>{`
        .track-page {
          max-width: 700px;
          margin: 0 auto;
        }

        .track-page__title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-6);
        }

        .track-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-5);
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
        }

        .track-header__info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .track-header__number {
          font-family: var(--font-mono);
          font-size: var(--text-lg);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.02em;
        }

        .track-header__amount {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }

        .track-card-header {
          padding: var(--space-4) var(--space-6) 0;
        }

        .track-card-header__title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }

        .track-actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-6);
        }

        .track-action-btn {
          flex: 1;
          padding: var(--space-3) var(--space-4);
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .track-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        .track-action-btn--outline {
          background: transparent;
          border: 1px solid rgba(124, 58, 237, 0.4);
          color: #a855f7;
        }

        .track-action-btn--outline:hover {
          background: rgba(124, 58, 237, 0.1);
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
