'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function PortfolioPage() {
  const [summary, setSummary] = useState<any>(null);
  const [dpd, setDpd] = useState<any>(null);
  const [vintage, setVintage] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  async function fetchData() {
    try {
      const [sRes, dRes, vRes, pRes] = await Promise.all([
        fetch(`${API}/api/portfolio/summary`, { headers }),
        fetch(`${API}/api/portfolio/dpd-distribution`, { headers }),
        fetch(`${API}/api/portfolio/vintage-analysis`, { headers }),
        fetch(`${API}/api/portfolio/product-mix`, { headers }),
      ]);
      if (sRes.ok) setSummary(await sRes.json());
      if (dRes.ok) setDpd(await dRes.json());
      if (vRes.ok) setVintage(await vRes.json());
      if (pRes.ok) setProduct(await pRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>Loading portfolio data...</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Portfolio Risk Dashboard</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 28px' }}>Management-level risk and performance overview</p>

      {/* Top KPI Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <div style={{ ...kpiCard, borderTop: '3px solid #4F46E5' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total AUM</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginTop: 4 }}>₹{((summary.total_aum || 0) / 100000).toFixed(1)}L</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{summary.active_loans} active loans</div>
          </div>
          <div style={{ ...kpiCard, borderTop: '3px solid #DC2626' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NPA Rate</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: summary.npa_rate > 0.02 ? '#DC2626' : '#16A34A', marginTop: 4 }}>
              {((summary.npa_rate || 0) * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{summary.npa_count} NPA accounts</div>
          </div>
          <div style={{ ...kpiCard, borderTop: '3px solid #16A34A' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collection Efficiency</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>
              {((summary.collection_efficiency || 0) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>This month</div>
          </div>
          <div style={{ ...kpiCard, borderTop: '3px solid #F59E0B' }}>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Credit Score</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginTop: 4 }}>{summary.avg_credit_score || 0}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>PAR: {((summary.portfolio_at_risk || 0) * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* DPD Distribution */}
        {dpd && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>DPD Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Current', count: dpd.current?.count || 0, color: '#16A34A' },
                { label: '1-30 DPD', count: dpd['1-30']?.count || 0, color: '#EAB308' },
                { label: '31-60 DPD', count: dpd['31-60']?.count || 0, color: '#F97316' },
                { label: '61-90 DPD', count: dpd['61-90']?.count || 0, color: '#DC2626' },
                { label: '90+ DPD', count: dpd['90+']?.count || 0, color: '#7F1D1D' },
              ].map(b => {
                const total = dpd.total_active || 1;
                const pct = (b.count / total) * 100;
                return (
                  <div key={b.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{b.label}</span>
                      <span style={{ color: '#6B7280' }}>{b.count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: b.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Product Mix */}
        {product && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Amount Band Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(product.by_amount_band || {}).map(([band, count]) => {
                const total = Object.values(product.by_amount_band || {}).reduce((s: number, v: any) => s + v, 0) || 1;
                const pct = ((count as number) / (total as number)) * 100;
                return (
                  <div key={band}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>₹{band}</span>
                      <span style={{ color: '#6B7280' }}>{count as number} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, 1)}%`, background: '#4F46E5', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {product.by_purpose?.length > 0 && (
              <>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '20px 0 10px' }}>By Purpose</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.by_purpose.map((p: any) => (
                    <span key={p.purpose} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {p.purpose}: {p.count}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Vintage Analysis */}
      {vintage.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Vintage Analysis</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={thStyle}>Cohort</th>
                <th style={thStyle}>Disbursed</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Closed</th>
                <th style={thStyle}>NPA Rate</th>
              </tr>
            </thead>
            <tbody>
              {vintage.map((v: any) => (
                <tr key={v.month} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{v.month}</td>
                  <td style={{ padding: '10px 16px' }}>{v.disbursed_count}</td>
                  <td style={{ padding: '10px 16px' }}>₹{((v.disbursed_amount || 0) / 100000).toFixed(1)}L</td>
                  <td style={{ padding: '10px 16px' }}>{v.still_active}</td>
                  <td style={{ padding: '10px 16px' }}>{v.closed}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ color: (v.npa_rate || 0) > 0.02 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                      {((v.npa_rate || 0) * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const kpiCard: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' };
const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' };
