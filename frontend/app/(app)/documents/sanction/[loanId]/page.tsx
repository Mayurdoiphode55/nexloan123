'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loanAPI } from '@/lib/api';

export default function SanctionLetterPage() {
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

      <div className="date-line">Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>

      <h2 className="doc-title">Sanction Letter</h2>
      <p className="doc-ref">Ref: {loan.loan_number}</p>

      <p className="body-text">Dear Borrower,</p>
      <p className="body-text">
        We are pleased to inform you that your personal loan application bearing reference number <strong>{loan.loan_number}</strong> has been approved subject to the following terms and conditions:
      </p>

      <table className="sanction-table">
        <tbody>
          <tr><td>Sanctioned Amount</td><td className="val">₹{(loan.approved_amount || loan.loan_amount)?.toLocaleString('en-IN')}</td></tr>
          <tr><td>Rate of Interest</td><td className="val">{loan.interest_rate}% p.a. (reducing balance)</td></tr>
          <tr><td>Loan Tenure</td><td className="val">{loan.tenure_months} months</td></tr>
          <tr><td>EMI Amount</td><td className="val">₹{loan.emi_amount?.toLocaleString('en-IN')}</td></tr>
          <tr><td>Purpose</td><td className="val">{loan.purpose}</td></tr>
          <tr><td>Disbursement Mode</td><td className="val">Direct bank transfer (NEFT/IMPS)</td></tr>
        </tbody>
      </table>

      <p className="body-text">
        This sanction is valid for 30 days from the date of this letter. The borrower is required to accept the terms and provide bank account details for disbursement within this period.
      </p>

      <p className="body-text">We wish you a pleasant experience with NexLoan.</p>

      <div className="sign-block">
        <p><strong>NexLoan Credit Team</strong></p>
        <p className="sub-sign">Digitally generated — valid without wet signature</p>
      </div>

      <div className="footer">
        <p>NexLoan — A Theoremlabs Product · CIN: U00000MH2026PTC000000</p>
      </div>

      <style jsx>{`
        .print-doc { max-width: 700px; margin: 40px auto; padding: 40px; font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #7c3aed; }
        .brand { font-size: 28px; font-weight: 800; color: #7c3aed; margin: 0; }
        .tagline { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.12em; margin: 4px 0 0; }
        .date-line { text-align: right; font-size: 12px; color: #666; margin-bottom: 24px; }
        .doc-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
        .doc-ref { font-size: 12px; color: #888; margin-bottom: 24px; font-family: monospace; }
        .body-text { font-size: 13px; line-height: 1.8; color: #333; margin-bottom: 12px; }
        .sanction-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .sanction-table td { padding: 10px 14px; border: 1px solid #e5e5e5; font-size: 13px; }
        .sanction-table td:first-child { font-weight: 600; color: #555; width: 40%; background: #fafafa; }
        .val { font-family: 'JetBrains Mono', monospace; }
        .sign-block { margin-top: 40px; }
        .sub-sign { font-size: 10px; color: #aaa; margin-top: 4px; }
        .footer { text-align: center; font-size: 10px; color: #aaa; padding-top: 16px; border-top: 1px solid #eee; margin-top: 32px; }
        @media print {
          body { background: white; }
          .print-doc { margin: 0; padding: 1cm; max-width: none; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
