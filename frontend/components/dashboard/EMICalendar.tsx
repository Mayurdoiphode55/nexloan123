'use client';

import { useState, useMemo } from 'react';
import type { EMIScheduleRow } from '@/types/loan';

interface EMICalendarProps {
  schedule: EMIScheduleRow[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function EMICalendar({ schedule }: EMICalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tooltip, setTooltip] = useState<{ emi: EMIScheduleRow; x: number; y: number } | null>(null);

  // Map EMI due dates to calendar
  const emiMap = useMemo(() => {
    const map = new Map<string, EMIScheduleRow>();
    schedule.forEach(row => {
      const d = new Date(row.due_date);
      map.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, row);
    });
    return map;
  }, [schedule]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

  const navigate = (dir: -1 | 1) => {
    let m = month + dir;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'var(--color-success)';
      case 'OVERDUE': return 'var(--color-error)';
      case 'PAUSED': return 'var(--text-tertiary)';
      default: return 'var(--color-warning)';
    }
  };

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="emi-calendar">
      <div className="emi-calendar__header">
        <button onClick={() => navigate(-1)} className="emi-calendar__nav">←</button>
        <span className="emi-calendar__title">{MONTHS[month]} {year}</span>
        <button onClick={() => navigate(1)} className="emi-calendar__nav">→</button>
      </div>

      <div className="emi-calendar__days">
        {DAYS.map(d => <div key={d} className="emi-calendar__day-label">{d}</div>)}
      </div>

      <div className="emi-calendar__grid">
        {cells.map((day, i) => {
          const key = day ? `${year}-${month}-${day}` : `empty-${i}`;
          const emi = day ? emiMap.get(key) : null;

          return (
            <div
              key={key}
              className={`emi-calendar__cell ${day ? '' : 'emi-calendar__cell--empty'} ${isToday(day!) ? 'emi-calendar__cell--today' : ''}`}
              onClick={(e) => {
                if (emi) {
                  setTooltip({ emi, x: e.clientX, y: e.clientY });
                  setTimeout(() => setTooltip(null), 3000);
                }
              }}
            >
              {day && <span className="emi-calendar__date">{day}</span>}
              {emi && (
                <div className="emi-calendar__emi" style={{ color: getStatusColor(emi.status) }}>
                  <span className="emi-calendar__dot" style={{ background: getStatusColor(emi.status) }} />
                  <span className="emi-calendar__amount">₹{Math.round(emi.emi_amount).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="emi-calendar__tooltip" style={{ top: tooltip.y - 120, left: tooltip.x - 100 }}>
          <div className="emi-calendar__tooltip-row">
            <span>Principal</span><span>₹{Math.round(tooltip.emi.principal).toLocaleString('en-IN')}</span>
          </div>
          <div className="emi-calendar__tooltip-row">
            <span>Interest</span><span>₹{Math.round(tooltip.emi.interest).toLocaleString('en-IN')}</span>
          </div>
          <div className="emi-calendar__tooltip-row">
            <span>Outstanding</span><span>₹{Math.round(tooltip.emi.outstanding_balance).toLocaleString('en-IN')}</span>
          </div>
          <div className="emi-calendar__tooltip-row">
            <span>Status</span><span style={{ color: getStatusColor(tooltip.emi.status), fontWeight: 600 }}>{tooltip.emi.status}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .emi-calendar {
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-6);
          position: relative;
        }
        .emi-calendar__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--space-4);
        }
        .emi-calendar__title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--text-primary);
        }
        .emi-calendar__nav {
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-size: var(--text-base);
        }
        .emi-calendar__nav:hover {
          background: var(--accent-500);
          color: white;
          border-color: var(--accent-500);
        }
        .emi-calendar__days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          margin-bottom: var(--space-1);
        }
        .emi-calendar__day-label {
          text-align: center;
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          padding: var(--space-2) 0;
        }
        .emi-calendar__grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
        }
        .emi-calendar__cell {
          min-height: 52px;
          padding: var(--space-1);
          border: 1px solid transparent;
          border-radius: var(--radius-sm);
          cursor: default;
          transition: background var(--transition-fast);
        }
        .emi-calendar__cell:hover:not(.emi-calendar__cell--empty) {
          background: var(--surface-sunken);
        }
        .emi-calendar__cell--empty {
          opacity: 0;
        }
        .emi-calendar__cell--today {
          border-color: var(--accent-400);
          background: rgba(124, 58, 237, 0.06);
        }
        .emi-calendar__date {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          display: block;
        }
        .emi-calendar__emi {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 2px;
          cursor: pointer;
        }
        .emi-calendar__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .emi-calendar__amount {
          font-size: 9px;
          font-weight: 600;
          font-family: var(--font-mono);
          white-space: nowrap;
        }
        .emi-calendar__tooltip {
          position: fixed;
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          padding: var(--space-3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          z-index: 100;
          min-width: 200px;
          animation: fadeIn 150ms ease-out;
        }
        .emi-calendar__tooltip-row {
          display: flex;
          justify-content: space-between;
          font-size: var(--text-xs);
          color: var(--text-secondary);
          padding: 3px 0;
        }
        .emi-calendar__tooltip-row span:last-child {
          font-family: var(--font-mono);
          color: var(--text-primary);
          font-weight: 500;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
