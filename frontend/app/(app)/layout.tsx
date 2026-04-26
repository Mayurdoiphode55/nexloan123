"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

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
            padding-bottom: 100px;
          }
        }
      `}</style>
    </div>
  );
}
