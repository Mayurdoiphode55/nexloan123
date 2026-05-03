'use client';
import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant';
import { Users, Copy, CheckCircle, Share2, Award, Gift } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ReferralsPage() {
  const tenant = useTenant();
  const [referralData, setReferralData] = useState<any>(null);
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    async function fetchData() {
      try {
        const [codeRes, listRes, rewardsRes] = await Promise.all([
          fetch(`${API}/api/referral/my-code`, { headers }),
          fetch(`${API}/api/referral/my-referrals`, { headers }),
          fetch(`${API}/api/referral/my-rewards`, { headers })
        ]);

        if (codeRes.ok) setReferralData(await codeRes.json());
        if (listRes.ok) setReferralsList(await listRes.json());
        if (rewardsRes.ok) setRewards(await rewardsRes.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleCopy = () => {
    if (!referralData) return;
    navigator.clipboard.writeText(referralData.share_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const primary = tenant.primary_color || '#4F46E5';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading referral dashboard...</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Refer & Earn</h1>
          <p style={{ color: '#6B7280', fontSize: 16, margin: 0 }}>
            Invite friends to {tenant.name} and earn rewards when they take a loan.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
        {/* Share Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#EEF2FF', padding: 10, borderRadius: 10, color: primary }}>
              <Share2 size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Your Referral Link</h3>
          </div>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 20 }}>
            Share this link with your friends. You earn ₹{tenant.referral_reward_amount || 500} when they complete their 3rd EMI payment.
          </p>
          
          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {referralData?.share_link || 'Link generating...'}
            </span>
            <button 
              onClick={handleCopy}
              style={{ background: 'none', border: 'none', color: primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: `rgba(79, 70, 229, 0.05)`, borderRadius: 8, border: `1px dashed ${primary}` }}>
            <span style={{ color: '#4B5563', fontSize: 14 }}>Or share code:</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: primary, letterSpacing: 2 }}>{referralData?.code}</span>
          </div>
        </div>

        {/* Stats Card */}
        <div style={{ background: `linear-gradient(135deg, ${primary} 0%, #312E81 100%)`, borderRadius: 16, padding: 24, color: '#fff', boxShadow: '0 10px 25px rgba(79, 70, 229, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 10 }}>
              <Award size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Your Rewards</h3>
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>Total Rewards Earned</div>
            <div style={{ fontSize: 36, fontWeight: 800 }}>₹{rewards?.total_earned?.toLocaleString() || 0}</div>
          </div>
          
          <div style={{ display: 'flex', gap: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Available Balance</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>₹{rewards?.available_balance?.toLocaleString() || 0}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Successful Referrals</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{referralData?.successful_referrals || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Referrals List */}
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={20} color={primary} /> My Referrals ({referralsList.length})
      </h2>
      
      {referralsList.length === 0 ? (
        <div style={{ background: '#F9FAFB', borderRadius: 16, border: '1px dashed #D1D5DB', padding: 48, textAlign: 'center' }}>
          <Gift size={48} color="#9CA3AF" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No referrals yet</h3>
          <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>Share your link above to start earning rewards!</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px 24px', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Reward</th>
              </tr>
            </thead>
            <tbody>
              {referralsList.map((ref: any, idx) => (
                <tr key={ref.id} style={{ borderBottom: idx === referralsList.length - 1 ? 'none' : '1px solid #E5E7EB' }}>
                  <td style={{ padding: '16px 24px', fontSize: 14, color: '#111827' }}>
                    {new Date(ref.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '16px 24px' }}>
                    {ref.status === 'REGISTERED' && <span style={{ background: '#F3F4F6', color: '#4B5563', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Registered</span>}
                    {ref.status === 'LOAN_TAKEN' && <span style={{ background: '#DBEAFE', color: '#1D4ED8', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Loan Taken</span>}
                    {ref.status === 'REWARDED' && <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Rewarded ✅</span>}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 14, fontWeight: 600, color: ref.status === 'REWARDED' ? '#059669' : '#6B7280' }}>
                    {ref.status === 'REWARDED' ? `₹${ref.reward_amount.toLocaleString()} Earned` : `₹${ref.reward_amount.toLocaleString()} Pending`}
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
