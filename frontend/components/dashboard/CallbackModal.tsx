'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface CallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId?: string;
  userPhone?: string;
}

const SLOTS = [
  { key: 'morning', label: 'Morning', time: '9 AM – 12 PM', icon: '🌅' },
  { key: 'afternoon', label: 'Afternoon', time: '12 PM – 5 PM', icon: '☀️' },
  { key: 'evening', label: 'Evening', time: '5 PM – 8 PM', icon: '🌙' },
];

export default function CallbackModal({ isOpen, onClose, loanId, userPhone }: CallbackModalProps) {
  const [phone, setPhone] = useState(userPhone || '');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    if (!selectedSlot) {
      setError('Please select a preferred time slot');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/api/support/callback-request', {
        phone_number: phone,
        preferred_slot: selectedSlot,
        loan_id: loanId || null,
        reason: reason || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to schedule callback');
    } finally {
      setLoading(false);
    }
  };

  const slotLabel = SLOTS.find(s => s.key === selectedSlot)?.time || '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '16px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '16px',
          padding: '32px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        {success ? (
          /* Success State */
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h3 style={{ color: '#e5e5e5', fontSize: '20px', margin: '0 0 8px' }}>
              Callback Scheduled!
            </h3>
            <p style={{ color: '#a3a3a3', fontSize: '14px', lineHeight: 1.6 }}>
              We'll call you between <strong style={{ color: '#a855f7' }}>{slotLabel}</strong> today
              at <strong style={{ color: '#e5e5e5' }}>{phone}</strong>.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: '24px',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          /* Form State */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: '#e5e5e5', fontSize: '20px', margin: 0 }}>
                📞 Request a Callback
              </h3>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: '#737373', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '24px', lineHeight: 1.5 }}>
              Our support team will call you at your preferred time. No waiting on hold!
            </p>

            {/* Phone number */}
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '6px', display: 'block' }}>
                Phone Number
              </span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  color: '#e5e5e5',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {/* Time slot selector */}
            <span style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '10px', display: 'block' }}>
              Preferred Time Slot
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {SLOTS.map(slot => (
                <button
                  key={slot.key}
                  onClick={() => setSelectedSlot(slot.key)}
                  style={{
                    padding: '14px 8px',
                    background: selectedSlot === slot.key
                      ? 'rgba(124,58,237,0.2)'
                      : 'rgba(255,255,255,0.04)',
                    border: selectedSlot === slot.key
                      ? '2px solid #a855f7'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{slot.icon}</div>
                  <div style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: 600 }}>{slot.label}</div>
                  <div style={{ color: '#737373', fontSize: '11px', marginTop: '2px' }}>{slot.time}</div>
                </button>
              ))}
            </div>

            {/* Reason for callback */}
            <label style={{ display: 'block', marginBottom: '20px' }}>
              <span style={{ color: '#a3a3a3', fontSize: '13px', marginBottom: '6px', display: 'block' }}>
                Reason for Callback <span style={{ color: '#525252' }}>(optional)</span>
              </span>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Need help with loan repayment options..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  color: '#e5e5e5',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box' as const,
                  resize: 'vertical' as const,
                  fontFamily: 'inherit',
                }}
              />
            </label>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: loading ? '#525252' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Scheduling...' : 'Confirm Callback'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
