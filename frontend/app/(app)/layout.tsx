"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("nexloan_token");
    const user = localStorage.getItem("nexloan_user");
    if (!token || !user) {
      router.push("/auth");
      return;
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) return null; // Don't render until auth is confirmed

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-layout__content">
        <header className="app-layout__topbar">
          {/* Hamburger Menu Button */}
          <button
            className="app-layout__hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>

          <div className="app-layout__topbar-brand">
            <span className="app-layout__topbar-logo">NexLoan</span>
          </div>

          <div style={{ flex: 1 }} />
          <NotificationBell />
        </header>
        <main className="app-layout__main">{children}</main>
      </div>

      <style jsx>{`
        .app-layout {
          display: flex;
          min-height: 100vh;
          background: var(--surface-base);
        }
        .app-layout__content {
          flex: 1;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow-y: auto;
        }
        .app-layout__topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,10,0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .app-layout__hamburger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          border: 1px solid var(--surface-border);
          background: var(--surface-raised);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .app-layout__hamburger:hover {
          background: var(--surface-border);
          color: var(--text-primary);
          border-color: var(--accent-400);
        }
        .app-layout__topbar-brand {
          display: flex;
          align-items: center;
        }
        .app-layout__topbar-logo {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .app-layout__main {
          flex: 1;
          padding: var(--space-8);
        }
        @media (max-width: 640px) {
          .app-layout__main {
            padding: var(--space-4);
            padding-bottom: 100px;
          }
          .app-layout__topbar {
            padding: 10px 16px;
          }
        }
      `}</style>
    </div>
  );
}
