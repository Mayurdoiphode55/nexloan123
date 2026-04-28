'use client';

import { useState, useEffect } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { supportAPI } from '@/lib/api';
import type { SupportTicket, TicketDetail } from '@/types/loan';

export default function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await supportAPI.listTickets();
      setTickets(res.data);
    } catch {}
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleCreate = async () => {
    setSubmitError('');
    if (!newSubject.trim() || newSubject.trim().length < 3) {
      setSubmitError('Subject must be at least 3 characters.');
      return;
    }
    if (!newDesc.trim() || newDesc.trim().length < 10) {
      setSubmitError('Description must be at least 10 characters.');
      return;
    }
    setLoading(true);
    try {
      await supportAPI.createTicket({ subject: newSubject.trim(), description: newDesc.trim() });
      setShowModal(false);
      setNewSubject('');
      setNewDesc('');
      setSubmitError('');
      await fetchTickets();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setSubmitError(detail);
      } else if (Array.isArray(detail)) {
        setSubmitError(detail.map((d: any) => d.msg).join(', '));
      } else {
        setSubmitError('Failed to submit request. Please try again.');
      }
    } finally { setLoading(false); }
  };

  const handleExpand = async (ticketId: string) => {
    if (expandedId === ticketId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const res = await supportAPI.getTicket(ticketId);
      setDetail(res.data);
      setExpandedId(ticketId);
    } catch {}
  };

  const handleReply = async () => {
    if (!reply.trim() || !expandedId) return;
    setLoading(true);
    try {
      await supportAPI.addMessage(expandedId, reply);
      setReply('');
      const res = await supportAPI.getTicket(expandedId);
      setDetail(res.data);
    } catch {} finally { setLoading(false); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'OPEN': return 'warning';
      case 'IN_PROGRESS': return 'info';
      case 'RESOLVED': return 'success';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };

  return (
    <div className="support">
      <div className="support__top">
        <Button size="sm" onClick={() => setShowModal(true)}>+ Raise a Request</Button>
      </div>

      {tickets.length === 0 ? (
        <p className="support__empty">No support tickets yet.</p>
      ) : (
        <div className="support__list">
          {tickets.map(t => (
            <div key={t.id} className="support__ticket">
              <div className="support__ticket-header" onClick={() => handleExpand(t.id)}>
                <div>
                  <span className="support__subject">{t.subject}</span>
                  <span className="support__date">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
                <Badge variant={statusColor(t.status) as any}>{t.status.replace('_', ' ')}</Badge>
              </div>

              {expandedId === t.id && detail && (
                <div className="support__thread">
                  {detail.messages.map(m => (
                    <div key={m.id} className={`support__msg ${m.sender_role !== 'BORROWER' ? 'support__msg--agent' : ''}`}>
                      <div className="support__msg-role">{m.sender_role === 'BORROWER' ? 'You' : 'Support'}</div>
                      <div className="support__msg-text">{m.message}</div>
                      <div className="support__msg-time">{new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))}
                  <div className="support__reply">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type a reply..."
                      className="support__reply-input"
                      onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                    />
                    <Button size="sm" loading={loading} onClick={handleReply}>Send</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="support__overlay" onClick={() => setShowModal(false)}>
          <div className="support__modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="support__modal-title">Raise a Request</h3>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject"
              className="support__modal-input"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Describe your issue (at least 10 characters)..."
              rows={4}
              className="support__modal-textarea"
            />
            {submitError && (
              <p style={{ color: 'var(--color-error)', fontSize: '13px', margin: '0 0 8px' }}>{submitError}</p>
            )}
            <div className="support__modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button loading={loading} onClick={handleCreate}>Submit</Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .support { position: relative; }
        .support__top { margin-bottom: var(--space-4); }
        .support__empty {
          text-align: center;
          color: var(--text-tertiary);
          font-size: var(--text-sm);
          padding: var(--space-6) 0;
        }
        .support__list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .support__ticket {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .support__ticket-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .support__ticket-header:hover { background: var(--surface-sunken); }
        .support__subject {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-primary);
          margin-right: var(--space-3);
        }
        .support__date {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        }
        .support__thread {
          border-top: 1px solid var(--surface-border);
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          max-height: 300px;
          overflow-y: auto;
        }
        .support__msg {
          padding: var(--space-3);
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
          max-width: 80%;
        }
        .support__msg--agent {
          align-self: flex-end;
          background: rgba(124, 58, 237, 0.1);
        }
        .support__msg-role {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: 2px;
        }
        .support__msg-text {
          font-size: var(--text-sm);
          color: var(--text-primary);
          line-height: 1.5;
        }
        .support__msg-time {
          font-size: 10px;
          color: var(--text-tertiary);
          margin-top: 4px;
        }
        .support__reply {
          display: flex;
          gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .support__reply-input {
          flex: 1;
          padding: 10px 14px;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          outline: none;
        }
        .support__reply-input:focus { border-color: var(--accent-400); }

        /* Modal */
        .support__overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .support__modal {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          width: 90%;
          max-width: 480px;
        }
        .support__modal-title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: var(--space-4);
        }
        .support__modal-input,
        .support__modal-textarea {
          width: 100%;
          padding: 12px 14px;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-sm);
          outline: none;
          margin-bottom: var(--space-3);
        }
        .support__modal-input:focus,
        .support__modal-textarea:focus { border-color: var(--accent-400); }
        .support__modal-textarea { resize: vertical; min-height: 80px; }
        .support__modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }
      `}</style>
    </div>
  );
}
