'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { referralAPI } from '@/lib/api';
import type { ReferralCode, ReferralItem } from '@/types/loan';

export default function ReferralSection() {
  const [data, setData] = useState<ReferralCode | null>(null);
  const [history, setHistory] = useState<ReferralItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await referralAPI.getCode();
      setData(res.data);
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const res = await referralAPI.history();
      setHistory(res.data);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await referralAPI.invite(email);
      setEmail('');
      setShowModal(false);
      await fetchData();
    } catch {} finally { setLoading(false); }
  };

  if (!data) return null;

  return (
    <div className="referral">
      <div className="referral__code-section">
        <label className="referral__label">YOUR REFERRAL CODE</label>
        <div className="referral__code-row">
          <span className="referral__code">{data.referral_code}</span>
          <button className="referral__copy" onClick={handleCopy}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="referral__stats">
        <div className="referral__stat">
          <span className="referral__stat-value">{data.stats.invited}</span>
          <span className="referral__stat-label">Invited</span>
        </div>
        <div className="referral__stat-divider" />
        <div className="referral__stat">
          <span className="referral__stat-value">{data.stats.signed_up}</span>
          <span className="referral__stat-label">Signed Up</span>
        </div>
        <div className="referral__stat-divider" />
        <div className="referral__stat">
          <span className="referral__stat-value" style={{ color: 'var(--color-success)' }}>₹{data.stats.earned}</span>
          <span className="referral__stat-label">Earned</span>
        </div>
      </div>

      <div className="referral__actions">
        <Button size="sm" onClick={() => setShowModal(true)}>Share via Email</Button>
        <Button size="sm" variant="secondary" onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}>
          {showHistory ? 'Hide History' : 'View History'}
        </Button>
      </div>

      {showHistory && history.length > 0 && (
        <div className="referral__history">
          {history.map(r => (
            <div key={r.id} className="referral__history-row">
              <span className="referral__history-email">{r.referred_email}</span>
              <Badge variant={r.status === 'REWARDED' ? 'success' : r.status === 'SIGNED_UP' ? 'info' : 'neutral'}>
                {r.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Email Modal */}
      {showModal && (
        <div className="referral__overlay" onClick={() => setShowModal(false)}>
          <div className="referral__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="referral__modal-title">Invite a Friend</h3>
            <p className="referral__modal-desc">Send your referral link to a friend&apos;s email.</p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@email.com"
              type="email"
              className="referral__modal-input"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <div className="referral__modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button loading={loading} onClick={handleInvite}>Send Invite</Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .referral {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
        }
        .referral__label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .referral__code-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }
        .referral__code {
          font-family: var(--font-mono);
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--accent-400);
          letter-spacing: 0.06em;
        }
        .referral__copy {
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          padding: 6px 14px;
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .referral__copy:hover {
          border-color: var(--accent-400);
          color: var(--accent-400);
        }
        .referral__stats {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          margin-top: var(--space-5);
          padding: var(--space-4);
          background: var(--surface-sunken);
          border-radius: var(--radius-lg);
        }
        .referral__stat {
          flex: 1;
          text-align: center;
        }
        .referral__stat-value {
          display: block;
          font-family: var(--font-display);
          font-size: var(--text-xl);
          font-weight: 700;
          color: var(--text-primary);
        }
        .referral__stat-label {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: 2px;
          display: block;
        }
        .referral__stat-divider {
          width: 1px;
          height: 32px;
          background: var(--surface-border);
        }
        .referral__actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-5);
        }
        .referral__history {
          margin-top: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .referral__history-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3);
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
        }
        .referral__history-email {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        /* Modal */
        .referral__overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .referral__modal {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          width: 90%;
          max-width: 400px;
        }
        .referral__modal-title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--text-primary);
        }
        .referral__modal-desc {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: var(--space-2) 0 var(--space-4);
        }
        .referral__modal-input {
          width: 100%;
          padding: 12px 14px;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          outline: none;
          margin-bottom: var(--space-4);
        }
        .referral__modal-input:focus { border-color: var(--accent-400); }
        .referral__modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
        }
      `}</style>
    </div>
  );
}
