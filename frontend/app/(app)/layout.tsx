"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { useTenant } from "@/lib/tenant";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tenant = useTenant();
  const [isReady, setIsReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("BORROWER");
  const [userDept, setUserDept] = useState("");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("nexloan_token");
    const user = localStorage.getItem("nexloan_user");
    if (!token || !user) { router.push("/"); return; }
    try {
      const parsed = JSON.parse(user);
      setUserName(parsed.full_name || "User");
      setUserRole(parsed.role || "BORROWER");
      setUserDept(parsed.department || "");
      setUserPermissions(parsed.permissions || []);
    } catch {}
    // Load saved sidebar collapse state
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
    setIsReady(true);
  }, [router]);

  // Fetch pending task count for badge
  useEffect(() => {
    if (!isReady) return;
    const token = localStorage.getItem("nexloan_token");
    if (!token) return;
    fetch("/api/dashboard/pending-tasks", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setPendingCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [isReady]);

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  };

  if (!isReady) return null;

  const sidebarWidth = collapsed ? 56 : 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F9FAFB" }}>
      <Sidebar
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        pendingCount={pendingCount}
        userRole={userRole}
        userName={userName}
        userDept={userDept}
        userPermissions={userPermissions}
      />

      {/* Main content — shifts right by sidebar width */}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarWidth,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          transition: "margin-left 0.22s cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
        }}
        className="app-main"
      >
        {/* ── Top Bar ─────────────────── */}
        <header style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}>
          {/* Hamburger — mobile only */}
          <button
            className="topbar-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="18" y2="18" />
            </svg>
          </button>

          {/* Client logo (small) */}
          {tenant.logo_url
            ? <img src={tenant.logo_url} alt={tenant.client_name}
                style={{ height: 28, objectFit: "contain" }} />
            : <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
                {tenant.client_name}
              </span>
          }

          <div style={{ flex: 1 }} />

          <NotificationBell />

          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 16, borderLeft: "1px solid #E5E7EB" }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: "50%",
              background: "var(--accent-subtle, rgba(79,70,229,0.08))",
              color: "var(--client-primary, #4F46E5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13,
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }} className="topbar-user-meta">
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                {userName.split(" ")[0]}
              </span>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "#9CA3AF" }}>
                {userRole.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </header>

        {/* ── Page Content ───────────── */}
        <main style={{ flex: 1, padding: "24px 28px", overflowX: "hidden" }}>
          {children}
        </main>
      </div>

      <style>{`
        .topbar-hamburger {
          display: none;
          align-items: center; justify-content: center;
          width: 34px; height: 34px;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
          background: #F9FAFB;
          color: #6B7280;
          cursor: pointer;
          flex-shrink: 0;
        }
        .topbar-hamburger:hover { background: #F3F4F6; color: #374151; }

        @media (max-width: 1024px) {
          .app-main { margin-left: 0 !important; }
          .topbar-hamburger { display: flex !important; }
        }
        @media (max-width: 640px) {
          .topbar-user-meta { display: none; }
          main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
