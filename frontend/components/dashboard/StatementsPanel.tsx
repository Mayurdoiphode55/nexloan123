'use client';

import { useState } from 'react';
import { statementsAPI } from '@/lib/api';

interface StatementsPanelProps {
  loanId: string;
  loanNumber: string;
  primary?: string;
}

const FY_OPTIONS = ['2025-26', '2024-25', '2023-24'];

export default function StatementsPanel({ loanId, loanNumber, primary = '#4F46E5' }: StatementsPanelProps) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fy, setFy] = useState(FY_OPTIONS[0]);

  const download = async (type: string) => {
    setBusy(type); setMsg('');
    try {
      let res: any;
      if (type === 'emi') {
        res = await statementsAPI.downloadEMI(loanId, {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        });
      } else if (type === 'interest') {
        res = await statementsAPI.downloadInterestCert(loanId, fy);
      } else {
        res = await statementsAPI.downloadAccount(loanId);
      }
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${loanNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Downloaded!');
    } catch {
      setMsg('PDF generation requires xhtml2pdf. Contact admin.');
    }
    setBusy('');
    setTimeout(() => setMsg(''), 3000);
  };

  const emailStatement = async () => {
    setBusy('email'); setMsg('');
    try {
      const user = JSON.parse(localStorage.getItem('nexloan_user') || '{}');
      await statementsAPI.emailStatement(loanId, {
        statement_type: 'account',
        email: user.email || '',
      });
      setMsg('Statement emailed ✓');
    } catch {
      setMsg('Failed to email statement.');
    }
    setBusy('');
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
      padding: 20, marginTop: 16,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16,
        textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        📄 Loan Statements
      </h3>

      {/* EMI Statement */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F3F4F6' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>EMI Payment Statement</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={inp} />
          </div>
          <button onClick={() => download('emi')} disabled={busy === 'emi'}
            style={btn(primary, busy === 'emi')}>
            {busy === 'emi' ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {/* Interest Certificate */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #F3F4F6' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Interest Certificate (Tax)</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>Financial Year</label>
            <select value={fy} onChange={e => setFy(e.target.value)} style={inp}>
              {FY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button onClick={() => download('interest')} disabled={busy === 'interest'}
            style={btn(primary, busy === 'interest')}>
            {busy === 'interest' ? 'Generating…' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {/* Account Statement */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => download('account')} disabled={busy === 'account'}
          style={btn(primary, busy === 'account')}>
          {busy === 'account' ? 'Generating…' : '📋 Full Account Statement'}
        </button>
        <button onClick={emailStatement} disabled={busy === 'email'}
          style={{
            padding: '8px 16px', background: 'transparent', color: primary,
            border: `1px solid ${primary}`, borderRadius: 6, fontSize: 13,
            fontWeight: 600, cursor: busy === 'email' ? 'not-allowed' : 'pointer',
            opacity: busy === 'email' ? 0.6 : 1,
          }}>
          {busy === 'email' ? 'Sending…' : '✉ Email Statement'}
        </button>
      </div>

      {msg && (
        <p style={{
          marginTop: 12, fontSize: 12, fontWeight: 500,
          color: msg.includes('fail') || msg.includes('requires') ? '#DC2626' : '#059669',
        }}>{msg}</p>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#9CA3AF',
  marginBottom: 4, textTransform: 'uppercase',
};
const inp: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: 6,
  fontSize: 13, color: '#111827',
};
function btn(primary: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', background: primary, color: '#fff', border: 'none',
    borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, whiteSpace: 'nowrap',
  };
}
