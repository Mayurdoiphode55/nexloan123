'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTenant } from '@/lib/tenant';
import {
  LayoutDashboard, FileText, MapPin, Download, Scale,
  Headset, LogOut, ChevronLeft, ChevronRight, Users,
  Settings, BarChart3, BookOpen, Bell, Shield, AlertTriangle,
  PieChart, TrendingUp, Briefcase, Upload, Code, FlaskConical,
  Siren, FileBarChart, Ban, Banknote
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pendingCount?: number;
  userRole?: string;
  userName?: string;
  userDept?: string;
  userPermissions?: string[];
}

const NAV_BORROWER = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/apply', label: 'Apply', icon: FileText },
  { href: '/track', label: 'Track Application', icon: MapPin },
  { href: '/topup', label: 'Loan Top-Up', icon: TrendingUp },
  { href: '/offers', label: 'My Offers', icon: Banknote },
  { href: '/referrals', label: 'Refer & Earn', icon: Users },
  { href: '/compare', label: 'Loan Comparison', icon: BookOpen },
  { href: '/enquiry', label: 'Service Enquiry', icon: Bell },
  { href: '/support', label: 'Support', icon: Headset },
];

const NAV_EMPLOYEE = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'VIEW_DASHBOARD_OPS' },
  { href: '/officer', label: 'Work Queue', icon: BarChart3, permission: 'VIEW_ALL_LOANS' },
  { href: '/admin', label: 'Admin Panel', icon: Settings, permission: 'VIEW_ADMIN_METRICS' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'CHANGE_SETTINGS' },
  { href: '/admin/users', label: 'User Management', icon: Users, permission: 'USER_MANAGE' },
  { href: '/admin/media', label: 'Media Library', icon: Download, permission: 'MANAGE_ANNOUNCEMENTS' },
  { href: '/enquiries', label: 'Enquiries', icon: FileText, permission: 'VIEW_ENQUIRIES' },
  { href: '/delegations', label: 'Delegations', icon: Users, permission: 'DELEGATE_ADMIN' },
  // Phase 5 — Revenue & Business
  { href: '/admin/rate-rules', label: 'Rate Rules', icon: Banknote, permission: 'CHANGE_SETTINGS' },
  // Phase 5 — Risk & Compliance
  { href: '/admin/fraud-flags', label: 'Fraud Detection', icon: AlertTriangle, permission: 'CHANGE_SETTINGS' },
  { href: '/admin/blacklist', label: 'Blacklist', icon: Ban, permission: 'CHANGE_SETTINGS' },
  { href: '/admin/collections', label: 'Collections', icon: Shield, permission: 'CHANGE_SETTINGS' },
  { href: '/admin/portfolio', label: 'Portfolio Risk', icon: PieChart, permission: 'VIEW_ADMIN_METRICS' },
  // Phase 5 — Operations
  { href: '/admin/agents', label: 'Agent Management', icon: Briefcase, permission: 'USER_MANAGE' },
  { href: '/admin/bulk-upload', label: 'Bulk Upload', icon: Upload, permission: 'USER_MANAGE' },
  { href: '/admin/api-clients', label: 'API Clients', icon: Code, permission: 'CHANGE_SETTINGS' },
  // Phase 5 — Analytics & Intelligence
  { href: '/admin/analytics', label: 'Cohort Analytics', icon: TrendingUp, permission: 'VIEW_ADMIN_METRICS' },
  { href: '/admin/experiments', label: 'A/B Testing', icon: FlaskConical, permission: 'CHANGE_SETTINGS' },
  { href: '/admin/early-warning', label: 'Early Warning', icon: Siren, permission: 'VIEW_ADMIN_METRICS' },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart, permission: 'VIEW_ADMIN_METRICS' },
];

const NAV_AGENT = [
  { href: '/agent', label: 'Agent Portal', icon: Briefcase },
  { href: '/apply', label: 'New Application', icon: FileText },
  { href: '/support', label: 'Support', icon: Headset },
];

