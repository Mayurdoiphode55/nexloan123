'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loanAPI } from '@/lib/api';

export default function KFSPage() {
  const params = useParams();
  const loanId = params.loanId as string;
  const [loan, setLoan] = useState<any>(null);

  useEffect(() => {
    loanAPI.getLoan(loanId).then(r => setLoan(r.data)).catch(() => {});
  }, [loanId]);

  if (!loan) return <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>;

  return (
    <div className="print-doc">
      <div className="letterhead">
        <h1 className="brand">NexLoan</h1>
        <p className="tagline">Powered by Theoremlabs</p>
      </div>
      <h2 className="doc-title">Key Fact Statement (KFS)</h2>
      <p className="doc-meta">Loan Reference: {loan.loan_number} · Generated: {new Date().toLocaleDateString('en-IN')}</p>

      <table className="kfs-table">
        <tbody>
          <tr><td className="kfs-label">Borrower</td><td>{loan.user_id}</td></tr>
          <tr><td className="kfs-label">Loan Amount</td><td>₹{loan.loan_amount?.toLocaleString('en-IN')}</td></tr>
          <tr><td className="kfs-label">Approved Amount</td><td>₹{(loan.approved_amount || loan.loan_amount)?.toLocaleString('en-IN')}</td></tr>
          <tr><td className="kfs-label">Interest Rate</td><td>{loan.interest_rate}% per annum (reducing)</td></tr>
          <tr><td className="kfs-label">Tenure</td><td>{loan.tenure_months} months</td></tr>
          <tr><td className="kfs-label">EMI Amount</td><td>₹{loan.emi_amount?.toLocaleString('en-IN')}</td></tr>
          <tr><td className="kfs-label">Purpose</td><td>{loan.purpose}</td></tr>
          <tr><td className="kfs-label">Processing Fee</td><td>₹0 (Zero)</td></tr>
          <tr><td className="kfs-label">Prepayment Charges</td><td>Nil after 6 months</td></tr>
          <tr><td className="kfs-label">Penal Charges</td><td>2% per month on overdue EMI</td></tr>
          <tr><td className="kfs-label">Cooling-Off Period</td><td>7 days from disbursement</td></tr>
        </tbody>
      </table>

      <div className="disclaimer">
        <p><strong>Important:</strong> This is an indicative Key Fact Statement as per RBI guidelines. Actual terms may vary based on final credit assessment. The borrower acknowledges reading and understanding all terms herein.</p>
      </div>

      <div className="footer">
        <p>NexLoan — A Theoremlabs Product · CIN: U00000MH2026PTC000000</p>
        <p>This document was generated digitally and is valid without signature.</p>
      </div>

      <style jsx>{`
        .print-doc { max-width: 700px; margin: 40px auto; padding: 40px; font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #7c3aed; }
        .brand { font-size: 28px; font-weight: 800; color: #7c3aed; margin: 0; }
        .tagline { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.12em; margin: 4px 0 0; }
        .doc-title { font-size: 18px; font-weight: 600; margin: 24px 0 8px; }
        .doc-meta { font-size: 12px; color: #888; margin-bottom: 24px; }
        .kfs-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .kfs-table td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 13px; }
        .kfs-label { font-weight: 600; color: #555; width: 40%; }
        .disclaimer { padding: 16px; background: #f9f9f9; border-radius: 8px; font-size: 11px; color: #666; line-height: 1.6; margin-bottom: 32px; }
        .footer { text-align: center; font-size: 10px; color: #aaa; padding-top: 16px; border-top: 1px solid #eee; }
        @media print {
          body { background: white; }
          .print-doc { margin: 0; padding: 1cm; max-width: none; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
