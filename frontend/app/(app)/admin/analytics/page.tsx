'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'cohorts' | 'trends' | 'performers'>('cohorts');
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [performers, setPerformers] = useState<any>(null);
  const [groupBy, setGroupBy] = useState('acquisition_month');
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}` };

  async function fetchData() {
    setLoading(true);
    try {
      const [cRes, tRes, pRes] = await Promise.all([
        fetch(`${API}/api/analytics/cohorts?group_by=${groupBy}`, { headers }),
        fetch(`${API}/api/analytics/trends`, { headers }),
        fetch(`${API}/api/analytics/performers`, { headers }),
      ]);
      if (cRes.ok) setCohorts(await cRes.json());
      if (tRes.ok) setTrends(await tRes.json());
      if (pRes.ok) setPerformers(await pRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [groupBy]);

  return (
    <div style={{ padding: '32px', maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Cohort Analytics</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Deep dive into portfolio performance by cohort</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#F3F4F6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['cohorts', 'trends', 'performers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#111827' : '#6B7280',
            fontWeight: 600, fontSize: 13, boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading analytics...</div>
      ) : (
        <>
          {/* Cohorts Tab */}
          {tab === 'cohorts' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { val: 'acquisition_month', label: 'By Month' },
                  { val: 'score_band', label: 'By Score Band' },
                  { val: 'purpose', label: 'By Purpose' },
                ].map(g => (
                  <button key={g.val} onClick={() => setGroupBy(g.val)} style={{
                    padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: groupBy === g.val ? '#4F46E5' : '#F3F4F6', color: groupBy === g.val ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: 12,
                  }}>{g.label}</button>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      <th style={thStyle}>Cohort</th>
                      <th style={thStyle}>Loans</th>
                      <th style={thStyle}>Disbursed</th>
                      <th style={thStyle}>Avg Score</th>
                      <th style={thStyle}>On-Time Rate</th>
                      <th style={thStyle}>NPA</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map(c => (
                      <tr key={c.cohort_label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600, color: '#111827' }}>{c.cohort_label}</td>
                        <td style={{ padding: '10px 16px' }}>{c.total_loans}</td>
                        <td style={{ padding: '10px 16px' }}>₹{((c.total_disbursed || 0) / 100000).toFixed(1)}L</td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontWeight: 600, color: c.avg_credit_score >= 650 ? '#16A34A' : c.avg_credit_score >= 500 ? '#F59E0B' : '#DC2626' }}>
                            {c.avg_credit_score}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(c.on_time_rate || 0) * 100}%`, background: (c.on_time_rate || 0) >= 0.9 ? '#16A34A' : '#F59E0B', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 12 }}>{((c.on_time_rate || 0) * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px', color: c.npa_count > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>{c.npa_count}</td>
                        <td style={{ padding: '10px 16px' }}>{c.active_count}</td>
                        <td style={{ padding: '10px 16px' }}>{c.closed_count}</td>
                      </tr>
                    ))}
                    {cohorts.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No cohort data available</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Trends Tab */}
          {tab === 'trends' && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>Monthly Trends (Last 6 Months)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {trends.map(t => {
                  const maxDisbursed = Math.max(...trends.map(x => x.disbursed), 1);
                  return (
                    <div key={t.month} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 80px 80px', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{t.month}</span>
                      <div>
                        <div style={{ height: 24, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(t.disbursed / maxDisbursed) * 100}%`, background: 'linear-gradient(90deg, #4F46E5, #7C3AED)', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                            <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{t.disbursed} loans</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{t.emis_collected}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>EMIs</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.new_npa_cases > 0 ? '#DC2626' : '#6B7280' }}>{t.new_npa_cases}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>NPA</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Performers Tab */}
          {tab === 'performers' && performers && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Top Loan Purposes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {performers.top_purposes?.map((p: any, i: number) => (
                  <div key={p.purpose} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981'][i] || '#6B7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, color: '#111827', width: 120 }}>{p.purpose}</span>
                    <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(p.count / (performers.top_purposes?.[0]?.count || 1)) * 100}%`, background: ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981'][i], borderRadius: 4 }} />
                    </div>
                    <span style={{ fontWeight: 700, color: '#374151', minWidth: 30 }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' };