export default function Sidebar({
  isOpen, onClose, collapsed, onToggleCollapse,
  pendingCount = 0, userRole = 'BORROWER', userName = '', userDept = '', userPermissions = [],
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tenant = useTenant();

  let navItems =
    ['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER', 'VERIFIER', 'UNDERWRITER'].includes(userRole) ? NAV_EMPLOYEE
    : userRole === 'AGENT' ? NAV_AGENT
    : NAV_BORROWER;

  // Hide nav items if the user lacks the required permission (SUPER_ADMIN always sees everything)
  if (['ADMIN', 'LOAN_OFFICER', 'VERIFIER', 'UNDERWRITER'].includes(userRole)) {
    navItems = navItems.filter((item: any) => !item.permission || userPermissions.includes(item.permission));
  }

  const handleLogout = () => {
    localStorage.removeItem('nexloan_token');
    localStorage.removeItem('nexloan_user');
    router.push('/');
  };

  const primary = tenant.primary_color || '#4F46E5';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 199,
            display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}

      <aside
        className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${isOpen ? 'sidebar--mobile-open' : ''}`}
        style={{ '--sidebar-primary': primary } as React.CSSProperties}
      >
        {/* ── Logo / Brand ─────────────────── */}
        <div className="sidebar__logo">
          {!collapsed && (
            tenant.logo_url
              ? <img src={tenant.logo_url} alt={tenant.client_name} style={{ height: 32, objectFit: 'contain' }} />
              : <span className="sidebar__brand-name">{tenant.client_name}</span>
          )}
          <button
            className="sidebar__collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        <div className="sidebar__divider" />

        {/* ── Nav Links ────────────────────── */}
        <nav className="sidebar__nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const isDashboard = item.href === '/dashboard';
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); onClose(); }}
                className={`sidebar__nav-item ${active ? 'sidebar__nav-item--active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar__nav-icon">
                  <Icon size={16} />
                  {isDashboard && pendingCount > 0 && (
                    <span className="sidebar__badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                  )}
                </span>
                {!collapsed && <span className="sidebar__nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* ── Bottom: dept + logout ─────────── */}
        <div style={{ flex: 1 }} />
        <div className="sidebar__divider" />

        {!collapsed && userDept && (
          <div className="sidebar__dept">
            <span className="sidebar__dept-label">DEPARTMENT</span>
            <span className="sidebar__dept-value">{userDept}</span>
          </div>
        )}

        <button className="sidebar__logout" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
          {!collapsed && <span>Logout</span>}
        </button>
      </aside>

      <style>{`
        .sidebar {
          width: var(--sidebar-width, 220px);
          height: 100vh;
          background: #FFFFFF;
          border-right: 1px solid #E5E7EB;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0;
          z-index: 200;
          transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        .sidebar--collapsed {
          width: 56px;
        }

        /* Logo area */
        .sidebar__logo {
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 14px;
          gap: 8px;
          justify-content: space-between;
          flex-shrink: 0;
        }
        .sidebar__brand-name {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar__collapse-btn {
          width: 26px; height: 26px;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
          background: #F9FAFB;
          color: #6B7280;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .sidebar__collapse-btn:hover {
          background: #F3F4F6;
          color: #374151;
        }

        /* Divider */
        .sidebar__divider {
          height: 1px;
          background: #E5E7EB;
          margin: 4px 0;
          flex-shrink: 0;
        }

        /* Nav */
        .sidebar__nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px 8px;
          overflow-y: auto;
        }
        .sidebar__nav-item {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 10px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #6B7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          white-space: nowrap;
          transition: background 0.12s, color 0.12s;
          width: 100%;
          position: relative;
        }
        .sidebar__nav-item:hover {
          background: #F9FAFB;
          color: #374151;
        }
        .sidebar__nav-item--active {
          background: #F3F4F6;
          color: var(--sidebar-primary, #4F46E5);
          border-left: 2px solid var(--sidebar-primary, #4F46E5);
          padding-left: 8px;
          font-weight: 600;
        }
        .sidebar__nav-icon {
          position: relative;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar__nav-label {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Pending badge */
        .sidebar__badge {
          position: absolute;
          top: -5px; right: -6px;
          background: #DC2626;
          color: white;
          font-size: 9px;
          font-weight: 700;
          border-radius: 9999px;
          padding: 1px 4px;
          line-height: 1.4;
        }

        /* Department */
        .sidebar__dept {
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sidebar__dept-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9CA3AF;
        }
        .sidebar__dept-value {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
        }

        /* Logout */
        .sidebar__logout {
          height: 40px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          margin: 6px 8px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #6B7280;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          width: calc(100% - 16px);
          white-space: nowrap;
        }
        .sidebar__logout:hover {
          background: #FEF2F2;
          color: #DC2626;
        }

        /* Mobile: hidden by default, shown when isOpen */
        .sidebar-overlay { display: none !important; }

        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.22s ease, width 0.22s ease;
            width: var(--sidebar-width, 220px) !important;
          }
          .sidebar--mobile-open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
