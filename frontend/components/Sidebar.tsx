"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { UserRole } from "@/types/loan";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole>("BORROWER");
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const userData = localStorage.getItem("nexloan_user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserName(user.full_name || "User");
        setUserRole(user.role || "BORROWER");
      } catch (err) {
        console.error("Failed to parse user data", err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("nexloan_token");
    localStorage.removeItem("nexloan_user");
    router.push("/");
  };

  // Build navigation links based on role
  const navLinks: { name: string; path: string; icon: string }[] = [];

  // BORROWER links (also visible to LOAN_OFFICER so they can test everything)
  if (userRole === "BORROWER" || userRole === "LOAN_OFFICER") {
    navLinks.push(
      { name: "My Dashboard", path: "/dashboard", icon: "dashboard" },
      { name: "Track Loan", path: "/track", icon: "track" },
      { name: "Apply for Loan", path: "/apply", icon: "apply" },
      { name: "Compare Loans", path: "/compare", icon: "compare" },
    );
  }

  // LOAN_OFFICER-only links
  if (userRole === "LOAN_OFFICER") {
    navLinks.push(
      { name: "Officer Queue", path: "/officer", icon: "queue" },
    );
  }

  // ADMIN links
  if (userRole === "ADMIN" || userRole === "SUPER_ADMIN" || userRole === "LOAN_OFFICER") {
    navLinks.push(
      { name: "Admin Panel", path: "/admin", icon: "admin" },
    );
  }

  // Role badge colors
  const roleBadge: Record<string, { label: string; color: string }> = {
    BORROWER: { label: "Borrower", color: "var(--accent-400)" },
    LOAN_OFFICER: { label: "Officer", color: "var(--color-warning)" },
    ADMIN: { label: "Admin", color: "var(--color-error)" },
    SUPER_ADMIN: { label: "Super Admin", color: "#f43f5e" },
  };

  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    track: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    apply: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    admin: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    users: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    queue: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    ),
    compare: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="3" x2="12" y2="21" />
        <polyline points="8 8 4 12 8 16" />
        <polyline points="16 8 20 12 16 16" />
      </svg>
    ),
    logout: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  };

  const badge = roleBadge[userRole] || roleBadge.BORROWER;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="nexloan-sidebar">
        <div className="nexloan-sidebar__header">
          <h1 className="nexloan-sidebar__logo">NexLoan</h1>
          <p className="nexloan-sidebar__welcome">
            Welcome, {userName.split(" ")[0]}
          </p>
          <span
            className="nexloan-sidebar__role-badge"
            style={{ color: badge.color, borderColor: badge.color }}
          >
            {badge.label}
          </span>
        </div>

        <nav className="nexloan-sidebar__nav">
          {navLinks.map((link) => {
            const isActive = pathname === link.path || pathname.startsWith(link.path + "/");
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`nexloan-sidebar__link ${isActive ? "nexloan-sidebar__link--active" : ""}`}
              >
                <span className="nexloan-sidebar__link-icon">{icons[link.icon]}</span>
                <span className="nexloan-sidebar__link-text">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="nexloan-sidebar__footer">
          <button onClick={handleLogout} className="nexloan-sidebar__logout">
            <span className="nexloan-sidebar__link-icon">{icons.logout}</span>
            <span className="nexloan-sidebar__link-text">Log Out</span>
          </button>
        </div>

        <div className="nexloan-sidebar__theme-toggle">
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="nexloan-bottom-nav">
        {navLinks.map((link) => {
          const isActive = pathname === link.path || pathname.startsWith(link.path + "/");
          return (
            <Link
              key={link.path}
              href={link.path}
              className={`nexloan-bottom-nav__item ${isActive ? "nexloan-bottom-nav__item--active" : ""}`}
            >
              {icons[link.icon]}
              <span>{link.name.split(" ").pop()}</span>
            </Link>
          );
        })}
        <button onClick={handleLogout} className="nexloan-bottom-nav__item">
          {icons.logout}
          <span>Logout</span>
        </button>
      </nav>

      <style jsx global>{`
        /* ── Desktop Sidebar ───────────────── */
        .nexloan-sidebar {
          position: sticky;
          top: 0;
          width: 240px;
          height: 100vh;
          background: var(--surface-raised);
          border-right: 1px solid var(--surface-border);
          display: flex;
          flex-direction: column;
          transition: all var(--transition-base);
          flex-shrink: 0;
        }

        .nexloan-sidebar__header {
          padding: var(--space-6) var(--space-6) var(--space-4);
        }

        .nexloan-sidebar__logo {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .nexloan-sidebar__welcome {
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: var(--space-1);
        }

        .nexloan-sidebar__role-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 1px solid;
          border-radius: 100px;
          padding: 2px 10px;
          margin-top: var(--space-2);
        }

        .nexloan-sidebar__nav {
          flex: 1;
          padding: var(--space-4);
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .nexloan-sidebar__link {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          color: var(--text-secondary);
          font-weight: 500;
          font-size: var(--text-sm);
          text-decoration: none;
          transition: all var(--transition-fast);
          border-left: 3px solid transparent;
        }

        .nexloan-sidebar__link:hover {
          color: var(--text-primary);
          background: var(--surface-border);
        }

        .nexloan-sidebar__link--active {
          color: var(--text-primary);
          background: rgba(124, 58, 237, 0.10);
          border-left-color: var(--accent-400);
        }

        .nexloan-sidebar__link-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .nexloan-sidebar__footer {
          padding: var(--space-4);
          border-top: 1px solid var(--surface-border);
        }

        .nexloan-sidebar__logout {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          background: none;
          border: none;
          color: var(--text-tertiary);
          font-family: var(--font-body);
          font-weight: 500;
          font-size: var(--text-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .nexloan-sidebar__logout:hover {
          color: var(--color-error);
          background: rgba(239, 68, 68, 0.08);
        }

        .nexloan-sidebar__theme-toggle {
          display: none;
        }

        /* ── Mobile Bottom Nav ────────────── */
        .nexloan-bottom-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 90;
          background: var(--surface-raised);
          border-top: 1px solid var(--surface-border);
          padding: var(--space-2) 0;
        }

        .nexloan-bottom-nav__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: var(--space-1) var(--space-2);
          color: var(--text-tertiary);
          font-size: 10px;
          font-weight: 500;
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          transition: color var(--transition-fast);
        }

        .nexloan-bottom-nav__item--active {
          color: var(--accent-400);
        }

        .nexloan-bottom-nav__item:hover {
          color: var(--text-primary);
        }

        /* ── Responsive ──────────────────── */
        @media (max-width: 1024px) {
          .nexloan-sidebar {
            width: 64px;
          }
          .nexloan-sidebar__link-text,
          .nexloan-sidebar__welcome,
          .nexloan-sidebar__logo,
          .nexloan-sidebar__role-badge {
            display: none;
          }
          .nexloan-sidebar__header {
            padding: var(--space-4);
          }
          .nexloan-sidebar__link {
            justify-content: center;
            padding: var(--space-3);
            border-left: none;
            border-radius: var(--radius-md);
          }
          .nexloan-sidebar__logout {
            justify-content: center;
          }
        }

        @media (max-width: 640px) {
          .nexloan-sidebar {
            display: none;
          }
          .nexloan-bottom-nav {
            display: flex;
            justify-content: space-around;
            align-items: center;
          }
        }
      `}</style>
    </>
  );
}
