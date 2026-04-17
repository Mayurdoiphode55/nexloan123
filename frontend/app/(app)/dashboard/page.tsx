"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyLoans,
  runUnderwriting,
  disburseLoan,
  getSchedule,
  getPreclosureQuote,
  closeLoan,
  getAuditTrail,
  downloadReport,
  AuditLogItem,
} from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { SkeletonCard, SkeletonText } from "@/components/ui/Skeleton";
import CreditScoreGauge from "@/components/CreditScoreGauge";
import EMIScheduleTable from "@/components/EMIScheduleTable";
import AuditTrail from "@/components/AuditTrail";
import CreditCoin3D from "@/components/3d/CreditCoin3D";

export default function DashboardPage() {
  const { showToast } = useToast();
  const router = useRouter();

  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [auditTrailLogs, setAuditTrailLogs] = useState<AuditLogItem[]>([]);
  const [showKFS, setShowKFS] = useState(false);

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const token = localStorage.getItem("nexloan_token");
        if (!token) {
          router.push("/");
          return;
        }

        const loans = await getMyLoans();
        if (loans && loans.length > 0) {
          const activeLoan = loans[0];
          setLoan(activeLoan);
          
          if (activeLoan.status === "ACTIVE") {
            setLoadingSchedule(true);
            try {
              const sched = await getSchedule(activeLoan.id);
              setSchedule(sched);
            } catch (err) {
              console.error("Failed to load schedule", err);
            } finally {
              setLoadingSchedule(false);
            }
          }

          try {
            const logs = await getAuditTrail(activeLoan.id);
            setAuditTrailLogs(logs);
          } catch(err) {
            console.error("Failed to load audit trail", err);
          }
        }
      } catch (err) {
        console.error("Failed to load loans", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLoan();
  }, [router]);

  const handleRunUnderwriting = async () => {
    try {
      setProcessing(true);
      await runUnderwriting(loan.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      showToast("Evaluation failed. Make sure KYC is verified.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleDisburse = async () => {
    try {
      setProcessing(true);
      await disburseLoan(loan.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      showToast("Disbursement failed.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const reloadSchedule = async () => {
    try {
      const sched = await getSchedule(loan.id);
      setSchedule(sched);
      setQuote(null);
    } catch (err) {
       console.error(err);
    }
  };

  const handleGetQuote = async () => {
    try {
      setProcessing(true);
      const data = await getPreclosureQuote(loan.id);
      setQuote(data);
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch settlement quote.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseLoan = async () => {
    if (!confirm("Are you sure you want to completely settle and close this loan?")) return;
    try {
      setProcessing(true);
      await closeLoan(loan.id);
      window.location.reload();
    } catch (err) {
      console.error(err);
      showToast("Failed to process loan closure.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusVariant = (s: string) => {
    switch(s) {
      case 'APPROVED': case 'ACTIVE': case 'CLOSED': return 'success';
      case 'REJECTED': return 'error';
      case 'KYC_PENDING': case 'PENDING': return 'warning';
      default: return 'info';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-grid">
        <div style={{ gridColumn: '1 / -1', marginBottom: 'var(--space-6)' }}>
          <SkeletonText lines={1} className="w-1/3 h-8" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="dashboard-empty">
        <h1 className="dashboard-header__title" style={{ marginBottom: 'var(--space-6)' }}>Dashboard</h1>
        <Card className="text-center py-12">
          <p className="text-secondary mb-6">You do not have any active loan applications.</p>
          <Button onClick={() => router.push("/apply")}>Apply Now</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* ── Header ─────────────────────────── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-header__title">Your Dashboard</h1>
          <button 
            onClick={() => downloadReport(loan.id, loan.loan_number)}
            className="dashboard-header__download"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download Report
          </button>
        </div>
        <Badge variant={getStatusVariant(loan.status)}>{loan.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="dashboard-grid">
        {/* ── Left Column: Summary ─────────── */}
        <div className="dashboard-col">
          <Card variant="elevated" className="h-full flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="label-caps mb-1">Loan Reference</p>
                  <p className="mono-number font-bold text-lg">{loan.loan_number}</p>
                </div>
                <div className="text-right">
                  <p className="label-caps mb-1">Created On</p>
                  <p className="font-medium text-sm text-secondary">{new Date(loan.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="dashboard-metrics-grid">
                <div className="metric-box">
                  <span className="label-caps">Requested</span>
                  <span className="metric-value mono-number">₹{loan.loan_amount.toLocaleString('en-IN')}</span>
                </div>
                {loan.approved_amount && (
                  <div className="metric-box">
                    <span className="label-caps">Approved</span>
                    <span className="metric-value metric-value--success mono-number">₹{loan.approved_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="metric-box">
                  <span className="label-caps">Tenure</span>
                  <span className="metric-value font-bold">{loan.tenure_months} MO</span>
                </div>
                {loan.interest_rate && (
                  <div className="metric-box">
                    <span className="label-caps">Interest</span>
                    <span className="metric-value metric-value--accent">{loan.interest_rate}% p.a.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Cards based on Status */}
            <div className="mt-6 pt-6 border-t border-surface-border">
              {(loan.status === "KYC_VERIFIED" || loan.status === "KYC_PENDING") && (
                <div className="action-panel action-panel--warning">
                  <h3 className="action-panel__title">Underwriting Required</h3>
                  <p className="action-panel__desc">Run our automated risk evaluation engine to proceed.</p>
                  <Button fullWidth onClick={handleRunUnderwriting} loading={processing}>Run Engine</Button>
                </div>
              )}

              {loan.status === "APPROVED" && (
                <div className="action-panel action-panel--success">
                  <h3 className="action-panel__title">Ready for Disbursement</h3>
                  <p className="action-panel__desc">Review and accept the Key Fact Statement (KFS) terms.</p>
                  <Button fullWidth variant="primary" onClick={() => setShowKFS(true)}>Review KFS</Button>
                </div>
              )}

              {loan.status === "REJECTED" && (
                <div className="action-panel action-panel--error">
                  <h3 className="action-panel__title">Application Rejected</h3>
                  <p className="action-panel__desc">{loan.rejection_reason}</p>
                </div>
              )}

              {loan.status === "ACTIVE" && (
                <div className="action-panel action-panel--info">
                  <div className="flex w-full justify-between items-start">
                    <div>
                      <h3 className="action-panel__title">Loan is Active</h3>
                      <p className="action-panel__desc mb-4">Disbursed on {new Date(loan.disbursed_at).toLocaleDateString('en-IN')}.</p>
                    </div>
                    <CreditCoin3D />
                  </div>
                  
                  {!quote ? (
                    <Button variant="secondary" size="sm" fullWidth onClick={handleGetQuote} loading={processing}>
                      Get Pre-closure Quote
                    </Button>
                  ) : (
                    <div className="quote-box animate-card-entrance">
                      <div className="quote-row">
                        <span>Principal</span>
                        <span className="mono-number font-bold">₹{quote.outstanding_principal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="quote-row">
                        <span>Fee (2%)</span>
                        <span className="mono-number font-bold border-b pb-1">₹{quote.preclosure_charge.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="quote-row quote-row--total mt-2 pt-2">
                        <span>Total Payable</span>
                        <span className="mono-number font-bold">₹{quote.total_payable.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="mt-4">
                        <Button fullWidth onClick={handleCloseLoan} loading={processing}>Confirm & Settle</Button>
                      </div>
                    </div>
                  )}

                  {/* Cooling-off */}
                  {loan.disbursed_at && (new Date().getTime() - new Date(loan.disbursed_at).getTime() <= 3 * 24 * 60 * 60 * 1000) && (
                    <div className="mt-4 text-center">
                      <button onClick={handleCloseLoan} disabled={processing} className="text-xs text-warning hover:underline font-medium">
                        Cancel Loan (Cooling-off)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right Column: Graphs & Audit ─── */}
        <div className="dashboard-col">
          <Card>
            {loan.credit_score ? (
              <CreditScoreGauge score={loan.credit_score} />
            ) : (
              <div className="h-48 flex items-center justify-center text-tertiary text-sm italic">
                Underwriting pending...
              </div>
            )}
          </Card>

          <Card>
             <AuditTrail entries={auditTrailLogs} />
          </Card>
        </div>
      </div>

      {/* ── Bottom Section: Schedule ──────── */}
      {loan.status === "ACTIVE" && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">EMI Schedule</h2>
          <Card padding="default">
            {loadingSchedule ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-surface-sunken rounded w-full" />
                <div className="h-8 bg-surface-sunken rounded w-full" />
                <div className="h-8 bg-surface-sunken rounded w-full" />
              </div>
            ) : (
              <EMIScheduleTable schedule={schedule} onPayEMI={async (id) => {/* simulate */ await new Promise(r=>setTimeout(r,800)); reloadSchedule();}} />
            )}
          </Card>
        </div>
      )}


      {/* ── Modal: KFS ────────────────────── */}
      {showKFS && (
        <div className="modal-overlay">
          <div className="modal-content animate-card-entrance">
            <div className="modal-header">
              <div>
                <h2 className="text-xl font-bold">Key Fact Statement</h2>
                <p className="text-xs text-tertiary">Standard RBI Format</p>
              </div>
              <button onClick={() => setShowKFS(false)} className="modal-close">×</button>
            </div>
            
            <div className="modal-body space-y-4">
              <div className="kfs-box">
                <h3 className="kfs-title">1. Loan Details</h3>
                <div className="kfs-grid">
                  <span>Loan Amount</span> <span className="font-mono text-right font-medium">₹{loan.approved_amount?.toLocaleString('en-IN')}</span>
                  <span>Tenure</span> <span className="text-right font-medium">{loan.tenure_months} Months</span>
                  <span>Interest Rate</span> <span className="text-right font-medium">{loan.interest_rate}% p.a.</span>
                  <span>Processing Fee</span> <span className="font-mono text-right font-medium">₹0</span>
                  <span className="font-bold mt-2">Net Disbursed</span> <span className="font-mono font-bold text-success text-right mt-2">₹{loan.approved_amount?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="kfs-box">
                <h3 className="kfs-title">2. Penalties & Recovery</h3>
                <ul className="kfs-list">
                  <li>Late Payment: 2% of overdue EMI amount per month.</li>
                  <li>Pre-closure Charge: 2% on outstanding principal.</li>
                </ul>
              </div>

              <div className="kfs-box">
                <h3 className="kfs-title">3. Cooling-off Period</h3>
                <p className="text-sm text-secondary">Cancel within 3 days without penalty.</p>
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setShowKFS(false)}>Cancel</Button>
              <Button variant="primary" loading={processing} onClick={() => { setShowKFS(false); handleDisburse(); }}>I Accept KFS</Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .text-secondary { color: var(--text-secondary); }
        .text-tertiary { color: var(--text-tertiary); }
        .text-success { color: var(--color-success); }
        .text-warning { color: var(--color-warning); }
        .bg-surface-sunken { background: var(--surface-sunken); }

        .dashboard-container {
          max-width: 1000px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-8);
        }
        .dashboard-header__title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 700;
          line-height: 1.2;
        }
        .dashboard-header__download {
          display: inline-flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-accent);
          background: none;
          border: none;
          cursor: pointer;
          margin-top: var(--space-2);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .dashboard-header__download:hover {
          text-decoration: underline;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 3fr 2fr;
          gap: var(--space-6);
        }

        .dashboard-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .dashboard-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        .metric-box {
          background: var(--surface-base);
          padding: var(--space-4);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
        }
        .metric-value {
          margin-top: var(--space-1);
          font-size: var(--text-xl);
          color: var(--text-primary);
        }
        .metric-value--success { color: var(--color-success); }
        .metric-value--accent { color: var(--text-accent); font-family: var(--font-display); font-weight: 700; }

        .action-panel {
          padding: var(--space-4);
          border-radius: var(--radius-lg);
          border: 1px solid var(--surface-border);
          background: var(--surface-base);
        }
        .action-panel--warning { border-left: 3px solid var(--color-warning); }
        .action-panel--success { border-left: 3px solid var(--color-success); }
        .action-panel--error { border-left: 3px solid var(--color-error); }
        .action-panel--info { border-left: 3px solid var(--text-accent); }
        
        .action-panel__title {
          font-size: var(--text-sm);
          font-weight: 600;
          color: var(--text-primary);
        }
        .action-panel__desc {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin-top: 2px;
          margin-bottom: var(--space-4);
        }

        .quote-box {
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
          padding: var(--space-4);
        }
        .quote-row {
          display: flex;
          justify-content: space-between;
          font-size: var(--text-sm);
          color: var(--text-secondary);
          padding: 2px 0;
        }
        .quote-row--total {
          color: var(--text-primary);
          border-top: 1px dotted var(--surface-border);
        }

        /* ── Modal ───────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
        }
        .modal-content {
          background: var(--surface-raised);
          width: 100%;
          max-width: 600px;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-lg);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--surface-border);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-close {
          background: none;
          border: none;
          color: var(--text-tertiary);
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
        }
        .modal-body {
          padding: var(--space-6);
          overflow-y: auto;
        }
        .kfs-box {
          background: var(--surface-base);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
        }
        .kfs-title {
          font-size: var(--text-sm);
          font-weight: 600;
          margin-bottom: var(--space-3);
          color: var(--text-primary);
          border-bottom: 1px solid var(--surface-border);
          padding-bottom: var(--space-2);
        }
        .kfs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
        }
        .kfs-list {
          list-style: disc;
          padding-left: var(--space-5);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          line-height: 1.6;
        }
        .modal-footer {
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--surface-border);
          background: var(--surface-base);
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          border-radius: 0 0 var(--radius-xl) var(--radius-xl);
        }

        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
