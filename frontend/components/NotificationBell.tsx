'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  loan_id?: string;
}

const TYPE_ICONS: Record<string, string> = {
  emi_reminder_7d: '📅',
  emi_reminder_1d: '📅',
  emi_reminder_today: '⏰',
  emi_overdue: '⚠️',
  emi_paid: '✅',
  loan_approved: '🎉',
  loan_disbursed: '💰',
  kyc_verified: '🔍',
  support_reply: '💬',
  callback_scheduled: '📞',
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await api.get('/api/notifications/unread-count');
      setUnreadCount(res.data?.count || 0);
    } catch { /* silently fail */ }
  };

  // Fetch all notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notifications/?limit=30');
      setNotifications(res.data?.notifications || []);
    } catch { /* silently fail */ }
    setLoading(false);
  };

  // Mark one as read
  const markAsRead = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silently fail */ }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silently fail */ }
  };

  // Poll for new notifications every 60 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // When dropdown opens, fetch notifications
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          fontSize: '22px',
          padding: '8px',
          borderRadius: '8px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.15)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="Notifications"
        id="notification-bell"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'pulse 2s infinite',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            width: '380px',
            maxHeight: '480px',
            background: '#1a1a2e',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', color: '#e5e5e5', fontWeight: 600 }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a855f7',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#737373' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔕</div>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: n.is_read ? 'default' : 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(124,58,237,0.08)',
                    display: 'flex',
                    gap: '12px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (!n.is_read) e.currentTarget.style.background = 'rgba(124,58,237,0.15)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(124,58,237,0.08)';
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px' }}>
                    {TYPE_ICONS[n.type] || '📌'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: n.is_read ? 400 : 600,
                        color: n.is_read ? '#a3a3a3' : '#e5e5e5',
                        lineHeight: 1.3,
                      }}>
                        {n.title}
                      </span>
                      {!n.is_read && (
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#a855f7',
                          flexShrink: 0,
                          marginTop: '4px',
                        }} />
                      )}
                    </div>
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: '12px',
                      color: '#737373',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {n.message}
                    </p>
                    <span style={{ fontSize: '11px', color: '#525252', marginTop: '4px', display: 'block' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
