"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const userData = localStorage.getItem("nexloan_user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserName(user.full_name || "User");
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "mitesh@theoremlabs.com";
        setIsAdmin(user.email?.toLowerCase() === adminEmail.toLowerCase());
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

  const navLinks = [
    { name: "My Dashboard", path: "/dashboard", icon: "dashboard" },
    { name: "Apply for Loan", path: "/apply", icon: "apply" },
  ];

  if (isAdmin) {
    navLinks.push({ name: "Admin Panel", path: "/admin", icon: "admin" });
  }

  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
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
    logout: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="nexloan-sidebar">
        <div className="nexloan-sidebar__header">
          <h1 className="nexloan-sidebar__logo">NexLoan</h1>
          <p className="nexloan-sidebar__welcome">
            Welcome, {userName.split(" ")[0]}
          </p>
        </div>

        <nav className="nexloan-sidebar__nav">
          {navLinks.map((link) => {
            const isActive = pathname === link.path;
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
          const isActive = pathname === link.path;
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
          .nexloan-sidebar__logo {
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
