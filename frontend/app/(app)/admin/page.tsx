"use client";

import React, { useEffect, useState } from "react";
import { adminAPI, supportAPI } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { SkeletonCard, SkeletonText } from "@/components/SkeletonLoader";

interface KYCQueueItem {
  loan_id: string;
  loan_number: string;
  applicant_name: string;
  applicant_email: string;
  loan_amount: number;
  tenure_months: number;
  purpose: string | null;
  created_at: string;
  pan_doc_url: string | null;
  pan_name_extracted: string | null;
  pan_legible: boolean | null;
  aadhaar_doc_url: string | null;
  aadhaar_name_extracted: string | null;
  aadhaar_legible: boolean | null;
  aadhaar_photo_present: boolean | null;
  ai_verdict: string | null;
  ai_remarks: string | null;
  ai_raw_response: any;
}

import type { AdminMetrics } from "@/types/loan";

interface CallbackRequest {
  id: string;
  user_id: string;
  loan_id: string | null;
  phone_number: string;
  preferred_slot: string;
  slot_label: string;
  status: string;
  created_at: string;
  user_name: string;
  user_email: string;
  reason: string;
}

interface SupportTicketItem {
  id: string;
  user_id: string;
  loan_id: string | null;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string | null;
}

export default function AdminPage() {
  const [queue, setQueue] = useState<KYCQueueItem[]>([]);
  const [analytics, setAnalytics] = useState<AdminMetrics | null>(null);
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [processingMap, setProcessingMap] = useState<Record<string, string>>({});
  const { showToast } = useToast();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueData, analyticsData, callbackData, ticketsData] = await Promise.all([
        adminAPI.getKYCQueue(),
        adminAPI.getMetrics(),
        adminAPI.getCallbackRequests().catch(() => ({ data: [] })),
        supportAPI.listTickets().catch(() => ({ data: [] })),
      ]);
      setQueue(queueData.data || []);
      setAnalytics(analyticsData.data as any);
      setCallbacks(callbackData.data || []);
      setTickets(ticketsData.data || []);
    } catch (err: unknown) {
      console.error("Failed to load admin data", err);
      setError("Failed to load dashboard data. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApprove = async (loanId: string, loanNumber: string) => {
    try {
      setProcessingMap((prev) => ({ ...prev, [loanId]: "approving" }));
      await adminAPI.approveKYC(loanId);
      showToast(`✅ ${loanNumber} approved — ready for underwriting`, "success");
      setQueue((prev) => prev.filter((item) => item.loan_id !== loanId));
    } catch (err) {
      console.error(err);
      showToast(`Failed to approve ${loanNumber}`, "error");
    } finally {
      setProcessingMap((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const handleReject = async (loanId: string, loanNumber: string) => {
    if (!confirm(`Are you sure you want to reject KYC for ${loanNumber}? This cannot be undone.`)) return;
    try {
      setProcessingMap((prev) => ({ ...prev, [loanId]: "rejecting" }));
      await adminAPI.rejectKYC(loanId);
      showToast(`❌ ${loanNumber} rejected`, "error");
      setQueue((prev) => prev.filter((item) => item.loan_id !== loanId));
    } catch (err) {
      console.error(err);
      showToast(`Failed to reject ${loanNumber}`, "error");
    } finally {
      setProcessingMap((prev) => {
        const next = { ...prev };
        delete next[loanId];
        return next;
      });
    }
  };

  const toggleExpand = (loanId: string) => {
    setExpandedLoan((prev) => (prev === loanId ? null : loanId));
  };

  return (
    <div className="admin-container">
      {/* ── Header ─────────────────────────── */}
      <div className="admin-header">
        <div>
          <h1 className="admin-header__title">Admin Panel</h1>
          <p className="admin-header__subtitle">Internal Platform Management</p>
        </div>
        <div className="admin-header__actions">
          <Badge variant="accent">{queue.length} Pending KYC</Badge>
          <Button variant="ghost" size="sm" onClick={fetchDashboardData} disabled={loading}>
            ↻ Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert--error">{error}</div>
      )}

      {/* ── Analytics ──────────────────────── */}
      {!loading && analytics && (
        <div className="admin-section">
          <h2 className="admin-section__title">Platform Overview</h2>
          <div className="analytics-grid">
            <Card>
              <span className="analytics-label">Total Loans</span>
              <span className="analytics-value mono-number text-primary">{analytics.total_loans}</span>
            </Card>
            <Card>
              <span className="analytics-label">Approval Rate</span>
              <span className="analytics-value mono-number text-success">{analytics.approval_rate}%</span>
            </Card>
            <Card>
              <span className="analytics-label">Total Revenue</span>
              <span className="analytics-value mono-number text-accent">₹{analytics.total_revenue.toLocaleString('en-IN')}</span>
            </Card>
            <Card>
              <span className="analytics-label">Active Loans</span>
              <span className="analytics-value mono-number text-info">{analytics.status_breakdown["ACTIVE"] || 0}</span>
            </Card>
          </div>

          <Card variant="elevated" className="mt-6">
            <span className="analytics-label mb-4 block">Status Breakdown</span>
            <div className="status-bar">
              {Object.entries(analytics.status_breakdown).map(([status, count]) => {
                const percentage = (count / analytics.total_loans) * 100;
                if (percentage === 0) return null;
                return (
                  <div 
                    key={status} 
                    className={`status-segment status-segment--${status}`}
                    style={{ width: `${percentage}%` }}
                    title={`${status}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="status-legend">
              {Object.entries(analytics.status_breakdown).map(([status, count]) => (
                <div key={status} className="status-legend__item">
                  <span className={`status-legend__dot status-segment--${status}`} />
                  {status} <span className="text-tertiary">({count})</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {loading && (
        <div className="analytics-grid mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* ── KYC Queue ──────────────────────── */}
      <div className="admin-section">
        <h2 className="admin-section__title">KYC Review Queue</h2>

        {!loading && !error && queue.length === 0 && (
          <Card className="text-center py-12">
             <div className="text-4xl mb-4 text-success">✓</div>
             <p className="font-bold text-lg">All Clear!</p>
             <p className="text-secondary text-sm">No loans pending manual review.</p>
          </Card>
        )}

        {loading && (
          <div className="space-y-4">
             <SkeletonCard />
             <SkeletonCard />
          </div>
        )}

        {!loading && queue.length > 0 && (
          <div className="queue-list">
            {queue.map((item) => {
              const isExpanded = expandedLoan === item.loan_id;
              const processing = processingMap[item.loan_id];

              return (
                <Card key={item.loan_id} className="queue-item" padding="md" variant={isExpanded ? "elevated" : "default"}>
                  <div className="queue-item__header">
                    <div className="queue-item__info cursor-pointer" onClick={() => toggleExpand(item.loan_id)}>
                      <div className="flex items-center gap-3">
                        <h3 className="queue-item__name">{item.applicant_name}</h3>
                        <Badge variant="warning">KYC PENDING</Badge>
                      </div>
                      <div className="queue-item__meta">
                        <span className="mono-number text-accent font-bold">{item.loan_number}</span>
                        <span>•</span>
                        <span>₹{item.loan_amount.toLocaleString('en-IN')}</span>
                        <span>•</span>
                        <span>{item.tenure_months}mo</span>
                        <span>•</span>
                        <span>{item.applicant_email}</span>
                      </div>
                      <div className="queue-item__ai">
                        <Badge variant={item.ai_verdict === "FAIL" ? "error" : "accent"}>
                          AI: {item.ai_verdict || "N/A"}
                        </Badge>
                        {item.ai_remarks && <span className="text-tertiary text-xs italic">"{item.ai_remarks}"</span>}
                      </div>
                    </div>

                    <div className="queue-item__actions">
                      <Button variant="ghost" size="sm" onClick={() => toggleExpand(item.loan_id)}>
                        {isExpanded ? "▲ Hide" : "▼ Review"}
                      </Button>
                      <Button 
                        size="sm" 
                        loading={processing === "approving"} 
                        disabled={!!processing}
                        onClick={() => handleApprove(item.loan_id, item.loan_number)}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        loading={processing === "rejecting"} 
                        disabled={!!processing}
                        onClick={() => handleReject(item.loan_id, item.loan_number)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="queue-item__body animate-card-entrance">
                      <h4 className="label-caps mb-4">Document Analysis</h4>
                      
                      <div className="queue-docs">
                        {/* PAN */}
                        <div className="queue-doc bg-surface-sunken p-4 rounded-xl">
                           <div className="flex justify-between items-center mb-3">
                             <span className="font-bold text-sm">PAN Card</span>
                             {item.pan_legible !== null && (
                               <Badge variant={item.pan_legible ? "success" : "error"}>{item.pan_legible ? "Legible" : "Not Legible"}</Badge>
                             )}
                           </div>
                           {item.pan_doc_url ? (
                             <img src={item.pan_doc_url} alt="PAN" className="queue-doc__img" />
                           ) : (
                             <div className="queue-doc__img queue-doc__img--empty">No PAN</div>
                           )}
                           <div className="mt-3 text-xs">
                             <span className="text-secondary">Extracted:</span> <span className="font-bold">{item.pan_name_extracted || "Wait..."}</span>
                           </div>
                        </div>

                        {/* Aadhaar */}
                        <div className="queue-doc bg-surface-sunken p-4 rounded-xl">
                           <div className="flex justify-between items-center mb-3">
                             <span className="font-bold text-sm">Aadhaar</span>
                             <div className="flex gap-2">
                               {item.aadhaar_legible !== null && (
                                 <Badge variant={item.aadhaar_legible ? "success" : "error"}>{item.aadhaar_legible ? "Legible" : "Not Legible"}</Badge>
                               )}
                               {item.aadhaar_photo_present !== null && (
                                 <Badge variant={item.aadhaar_photo_present ? "info" : "neutral"}>{item.aadhaar_photo_present ? "Photo ✓" : "No Photo"}</Badge>
                               )}
                             </div>
                           </div>
                           {item.aadhaar_doc_url ? (
                             <img src={item.aadhaar_doc_url} alt="Aadhaar" className="queue-doc__img" />
                           ) : (
                             <div className="queue-doc__img queue-doc__img--empty">No Aadhaar</div>
                           )}
                           <div className="mt-3 text-xs">
                             <span className="text-secondary">Extracted:</span> <span className="font-bold">{item.aadhaar_name_extracted || "Wait..."}</span>
                           </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-surface-border">
                        <h4 className="label-caps mb-3 text-accent flex items-center gap-2">
                          <span className="text-xl">🤖</span> Detailed AI Analysis
                        </h4>
                        
                        {item.ai_raw_response ? (
                          <div className="space-y-6">
                            {/* Narrative Report Wrapper */}
                            <div className="bg-surface-sunken p-1">
                              <div className="px-4 py-2 bg-surface-base/50 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-tertiary">AI Auditor Narrative Report</span>
                                <Badge variant={item.ai_verdict === "PASS" ? "success" : "error"}>
                                  {item.ai_verdict || "REVIEW"}
                                </Badge>
                              </div>
                              <div className="p-6">
                                <div className="prose prose-invert max-w-none text-secondary text-sm leading-relaxed">
                                  {/* Renders the markdown-like narrative reason */}
                                  <div className="whitespace-pre-wrap font-medium text-base text-primary mb-4">
                                    {(item.ai_remarks || item.ai_raw_response?.reason || "Analysis complete. Waiting for manual validation.")
                                      .split('\n').map((line: string, i: number) => (
                                        <p key={i} className={line.startsWith('###') ? 'text-lg font-bold text-accent mt-2 mb-1' : 'mb-2'}>
                                          {line.replace('###', '').replace(/\*\*/g, '')}
                                        </p>
                                      ))
                                    }
                                  </div>
                                  
                                  <div className="mt-6 pt-6 border-t border-surface-border grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold uppercase text-tertiary">Extraction Audit</p>
                                      <ul className="space-y-1 text-xs list-none p-0">
                                        <li className="flex justify-between">
                                           <span>Document Type:</span>
                                           <span className="font-bold text-accent">{item.pan_doc_url ? "PAN" : "Card"} + Aadhaar</span>
                                        </li>
                                        <li className="flex justify-between">
                                           <span>Name on Card:</span>
                                           <span className="font-bold text-info">{item.pan_name_extracted || item.aadhaar_name_extracted || "Unreadable"}</span>
                                        </li>
                                        <li className="flex justify-between">
                                           <span>Applicant Name:</span>
                                           <span className="font-bold">{item.applicant_name}</span>
                                        </li>
                                      </ul>
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold uppercase text-tertiary">System Logic</p>
                                      <p className="text-[11px] italic text-tertiary">
                                        Using LayoutLMv3 Document Understanding. 
                                        {item.ai_raw_response?.name_match === false 
                                          ? " Logic flagged a fundamental mismatch between applicant profile and extracted document strings." 
                                          : " Logic confirmed structural and lexical match across provided documentation."}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-4 bg-surface-sunken rounded-lg text-tertiary italic text-sm">
                            Extended AI metrics not available for this record.
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-surface-border">
                        <h4 className="label-caps mb-3">Application Details</h4>
                        <div className="queue-details">
                          <div><span className="text-tertiary text-xs block">Amount</span> <span className="font-bold">₹{item.loan_amount.toLocaleString('en-IN')}</span></div>
                          <div><span className="text-tertiary text-xs block">Tenure</span> <span className="font-bold">{item.tenure_months} MO</span></div>
                          <div><span className="text-tertiary text-xs block">Purpose</span> <span className="font-bold">{item.purpose || "N/A"}</span></div>
                          <div><span className="text-tertiary text-xs block">Applied</span> <span className="font-bold">{new Date(item.created_at).toLocaleDateString('en-IN')}</span></div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Callback Requests ──────────────── */}
      <div className="admin-section">
        <h2 className="admin-section__title">📞 Callback Requests</h2>

        {!loading && callbacks.length === 0 && (
          <Card className="text-center py-8">
            <p className="text-secondary text-sm">No callback requests at this time.</p>
          </Card>
        )}

        {!loading && callbacks.length > 0 && (
          <div className="callback-list">
            {callbacks.map((cb) => (
              <Card key={cb.id} padding="md" className="callback-item">
                <div className="callback-item__row">
                  <div className="callback-item__info">
                    <div className="callback-item__name">{cb.user_name}</div>
                    <div className="callback-item__meta">
                      <span>📧 {cb.user_email}</span>
                      <span>•</span>
                      <span className="font-bold">📱 {cb.phone_number}</span>
                    </div>
                    <div className="callback-item__meta" style={{ marginTop: '4px' }}>
                      <Badge variant="accent">🕐 {cb.slot_label}</Badge>
                      <Badge variant={cb.status === 'pending' ? 'warning' : 'success'}>
                        {cb.status.toUpperCase()}
                      </Badge>
                      <span className="text-tertiary text-xs">
                        {new Date(cb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {cb.reason && (
                      <div style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', borderLeft: '3px solid var(--accent-400)' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'block', marginBottom: '2px' }}>Reason</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{cb.reason}</span>
                      </div>
                    )}
                  </div>
                  <div className="callback-item__actions">
                    {cb.status === 'pending' ? (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await adminAPI.updateCallbackStatus(cb.id, 'completed');
                            setCallbacks((prev) => prev.map((c) =>
                              c.id === cb.id ? { ...c, status: 'completed' } : c
                            ));
                            showToast('Callback marked as done', 'success');
                          } catch {
                            showToast('Failed to update', 'error');
                          }
                        }}
                      >
                        ✓ Mark Done
                      </Button>
                    ) : (
                      <Badge variant="success">✓ Completed</Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Support Tickets ──────────────── */}
      <div className="admin-section">
        <h2 className="admin-section__title">🎫 Support Tickets</h2>

        {!loading && tickets.length === 0 && (
          <Card className="text-center py-8">
            <p className="text-secondary text-sm">No support tickets raised.</p>
          </Card>
        )}

        {!loading && tickets.length > 0 && (
          <div className="callback-list">
            {tickets.map((t) => {
              const statusColor = t.status === 'OPEN' ? 'warning'
                : t.status === 'IN_PROGRESS' ? 'info'
                : t.status === 'RESOLVED' ? 'success'
                : 'neutral';
              return (
                <Card key={t.id} padding="md">
                  <div className="callback-item__row">
                    <div className="callback-item__info">
                      <div className="callback-item__name">{t.subject}</div>
                      <div className="callback-item__meta">
                        <Badge variant={statusColor as 'success' | 'warning' | 'info' | 'neutral'}>{t.status.replace('_', ' ')}</Badge>
                        <Badge variant="neutral">{t.priority}</Badge>
                        <span className="text-tertiary text-xs">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="callback-item__actions" style={{ display: 'flex', gap: '8px' }}>
                      {t.status === 'OPEN' && (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          try {
                            await supportAPI.updateStatus(t.id, 'IN_PROGRESS');
                            setTickets(prev => prev.map(x => x.id === t.id ? { ...x, status: 'IN_PROGRESS' } : x));
                            showToast('Ticket marked in progress', 'success');
                          } catch { showToast('Failed', 'error'); }
                        }}>▶ In Progress</Button>
                      )}
                      {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                        <Button size="sm" onClick={async () => {
                          try {
                            await supportAPI.updateStatus(t.id, 'RESOLVED');
                            setTickets(prev => prev.map(x => x.id === t.id ? { ...x, status: 'RESOLVED' } : x));
                            showToast('Ticket resolved', 'success');
                          } catch { showToast('Failed', 'error'); }
                        }}>✓ Resolve</Button>
                      )}
                      {t.status === 'RESOLVED' && (
                        <Badge variant="success">✓ Resolved</Badge>
                      )}
                      {t.status === 'CLOSED' && (
                        <Badge variant="neutral">Closed</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .text-primary { color: var(--text-primary); }
        .text-secondary { color: var(--text-secondary); }
        .text-tertiary { color: var(--text-tertiary); }
        .text-success { color: var(--color-success); }
        .text-accent { color: var(--text-accent); }
        .text-info { color: var(--color-info); }
        .bg-surface-sunken { background: var(--surface-sunken); }

        .admin-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: var(--space-8);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--surface-border);
        }
        .admin-header__title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 700;
        }
        .admin-header__subtitle {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-1);
        }
        .admin-header__actions {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .admin-alert {
          padding: var(--space-4);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-6);
        }
        .admin-alert--error {
          background: rgba(239, 68, 68, 0.1);
          color: var(--color-error);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .admin-section {
          margin-bottom: var(--space-10);
        }
        .admin-section__title {
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 600;
          margin-bottom: var(--space-6);
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }
        .analytics-label {
          display: block;
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .analytics-value {
          display: block;
          font-size: var(--text-4xl);
          font-weight: 700;
          margin-top: var(--space-2);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-bar {
          display: flex;
          height: 12px;
          border-radius: var(--radius-full);
          overflow: hidden;
          background: var(--surface-sunken);
          margin-bottom: var(--space-4);
        }
        .status-segment { transition: width var(--transition-base); }
        .status-segment--ACTIVE, .status-segment--DISBURSED { background: var(--color-info); }
        .status-segment--APPROVED { background: var(--color-success); }
        .status-segment--REJECTED { background: var(--color-error); }
        .status-segment--INQUIRY, .status-segment--APPLICATION { background: var(--accent-400); }
        .status-segment--KYC_PENDING, .status-segment--KYC_VERIFIED { background: var(--color-warning); }
        .status-segment--CLOSED, .status-segment--PRE_CLOSED { background: #14b8a6; }

        .status-legend {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-4);
          font-size: var(--text-xs);
          font-weight: 500;
        }
        .status-legend__item {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }
        .status-legend__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .queue-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .queue-item__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
        }
        .queue-item__name {
          font-size: var(--text-lg);
          font-weight: 700;
        }
        .queue-item__meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-1);
        }
        .queue-item__ai {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .queue-item__actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .queue-item__body {
          margin-top: var(--space-4);
          padding-top: var(--space-4);
          border-top: 1px solid var(--surface-border);
        }
        .queue-docs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        .queue-doc__img {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: var(--radius-md);
          background: #000;
        }
        .queue-doc__img--empty {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-base);
          color: var(--text-tertiary);
          font-size: var(--text-sm);
        }
        .queue-details {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4);
          font-size: var(--text-sm);
        }

        @media (max-width: 768px) {
          .admin-header { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
          .queue-item__header { flex-direction: column; }
          .queue-item__actions { width: 100%; justify-content: stretch; }
          .queue-docs { grid-template-columns: 1fr; }
          .queue-details { grid-template-columns: 1fr 1fr; }
        }

        .callback-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }
        .callback-item__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
        }
        .callback-item__name {
          font-weight: 700;
          font-size: var(--text-base);
        }
        .callback-item__meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-2);
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin-top: var(--space-1);
        }
        .callback-item__actions {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
