'use client';
import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function TopUpPage() {
  const tenant = useTenant();
  const [loans, setLoans] = useState<any[]>([]);
  const [eligibilityData, setEligibilityData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [applyingFor, setApplyingFor] = useState<string | null>(null);
  
  // Quote states
  const [additionalAmount, setAdditionalAmount] = useState(100000);
  const [newTenure, setNewTenure] = useState(36);
  const [quote, setQuote] = useState<any>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    async function fetchLoansAndEligibility() {
      try {
        const res = await fetch(`${API}/api/dashboard/my-loans`, { headers });
        if (res.ok) {
          const data = await res.json();
          const activeLoans = data.filter((l: any) => l.status === 'ACTIVE');
          setLoans(activeLoans);
          
          const eligibilityPromises = activeLoans.map(async (loan: any) => {
            const eligRes = await fetch(`${API}/api/topup/${loan.id}/eligibility`, { headers });
            if (eligRes.ok) return { id: loan.id, data: await eligRes.json() };
            return { id: loan.id, data: { eligible: false } };
          });
          
          const results = await Promise.all(eligibilityPromises);
          const eligMap: Record<string, any> = {};
          results.forEach(r => eligMap[r.id] = r.data);
          setEligibilityData(eligMap);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchLoansAndEligibility();
  }, []);

  useEffect(() => {
    if (applyingFor && eligibilityData[applyingFor]?.eligible) {
      getQuote();
    }
  }, [applyingFor, additionalAmount, newTenure]);

  async function getQuote() {
    if (!applyingFor) return;
    try {
      const res = await fetch(`${API}/api/topup/${applyingFor}/quote?additional_amount=${additionalAmount}&new_tenure_months=${newTenure}`, { headers });
      if (res.ok) setQuote(await res.json());
    } catch (e) {
      console.error("Failed to get quote", e);
    }
  }

  async function handleApply() {
    if (!applyingFor) return;
    try {
      const res = await fetch(`${API}/api/topup/${applyingFor}/apply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ additional_amount: additionalAmount, new_tenure_months: newTenure })
      });
      if (res.ok) {
        alert("Top-up loan successfully applied! Redirecting to dashboard...");
        window.location.href = '/dashboard';
      } else {
        const data = await res.json();
        alert(`Failed to apply: ${data.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const primary = tenant.primary_color || '#4F46E5';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Checking top-up eligibility...</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Loan Top-Up</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 32px' }}>
        Get additional funds on top of your existing active loan.
      </p>

      {loans.length === 0 && (
        <div style={{ background: '#F9FAFB', padding: 40, borderRadius: 12, textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <p style={{ color: '#6B7280' }}>You do not have any active loans eligible for a top-up.</p>
        </div>
      )}

      {loans.map(loan => {
        const eligibility = eligibilityData[loan.id];
        const isEligible = eligibility?.eligible;
        
        return (
          <div key={loan.id} style={{ 
            background: '#fff', 
            border: `1px solid ${isEligible ? primary : '#E5E7EB'}`, 
            borderRadius: 16, 
            padding: 24, 
            marginBottom: 20,
            boxShadow: isEligible ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{loan.loan_number}</h3>
                <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>{loan.purpose} Loan</p>
              </div>
              {isEligible ? (
                <div style={{ background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  Eligible for Top-Up
                </div>
              ) : (
                <div style={{ background: '#F3F4F6', color: '#6B7280', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  Not Eligible
                </div>
              )}
            </div>

            {!isEligible && eligibility && (
              <p style={{ color: '#DC2626', fontSize: 14, background: '#FEF2F2', padding: 12, borderRadius: 8 }}>
                {eligibility.reason}
              </p>
            )}

            {isEligible && applyingFor !== loan.id && (
              <div>
                <p style={{ color: '#374151', fontSize: 14, marginBottom: 16 }}>
                  You are pre-approved for an additional top-up of up to <strong>₹{eligibility.max_topup_amount.toLocaleString()}</strong>.
                </p>
                <button 
                  onClick={() => { setApplyingFor(loan.id); setAdditionalAmount(Math.min(100000, eligibility.max_topup_amount)); }}
                  style={{ background: primary, color: '#fff', padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Configure Top-Up
                </button>
              </div>
            )}

            {isEligible && applyingFor === loan.id && quote && (
              <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 20, marginTop: 20 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 16 }}>Configure Your Top-Up</h4>
                
                <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>
                      Additional Amount: ₹{additionalAmount.toLocaleString()}
                    </label>
                    <input 
                      type="range" 
                      min="10000" 
                      max={eligibility.max_topup_amount} 
                      step="5000"
                      value={additionalAmount}
                      onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#6B7280', fontWeight: 600, marginBottom: 8 }}>
                      New Tenure: {newTenure} months
                    </label>
                    <input 
                      type="range" 
                      min="12" 
                      max="60" 
                      step="6"
                      value={newTenure}
                      onChange={(e) => setNewTenure(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ background: '#F9FAFB', padding: 20, borderRadius: 12, marginBottom: 24 }}>
                  <h5 style={{ margin: '0 0 12px', fontSize: 14 }}>How it works:</h5>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: '#6B7280' }}>Outstanding Principal</span>
                    <span style={{ fontWeight: 600 }}>₹{quote.outstanding_from_original.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <span style={{ color: '#6B7280' }}>+ New Additional Amount</span>
                    <span style={{ fontWeight: 600, color: primary }}>₹{quote.additional_amount.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 1, background: '#E5E7EB', margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 16 }}>
                    <span style={{ fontWeight: 600 }}>= New Loan Amount</span>
                    <span style={{ fontWeight: 700 }}>₹{quote.new_principal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Estimated New EMI</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>₹{Math.round(quote.new_emi).toLocaleString()}/mo</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Interest Rate</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{quote.interest_rate}% p.a.</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={handleApply}
                    style={{ background: primary, color: '#fff', flex: 1, padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 16 }}
                  >
                    Apply for Top-Up
                  </button>
                  <button 
                    onClick={() => setApplyingFor(null)}
                    style={{ background: '#fff', color: '#6B7280', padding: '12px 24px', borderRadius: 8, border: '1px solid #D1D5DB', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
