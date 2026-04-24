'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loanAPI, servicingAPI } from '@/lib/api';

export default function EMISchedulePrintPage() {
  const params = useParams();
  const loanId = params.loanId as string;
  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    loanAPI.getLoan(loanId).then(r => setLoan(r.data)).catch(() => {});
    servicingAPI.getSchedule(loanId).then(r => setSchedule(r.data)).catch(() => {});
  }, [loanId]);

  if (!loan) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

  return (
    <div className="print-doc">
      <div className="letterhead">
        <h1 className="brand">NexLoan</h1>
        <p className="tagline">Powered by Theoremlabs</p>
      </div>
      <h2 className="doc-title">EMI Schedule</h2>
      <p className="doc-meta">Loan: {loan.loan_number} · Rate: {loan.interest_rate}% p.a. · Tenure: {loan.tenure_months} months</p>

      <table className="schedule-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Due Date</th>
            <th>EMI (₹)</th>
            <th>Principal (₹)</th>
            <th>Interest (₹)</th>
            <th>Balance (₹)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map(row => (
            <tr key={row.installment_no} className={row.status === 'PAID' ? 'paid-row' : ''}>
              <td>{row.installment_no}</td>
              <td>{new Date(row.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td>{Math.round(row.emi_amount).toLocaleString('en-IN')}</td>
              <td>{Math.round(row.principal).toLocaleString('en-IN')}</td>
              <td>{Math.round(row.interest).toLocaleString('en-IN')}</td>
              <td>{Math.round(row.outstanding_balance).toLocaleString('en-IN')}</td>
              <td className={`status-${row.status.toLowerCase()}`}>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="footer">
        <p>NexLoan — A Theoremlabs Product · Generated: {new Date().toLocaleDateString('en-IN')}</p>
        <p>This document was generated digitally and is valid without signature.</p>
      </div>

      <style jsx>{`
        .print-doc { max-width: 800px; margin: 40px auto; padding: 40px; font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #7c3aed; }
        .brand { font-size: 28px; font-weight: 800; color: #7c3aed; margin: 0; }
        .tagline { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.12em; margin: 4px 0 0; }
        .doc-title { font-size: 18px; font-weight: 600; margin: 24px 0 4px; }
        .doc-meta { font-size: 12px; color: #888; margin-bottom: 20px; }
        .schedule-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .schedule-table th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-weight: 600; color: #555; border-bottom: 2px solid #ddd; }
        .schedule-table td { padding: 6px; border-bottom: 1px solid #eee; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
        .paid-row { background: #f0fdf4; }
        .status-paid { color: #16a34a; font-weight: 600; }
        .status-pending { color: #eab308; }
        .status-overdue { color: #dc2626; font-weight: 600; }
        .footer { text-align: center; font-size: 10px; color: #aaa; padding-top: 16px; border-top: 1px solid #eee; margin-top: 24px; }
        @media print {
          body { background: white; }
          .print-doc { margin: 0; padding: 0.5cm; max-width: none; }
          .schedule-table { font-size: 9px; }
          .schedule-table td { padding: 4px; }
          @page { margin: 0.8cm; }
        }
      `}</style>
    </div>
  );
}
