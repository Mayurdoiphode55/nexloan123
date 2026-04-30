"use client";

import React, { useEffect, useState } from "react";
import { dashboardAPI } from "@/lib/api";

interface Task {
  type: string;
  icon: string;
  label: string;
  customer_name: string;
  loan_id?: string;
  loan_number?: string;
  time_elapsed: string;
  cta: string;
  cta_url: string;
}

export default function PendingTasksPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = () => {
    dashboardAPI.getPendingTasks()
      .then(r => setTasks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  const taskIcons: Record<string, string> = {
    KYC_REVIEW: "📄",
    CALLBACK: "📞",
    SUPPORT_TICKET: "🎫",
    STUCK_UNDERWRITING: "⏳",
    PRECLOSURE: "🔒",
  };

  if (loading) {
    return (
      <div className="tasks-panel">
        <div className="tasks-panel__header">
          <h3 className="tasks-panel__title">Pending Tasks</h3>
        </div>
        <div className="tasks-panel__body">
          {[1, 2, 3].map(i => (
            <div key={i} className="task-item task-item--skeleton">
              <div className="task-skeleton-line" style={{ width: '70%' }} />
              <div className="task-skeleton-line" style={{ width: '40%', marginTop: 6 }} />
            </div>
          ))}
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="tasks-panel">
      <div className="tasks-panel__header">
        <h3 className="tasks-panel__title">Pending Tasks</h3>
        <span className="tasks-panel__count">{tasks.length}</span>
      </div>
      <div className="tasks-panel__body">
        {tasks.length === 0 ? (
          <div className="tasks-panel__empty">
            <span>✅</span>
            <p>All caught up! No pending tasks.</p>
          </div>
        ) : (
          tasks.slice(0, 8).map((task, i) => (
            <div key={i} className="task-item" style={{ '--stagger-index': i } as React.CSSProperties}>
              <div className="task-item__icon">{taskIcons[task.type] || "📋"}</div>
              <div className="task-item__content">
                <span className="task-item__label">{task.label}</span>
                <span className="task-item__meta">
                  {task.customer_name} · {task.time_elapsed}
                </span>
              </div>
              <a href={task.cta_url} className="task-item__cta">{task.cta}</a>
            </div>
          ))
        )}
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .tasks-panel {
    background: var(--surface-base);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .tasks-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--surface-border);
  }
  .tasks-panel__title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }
  .tasks-panel__count {
    background: var(--accent-subtle);
    color: var(--accent-primary);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: var(--radius-full);
  }
  .tasks-panel__body {
    max-height: 360px;
    overflow-y: auto;
  }
  .tasks-panel__empty {
    padding: var(--space-8);
    text-align: center;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .tasks-panel__empty span { font-size: 28px; }

  .task-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--surface-border);
    transition: background var(--transition-fast);
    animation: staggerIn 300ms ease forwards;
    animation-delay: calc(var(--stagger-index, 0) * 40ms);
    opacity: 0;
  }
  .task-item:last-child { border-bottom: none; }
  .task-item:hover { background: var(--surface-sunken); }
  .task-item--skeleton {
    padding: var(--space-4) var(--space-5);
    animation: none;
    opacity: 1;
  }
  .task-item__icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-sunken);
    border-radius: var(--radius-md);
  }
  .task-item__content {
    flex: 1;
    min-width: 0;
  }
  .task-item__label {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .task-item__meta {
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .task-item__cta {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--accent-primary);
    background: var(--accent-subtle);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    text-decoration: none;
    white-space: nowrap;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }
  .task-item__cta:hover {
    background: var(--accent-primary);
    color: white;
  }
  .task-skeleton-line {
    height: 12px;
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
  }
`;
