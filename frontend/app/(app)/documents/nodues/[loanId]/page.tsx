'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loanAPI } from '@/lib/api';

export default function NoDuesCertificatePage() {
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

      <div className="seal">✓</div>

      <h2 className="doc-title">No-Dues Certificate</h2>
      <p className="doc-meta">Certificate No: NDC-{loan.loan_number} · Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <div className="certificate-body">
        <p>This is to certify that the personal loan bearing reference number <strong>{loan.loan_number}</strong>, sanctioned for an amount of <strong>₹{(loan.approved_amount || loan.loan_amount)?.toLocaleString('en-IN')}</strong>, has been fully repaid and closed.</p>

        <p>All outstanding dues including principal, interest, and any applicable charges have been settled in full. The total amount paid over the loan tenure was <strong>₹{(loan.total_paid || 0)?.toLocaleString('en-IN')}</strong>.</p>

        <p>As of the date of this certificate, the borrower has <strong>no pending obligations</strong> towards NexLoan in connection with the aforementioned loan.</p>

        <p>This certificate is issued at the request of the borrower for records and future reference.</p>
      </div>

      <div className="details-box">
        <div className="detail-row"><span>Loan Number</span><span>{loan.loan_number}</span></div>
        <div className="detail-row"><span>Sanctioned Amount</span><span>₹{(loan.approved_amount || loan.loan_amount)?.toLocaleString('en-IN')}</span></div>
        <div className="detail-row"><span>Total Paid</span><span>₹{(loan.total_paid || 0)?.toLocaleString('en-IN')}</span></div>
        <div className="detail-row"><span>Closure Date</span><span>{loan.closed_at ? new Date(loan.closed_at).toLocaleDateString('en-IN') : 'N/A'}</span></div>
        <div className="detail-row"><span>Status</span><span style={{ color: '#16a34a', fontWeight: 700 }}>CLOSED — NO DUES</span></div>
      </div>

      <div className="sign-block">
        <p><strong>Authorized Signatory</strong></p>
        <p className="sub-sign">NexLoan Credit Operations</p>
        <p className="sub-sign">Digitally generated — valid without wet signature</p>
      </div>

      <div className="footer">
        <p>NexLoan — A Theoremlabs Product · CIN: U00000MH2026PTC000000</p>
      </div>

      <style jsx>{`
        .print-doc { max-width: 700px; margin: 40px auto; padding: 40px; font-family: 'Inter', 'Segoe UI', sans-serif; color: #1a1a1a; }
        .letterhead { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #7c3aed; }
        .brand { font-size: 28px; font-weight: 800; color: #7c3aed; margin: 0; }
        .tagline { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.12em; margin: 4px 0 0; }
        .seal { width: 60px; height: 60px; border-radius: 50%; border: 3px solid #16a34a; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #16a34a; margin: 24px auto 16px; }
        .doc-title { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 8px; }
        .doc-meta { font-size: 12px; color: #888; text-align: center; margin-bottom: 32px; }
        .certificate-body { line-height: 1.8; font-size: 13px; color: #333; margin-bottom: 24px; }
        .certificate-body p { margin-bottom: 12px; }
        .details-box { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-bottom: 32px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row span:first-child { color: #666; font-weight: 500; }
        .detail-row span:last-child { font-family: 'JetBrains Mono', monospace; }
        .sign-block { margin-top: 40px; }
        .sub-sign { font-size: 10px; color: #aaa; margin-top: 2px; }
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
