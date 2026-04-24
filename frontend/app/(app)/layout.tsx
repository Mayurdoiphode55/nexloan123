"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";

// DEV: Token is injected synchronously by the inline script in app/layout.tsx.
// No auth checks needed here — just render the layout immediately.

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout__content">
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
        .app-layout__main {
          flex: 1;
          padding: var(--space-8);
        }
        @media (max-width: 640px) {
          .app-layout__main {
            padding: var(--space-4);
            padding-bottom: 100px; /* Safe space for bottom nav + browser bars */
          }
        }
      `}</style>
    </div>
  );
}
