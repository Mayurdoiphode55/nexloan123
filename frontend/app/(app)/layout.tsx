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
      <Sidebar />
      <div className="app-layout__content">
        <header className="app-layout__topbar">
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
          padding: 12px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,10,0.8);
          backdrop-filter: blur(12px);
          position: sticky;
          top: 0;
          z-index: 50;
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
        }
      `}</style>
    </div>
  );
}
