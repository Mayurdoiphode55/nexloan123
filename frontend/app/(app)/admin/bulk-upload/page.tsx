'use client';
import { useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/api/bulk/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) setResults(await res.json());
    } catch (e) { console.error(e); }
    setUploading(false);
  }

  async function downloadTemplate() {
    const res = await fetch(`${API}/api/bulk/template`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_upload_template.csv';
    a.click();
  }

  function downloadResults() {
    if (!results?.results) return;
    const headers = Object.keys(results.results[0] || {});
    let csv = headers.join(',') + '\n';
    results.results.forEach((r: any) => {
      csv += headers.map(h => JSON.stringify(r[h] || '')).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eligibility_results.csv';
    a.click();
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Bulk Loan Processing</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>Upload CSV for batch eligibility check</p>
        </div>
        <button onClick={downloadTemplate} style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          📄 Download Template
        </button>
      </div>

      {/* Upload Area */}
      {!results && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#4F46E5' : '#D1D5DB'}`,
            borderRadius: 16, padding: '60px 40px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? '#EEF2FF' : '#FAFAFA', transition: 'all 0.2s', marginBottom: 24,
          }}
        >
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
          <p style={{ fontSize: 40, margin: '0 0 8px' }}>{file ? '✅' : '📁'}</p>
          {file ? (
            <>
              <p style={{ fontWeight: 600, color: '#111827', margin: '0 0 4px' }}>{file.name}</p>
              <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>Drop your CSV file here or click to browse</p>
              <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>Required columns: full_name, email, mobile, monthly_income, employment_type, existing_emi, loan_amount, tenure_months</p>
            </>
          )}
        </div>
      )}

      {file && !results && (
        <button onClick={handleUpload} disabled={uploading} style={{
          width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
          background: '#4F46E5', color: '#fff', fontWeight: 600, fontSize: 15,
          cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.6 : 1,
        }}>
          {uploading ? '⏳ Processing...' : '🚀 Process CSV'}
        </button>
      )}

      {/* Results */}
      {results && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Total Rows</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{results.total}</div>
            </div>
            <div style={{ background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0', padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>Eligible</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#16A34A' }}>{results.eligible}</div>
            </div>
            <div style={{ background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', padding: '20px 24px' }}>
              <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>Ineligible</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#DC2626' }}>{results.ineligible}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button onClick={downloadResults} style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>⬇️ Download Results CSV</button>
            <button onClick={() => { setResults(null); setFile(null); }} style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Upload Another</button>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Income</th>
                  <th style={thStyle}>Loan Amt</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Rate</th>
                  <th style={thStyle}>EMI</th>
                  <th style={thStyle}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {results.results?.map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.full_name || r.name || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>₹{Number(r.monthly_income || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>₹{Number(r.loan_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.credit_score || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{r.interest_rate || '—'}%</td>
                    <td style={{ padding: '8px 12px' }}>₹{Number(r.emi_amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                        background: r.verdict === 'ELIGIBLE' ? '#D1FAE5' : r.verdict === 'ERROR' ? '#FEE2E2' : '#FEF3C7',
                        color: r.verdict === 'ELIGIBLE' ? '#065F46' : r.verdict === 'ERROR' ? '#991B1B' : '#92400E',
                      }}>{r.verdict}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' };
