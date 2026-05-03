'use client';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CollectionsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterBucket, setFilterBucket] = useState('');
  const [noteText, setNoteText] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchData() {
    try {
      const url = filterBucket ? `${API}/api/collections/cases?dpd_bucket=${filterBucket}` : `${API}/api/collections/cases`;
      const [casesRes, statsRes] = await Promise.all([
        fetch(url, { headers }),
        fetch(`${API}/api/collections/stats`, { headers }),
      ]);
      if (casesRes.ok) setCases(await casesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadCaseDetail(caseId: string) {
    try {
      const res = await fetch(`${API}/api/collections/cases/${caseId}`, { headers });
      if (res.ok) setSelectedCase(await res.json());
    } catch (e) { console.error(e); }
  }

  async function addNote(caseId: string) {
    if (!noteText.trim()) return;
    await fetch(`${API}/api/collections/cases/${caseId}/note`, {
      method: 'POST', headers, body: JSON.stringify({ note: noteText }),
    });
    setNoteText('');
    loadCaseDetail(caseId);
  }

  async function resolveCase(caseId: string) {
    await fetch(`${API}/api/collections/cases/${caseId}/resolve`, {
      method: 'POST', headers, body: JSON.stringify({ resolution_note: 'Resolved by officer' }),
    });
    setSelectedCase(null);
    fetchData();
  }

  async function createSettlement(caseId: string) {
    await fetch(`${API}/api/collections/cases/${caseId}/settlement`, {
      method: 'POST', headers, body: JSON.stringify({ discount_pct: 10, valid_days: 15 }),
    });
    loadCaseDetail(caseId);
  }

  useEffect(() => { fetchData(); }, [filterBucket]);

  const bucketColors: Record<string, string> = {
    'CURRENT': '#16A34A', '1-30': '#EAB308', '31-60': '#F97316', '61-90': '#DC2626', '90+': '#7F1D1D'
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Collections Dashboard</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Manage overdue loans and recovery</p>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Total Overdue</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#DC2626' }}>₹{(stats.total_overdue || 0).toLocaleString()}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Active Cases</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{stats.total_cases - stats.resolved_cases}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Resolved</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#16A34A' }}>{stats.resolved_cases}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Recovery Rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#4F46E5' }}>{((stats.recovery_rate || 0) * 100).toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* DPD Bucket Filter */}
      {stats?.dpd_buckets && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setFilterBucket('')} style={{ ...filterBtn, background: !filterBucket ? '#111827' : '#F3F4F6', color: !filterBucket ? '#fff' : '#374151' }}>All</button>
          {['1-30', '31-60', '61-90', '90+'].map(b => (
            <button key={b} onClick={() => setFilterBucket(b)} style={{ ...filterBtn, background: filterBucket === b ? bucketColors[b] : '#F3F4F6', color: filterBucket === b ? '#fff' : '#374151' }}>
              {b} DPD ({stats.dpd_buckets?.find((x: any) => x.bucket === b)?.count || 0})
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedCase ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Cases List */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading...</div>
          ) : cases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <p style={{ fontSize: 36 }}>📋</p>
              <p style={{ fontWeight: 600 }}>No collections cases</p>
            </div>
          ) : (
            <div>
              {cases.map(c => (
                <div key={c.id} onClick={() => loadCaseDetail(c.id)} style={{
                  padding: '14px 20px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                  borderLeft: `4px solid ${bucketColors[c.dpd_bucket] || '#9CA3AF'}`,
                  background: selectedCase?.id === c.id ? '#F9FAFB' : '#fff',
                  transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{c.borrower_name}</div>
                      <div style={{ color: '#6B7280', fontSize: 12 }}>{c.loan_number}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#DC2626', fontSize: 14 }}>₹{(c.overdue_amount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: bucketColors[c.dpd_bucket], fontWeight: 700 }}>{c.days_past_due} DPD</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 10, background: '#F3F4F6', color: '#6B7280', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.status}</span>
                    {c.settlement_offered && <span style={{ fontSize: 10, background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Settlement</span>}
                    {c.legal_notice_sent && <span style={{ fontSize: 10, background: '#FEE2E2', color: '#991B1B', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Legal</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Case Detail */}
        {selectedCase && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24, maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{selectedCase.borrower_name}</h3>
                <p style={{ margin: '2px 0', fontSize: 13, color: '#6B7280' }}>{selectedCase.loan_number} · {selectedCase.borrower_email}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#FEF2F2', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#991B1B', fontWeight: 600 }}>Overdue Amount</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>₹{(selectedCase.overdue_amount || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>Days Past Due</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#B45309' }}>{selectedCase.days_past_due}</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {!selectedCase.settlement_offered && (
                <button onClick={() => createSettlement(selectedCase.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #D1D5DB', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Offer Settlement</button>
              )}
              <button onClick={() => resolveCase(selectedCase.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Resolve Case</button>
            </div>

            {/* Settlement Info */}
            {selectedCase.settlement_offered && (
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: 12, marginBottom: 16, borderLeft: '3px solid #F59E0B' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#92400E' }}>Settlement Offer</div>
                <div style={{ fontSize: 13, color: '#78350F' }}>₹{(selectedCase.settlement_amount || 0).toLocaleString()} ({selectedCase.settlement_discount_pct}% discount)</div>
                {selectedCase.settlement_valid_until && <div style={{ fontSize: 11, color: '#B45309' }}>Valid until {new Date(selectedCase.settlement_valid_until).toLocaleDateString()}</div>}
              </div>
            )}

            {/* Add Note */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13 }} />
                <button onClick={() => addNote(selectedCase.id)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4F46E5', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
              </div>
            </div>

            {/* Activity Log */}
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Activity Log</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(selectedCase.activities || []).map((a: any) => (
                <div key={a.id} style={{ borderLeft: '2px solid #E5E7EB', paddingLeft: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5', background: '#EEF2FF', padding: '1px 6px', borderRadius: 4 }}>{a.activity_type}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '20px 24px' };
const filterBtn: React.CSSProperties = { padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' };
