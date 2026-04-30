"use client";

import React, { useEffect, useState } from "react";
import { announcementAPI } from "@/lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
  image_url?: string;
  created_at: string;
}

export default function AnnouncementCards() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    announcementAPI.getActive().then(r => setAnnouncements(r.data)).catch(() => {});
    const stored = localStorage.getItem("nexloan_dismissed_announcements");
    if (stored) setDismissed(new Set(JSON.parse(stored)));
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem("nexloan_dismissed_announcements", JSON.stringify([...next]));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="announcements-list">
      {visible.map(a => (
        <div key={a.id} className="announcement-card animate-card-entrance">
          <div className="announcement-card__content">
            <h4 className="announcement-card__title">{a.title}</h4>
            <p className="announcement-card__body">{a.body}</p>
          </div>
          <button className="announcement-card__dismiss" onClick={() => dismiss(a.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
      <style jsx>{`
        .announcements-list { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); }
        .announcement-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          background: var(--color-info-bg);
          border: 1px solid rgba(37, 99, 235, 0.15);
          border-radius: var(--radius-lg);
          padding: var(--space-4) var(--space-5);
        }
        .announcement-card__content { flex: 1; }
        .announcement-card__title { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
        .announcement-card__body { font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.5; }
        .announcement-card__dismiss {
          background: none; border: none; color: var(--text-tertiary); font-size: 20px; cursor: pointer;
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-full); flex-shrink: 0;
          transition: all var(--transition-fast);
        }
        .announcement-card__dismiss:hover { background: rgba(0,0,0,0.06); color: var(--text-primary); }
      `}</style>
    </div>
  );
}
