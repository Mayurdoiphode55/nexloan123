'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  async function generateReport() {
    setLoading(true);
    try {
      const url = month
        ? `${API}/api/risk/reports/benchmark?month=${month}`
        : `${API}/api/risk/reports/benchmark`;
      const res = await fetch(url, { headers });
      if (res.ok) setReport(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function pct(val: number) { return `${(val * 100).toFixed(1)}%`; }

  const metrics = report?.metrics;
  const benchmarks = report?.benchmarks;

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Benchmark Reports</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Compare your platform performance against industry benchmarks</p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14 }} />
        <button onClick={generateReport} disabled={loading} style={{ background: '#4F46E5', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Generating...' : '📊 Generate Report'}
        </button>
      </div>

      {!report && !loading && (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 36 }}>📈</p>
          <p style={{ fontWeight: 600, fontSize: 16, color: '#374151' }}>Select a month and generate</p>
          <p style={{ color: '#6B7280' }}>Leave empty for last month&apos;s report</p>
        </div>
      )}

      {metrics && benchmarks && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {/* Report Header */}
          <div style={{ background: '#1A1A2E', color: '#fff', padding: 28 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Monthly Performance Report</h2>
            <p style={{ margin: '4px 0 0', opacity: 0.7, fontSize: 14 }}>{metrics.month}</p>
          </div>

          <div style={{ padding: 28 }}>
            {/* Metrics vs Benchmark Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 24 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 600 }}>Metric</th>
                  <th style={{ textAlign: 'center', padding: 12, fontWeight: 600 }}>Your Platform</th>
                  <th style={{ textAlign: 'center', padding: 12, fontWeight: 600 }}>Industry Avg</th>
                  <th style={{ textAlign: 'center', padding: 12, fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Approval Rate', yours: metrics.approval_rate, bench: benchmarks.approval_rate, higher: true },
                  { label: 'NPA Rate', yours: metrics.npa_rate, bench: benchmarks.npa_rate, higher: false },
                  { label: 'Collection Efficiency', yours: metrics.collection_efficiency, bench: benchmarks.collection_efficiency, higher: true },
                ].map(row => {
                  const good = row.higher ? row.yours >= row.bench : row.yours <= row.bench;
                  return (
                    <tr key={row.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: 12 }}>{row.label}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 700, color: good ? '#16A34A' : '#DC2626' }}>{pct(row.yours)}</td>
                      <td style={{ padding: 12, textAlign: 'center', color: '#6B7280' }}>{pct(row.bench)}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontSize: 20 }}>{good ? '✅' : '⚠️'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: '#F9FAFB', borderRadius: 10, padding: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Loans Processed</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{metrics.total_loans}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>Active Portfolio</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{metrics.total_active}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>NPA Cases</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>{metrics.npa_count}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
