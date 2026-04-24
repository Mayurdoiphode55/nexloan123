"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { userAPI } from "@/lib/api";
import { getUserRole } from "@/lib/auth";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import type { UserListItem, UserRole } from "@/types/loan";

export default function UserManagementPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const currentRole = getUserRole();

  // Form state
  const [officerName, setOfficerName] = useState("");
  const [officerEmail, setOfficerEmail] = useState("");
  const [officerMobile, setOfficerMobile] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filter !== "ALL") params.role = filter;
      if (search.trim()) params.search = search.trim();
      const res = await userAPI.list(params);
      setUsers(res.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        showToast("You don't have permission to access this page.", "error");
        router.push("/dashboard");
      } else {
        console.error("Failed to load users", err);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search, router, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateOfficer = async () => {
    if (!officerName.trim() || !officerEmail.trim() || !officerMobile.trim()) {
      showToast("All fields are required.", "error");
      return;
    }
    try {
      setCreating(true);
      await userAPI.createOfficer({
        full_name: officerName.trim(),
        email: officerEmail.trim(),
        mobile: officerMobile.trim(),
      });
      showToast("Loan Officer account created. OTP sent to their email. ✅", "success");
      setShowModal(false);
      setOfficerName("");
      setOfficerEmail("");
      setOfficerMobile("");
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to create officer account.";
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentlyActive: boolean) => {
    try {
      await userAPI.changeStatus(userId, !currentlyActive);
      showToast(`User ${currentlyActive ? "deactivated" : "activated"} successfully.`, "success");
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to update status.";
      showToast(msg, "error");
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await userAPI.changeRole(userId, newRole);
      showToast("Role updated successfully.", "success");
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to update role.";
      showToast(msg, "error");
    }
  };

  const roleBadgeVariant = (role: string): "accent" | "warning" | "error" | "info" => {
    switch (role) {
      case "LOAN_OFFICER": return "warning";
      case "ADMIN": return "error";
      case "SUPER_ADMIN": return "error";
      default: return "accent";
    }
  };

  const filterTabs = [
    { label: "All", value: "ALL" },
    { label: "Borrowers", value: "BORROWER" },
    { label: "Officers", value: "LOAN_OFFICER" },
    { label: "Admins", value: "ADMIN" },
  ];

  return (
    <div className="user-mgmt">
      {/* Header */}
      <div className="user-mgmt__header">
        <div>
          <h1 className="user-mgmt__title">User Management</h1>
          <p className="user-mgmt__subtitle">{users.length} users total</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Create Loan Officer</Button>
      </div>

      {/* Filters */}
      <div className="user-mgmt__filters">
        <div className="user-mgmt__tabs">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              className={`user-mgmt__tab ${filter === tab.value ? "user-mgmt__tab--active" : ""}`}
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="user-mgmt__search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="user-mgmt__loading">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="user-mgmt__skeleton-row" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="user-mgmt__empty">No users found.</div>
        ) : (
          <div className="user-mgmt__table-wrapper">
            <table className="user-mgmt__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="user-mgmt__name">{user.full_name}</td>
                    <td className="user-mgmt__email">{user.email}</td>
                    <td>
                      <Badge variant={roleBadgeVariant(user.role)}>
                        {user.role.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td>
                      <span className={`user-mgmt__status ${user.is_active ? "user-mgmt__status--active" : "user-mgmt__status--inactive"}`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="user-mgmt__date">
                      {new Date(user.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="user-mgmt__actions">
                      <button
                        className="user-mgmt__action-btn"
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        title={user.is_active ? "Deactivate" : "Activate"}
                      >
                        {user.is_active ? "🔒" : "🔓"}
                      </button>
                      {currentRole === "SUPER_ADMIN" && (
                        <select
                          className="user-mgmt__role-select"
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        >
                          <option value="BORROWER">Borrower</option>
                          <option value="LOAN_OFFICER">Loan Officer</option>
                          <option value="ADMIN">Admin</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Officer Modal */}
      {showModal && (
        <div className="um-modal-overlay">
          <div className="um-modal animate-card-entrance">
            <div className="um-modal__header">
              <h2 className="um-modal__title">Create Loan Officer</h2>
              <button onClick={() => setShowModal(false)} className="um-modal__close">×</button>
            </div>
            <div className="um-modal__body">
              <label className="um-modal__label">
                Full Name
                <input
                  type="text"
                  className="um-modal__input"
                  placeholder="Officer full name"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                />
              </label>
              <label className="um-modal__label">
                Email
                <input
                  type="email"
                  className="um-modal__input"
                  placeholder="officer@company.com"
                  value={officerEmail}
                  onChange={(e) => setOfficerEmail(e.target.value)}
                />
              </label>
              <label className="um-modal__label">
                Mobile (10 digits)
                <input
                  type="text"
                  className="um-modal__input"
                  placeholder="9876543210"
                  value={officerMobile}
                  onChange={(e) => setOfficerMobile(e.target.value)}
                  maxLength={10}
                />
              </label>
            </div>
            <div className="um-modal__footer">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCreateOfficer} loading={creating}>
                Create & Send OTP
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .user-mgmt {
          max-width: 1100px;
          margin: 0 auto;
        }

        .user-mgmt__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--space-6);
        }

        .user-mgmt__title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 700;
        }

        .user-mgmt__subtitle {
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          margin-top: 4px;
        }

        .user-mgmt__filters {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
          gap: var(--space-4);
          flex-wrap: wrap;
        }

        .user-mgmt__tabs {
          display: flex;
          gap: 2px;
          background: var(--surface-sunken);
          border-radius: var(--radius-md);
          padding: 2px;
        }

        .user-mgmt__tab {
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-secondary);
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-body);
        }

        .user-mgmt__tab--active {
          background: var(--surface-raised);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .user-mgmt__search {
          padding: var(--space-2) var(--space-4);
          font-size: var(--text-sm);
          background: var(--surface-raised);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          outline: none;
          min-width: 240px;
          transition: border-color var(--transition-fast);
        }
        .user-mgmt__search:focus {
          border-color: var(--accent-400);
        }
        .user-mgmt__search::placeholder {
          color: var(--text-tertiary);
        }

        /* Table */
        .user-mgmt__table-wrapper {
          overflow-x: auto;
        }

        .user-mgmt__table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--text-sm);
        }

        .user-mgmt__table th {
          text-align: left;
          padding: var(--space-3) var(--space-4);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          border-bottom: 1px solid var(--surface-border);
        }

        .user-mgmt__table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--surface-border);
          color: var(--text-secondary);
          vertical-align: middle;
        }

        .user-mgmt__table tr:last-child td {
          border-bottom: none;
        }

        .user-mgmt__table tr:hover td {
          background: rgba(124, 58, 237, 0.03);
        }

        .user-mgmt__name {
          font-weight: 600;
          color: var(--text-primary) !important;
        }

        .user-mgmt__email {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
        }

        .user-mgmt__date {
          font-size: var(--text-xs);
          color: var(--text-tertiary) !important;
        }

        .user-mgmt__status {
          font-size: var(--text-xs);
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 100px;
        }
        .user-mgmt__status--active {
          color: var(--color-success);
          background: rgba(34, 197, 94, 0.1);
        }
        .user-mgmt__status--inactive {
          color: var(--color-error);
          background: rgba(239, 68, 68, 0.1);
        }

        .user-mgmt__actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .user-mgmt__action-btn {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: background var(--transition-fast);
        }
        .user-mgmt__action-btn:hover {
          background: var(--surface-sunken);
        }

        .user-mgmt__role-select {
          padding: 4px 8px;
          font-size: var(--text-xs);
          background: var(--surface-sunken);
          color: var(--text-primary);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          cursor: pointer;
          outline: none;
        }

        .user-mgmt__loading {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          padding: var(--space-4);
        }
        .user-mgmt__skeleton-row {
          height: 40px;
          background: var(--surface-sunken);
          border-radius: var(--radius-sm);
          animation: skelrow 1.5s infinite;
        }
        @keyframes skelrow { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

        .user-mgmt__empty {
          padding: var(--space-8);
          text-align: center;
          color: var(--text-tertiary);
        }

        /* ── Modal ────────────────────────── */
        .um-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
        }

        .um-modal {
          background: var(--surface-raised);
          width: 100%;
          max-width: 480px;
          border-radius: var(--radius-xl);
          border: 1px solid var(--surface-border);
          box-shadow: var(--shadow-lg);
        }

        .um-modal__header {
          padding: var(--space-5) var(--space-6);
          border-bottom: 1px solid var(--surface-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .um-modal__title {
          font-size: var(--text-lg);
          font-weight: 700;
        }

        .um-modal__close {
          background: none;
          border: none;
          color: var(--text-tertiary);
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
        }

        .um-modal__body {
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .um-modal__label {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .um-modal__input {
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          background: var(--surface-base);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          outline: none;
          transition: border-color var(--transition-fast);
          text-transform: none;
          letter-spacing: normal;
          font-weight: 400;
        }
        .um-modal__input:focus {
          border-color: var(--accent-400);
        }

        .um-modal__footer {
          padding: var(--space-4) var(--space-6);
          border-top: 1px solid var(--surface-border);
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3);
        }

        @media (max-width: 768px) {
          .user-mgmt__filters {
            flex-direction: column;
            align-items: stretch;
          }
          .user-mgmt__search {
            min-width: unset;
          }
        }
      `}</style>
    </div>
  );
}
