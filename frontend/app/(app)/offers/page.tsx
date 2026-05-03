'use client';
import { useState, useEffect } from 'react';
import { useTenant } from '@/lib/tenant';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function MyOffersPage() {
  const tenant = useTenant();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== 'undefined' ? localStorage.getItem('nexloan_token') : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function fetchOffers() {
    try {
      const res = await fetch(`${API}/api/offers/my-offers`, { headers });
      if (res.ok) setOffers(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { fetchOffers(); }, []);

  async function handleAction(offerId: string, action: 'accept' | 'decline') {
    await fetch(`${API}/api/offers/${offerId}/${action}`, { method: 'POST', headers });
    fetchOffers();
  }

  const primary = tenant.primary_color || '#4F46E5';

  const offerTypeStyles: Record<string, { icon: string; gradient: string; accent: string }> = {
    TOP_UP: { icon: '💰', gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', accent: '#7C3AED' },
    RATE_REDUCTION: { icon: '📉', gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', accent: '#059669' },
    LOAN_RENEWAL: { icon: '🔄', gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)', accent: '#D97706' },
  };

  return (
    <div style={{ padding: '32px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>My Offers</h1>
      <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 24px' }}>Exclusive offers based on your repayment performance</p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading offers...</div>
      ) : offers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#F9FAFB', borderRadius: 16, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🎁</p>
          <h3 style={{ color: '#374151', margin: '12px 0 8px' }}>No active offers</h3>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Keep paying on time to unlock exclusive offers!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {offers.map(offer => {
            const style = offerTypeStyles[offer.offer_type] || offerTypeStyles.TOP_UP;
            return (
              <div key={offer.id} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                {/* Header */}
                <div style={{ background: style.gradient, padding: '20px 24px', color: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 32 }}>{style.icon}</span>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{offer.title}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{offer.offer_type.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                    {offer.valid_until && (
                      <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
                        Expires {new Date(offer.valid_until).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: 24 }}>
                  <p style={{ color: '#374151', fontSize: 14, margin: '0 0 16px', lineHeight: 1.6 }}>{offer.description}</p>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                    {offer.offered_amount && (
                      <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Amount</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>₹{offer.offered_amount.toLocaleString()}</div>
                      </div>
                    )}
                    {offer.offered_rate && (
                      <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Interest Rate</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: style.accent }}>{offer.offered_rate}% p.a.</div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => handleAction(offer.id, 'accept')} style={{
                      flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: style.gradient, color: '#fff', fontWeight: 700, fontSize: 14,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}>
                      Accept Offer
                    </button>
                    <button onClick={() => handleAction(offer.id, 'decline')} style={{
                      padding: '12px 20px', borderRadius: 10, border: '1px solid #D1D5DB',
                      background: '#fff', cursor: 'pointer', color: '#6B7280', fontWeight: 600, fontSize: 14,
                    }}>
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
