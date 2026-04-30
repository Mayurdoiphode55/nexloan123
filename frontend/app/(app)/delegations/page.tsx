"use client";

import React, { useEffect, useState } from "react";
import { delegationAPI, userAPI } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface Delegation {
  id: string;
  delegator_name: string;
  delegate_name: string;
  permissions: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const PERMISSION_OPTIONS = [
  { value: "KYC_APPROVE", label: "Approve KYC" },
  { value: "KYC_REJECT", label: "Reject KYC" },
  { value: "LOAN_DISBURSE", label: "Disburse Loans" },
  { value: "UNDERWRITING_RUN", label: "Run Underwriting" },
  { value: "ANNOUNCEMENT_CREATE", label: "Create Announcements" },
  { value: "ENQUIRY_MANAGE", label: "Manage Enquiries" },
  { value: "USER_MANAGE", label: "Manage Users" },
];

export default function DelegationsPage() {
  const { showToast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({
    delegate_id: "",
    permissions: [] as string[],
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  });

  const fetchData = async () => {
    try {
      const [dRes, uRes] = await Promise.all([
        delegationAPI.getActive(),
        userAPI.list({ role: "ADMIN,LOAN_OFFICER" }),
      ]);
      setDelegations(dRes.data || []);
      setUsers(uRes.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const togglePermission = (perm: string) => {
    setForm(p => ({
      ...p,
      permissions: p.permissions.includes(perm)
        ? p.permissions.filter(x => x !== perm)
        : [...p.permissions, perm],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.delegate_id || form.permissions.length === 0 || !form.end_date) {
      showToast("Please fill all fields", "error");
      return;
    }
    setProcessing(true);
    try {
      await delegationAPI.create({
        delegate_id: form.delegate_id,
        permissions: form.permissions,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      showToast("Delegation created!", "success");
      setShowForm(false);
      setForm({ delegate_id: "", permissions: [], start_date: new Date().toISOString().split("T")[0], end_date: "" });
      fetchData();
    } catch { showToast("Failed to create delegation", "error"); }
    setProcessing(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this delegation?")) return;
    try {
      await delegationAPI.revoke(id);
      showToast("Delegation revoked", "success");
      fetchData();
    } catch { showToast("Failed to revoke", "error"); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700 }}>Delegations</h1>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: 4 }}>Temporarily assign permissions to other team members</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Delegation"}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="mb-6 animate-card-entrance">
          <form onSubmit={handleCreate}>
            <h3 style={{ fontWeight: 700, fontSize: "var(--text-md)", marginBottom: 16, color: "var(--text-primary)" }}>Create Delegation</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={labelStyle}>DELEGATE TO</label>
                <select value={form.delegate_id} onChange={e => setForm(p => ({ ...p, delegate_id: e.target.value }))} style={selectStyle} required>
                  <option value="" disabled>Select user</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>START DATE</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>END DATE</label>
                <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} style={inputStyle} required />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>PERMISSIONS</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {PERMISSION_OPTIONS.map(p => (
                  <button key={p.value} type="button" onClick={() => togglePermission(p.value)} style={{
                    padding: "6px 14px", borderRadius: "var(--radius-full)", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 150ms",
                    border: form.permissions.includes(p.value) ? "1px solid var(--accent-primary)" : "1px solid var(--surface-border)",
                    background: form.permissions.includes(p.value) ? "var(--accent-subtle)" : "transparent",
                    color: form.permissions.includes(p.value) ? "var(--accent-primary)" : "var(--text-secondary)",
                  }}>
                    {form.permissions.includes(p.value) ? "✓ " : ""}{p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" loading={processing}>Create Delegation</Button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <Card><p style={{ color: "var(--text-tertiary)", padding: 32, textAlign: "center" }}>Loading...</p></Card>
      ) : delegations.length === 0 ? (
        <Card>
          <div style={{ padding: 48, textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>🔐</span>
            <p style={{ fontWeight: 600, marginTop: 12 }}>No Active Delegations</p>
            <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-sm)", marginTop: 4 }}>Create one to temporarily transfer permissions.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {delegations.map(d => (
            <Card key={d.id} hover>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{d.delegator_name}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>→</span>
                    <span style={{ fontWeight: 700, fontSize: "var(--text-md)", color: "var(--accent-primary)" }}>{d.delegate_name}</span>
                    <Badge variant={d.is_active ? "success" : "neutral"}>{d.is_active ? "Active" : "Expired"}</Badge>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {d.permissions.map(p => (
                      <span key={p} style={{
                        padding: "3px 10px", borderRadius: "var(--radius-full)", fontSize: 11,
                        background: "var(--surface-sunken)", color: "var(--text-secondary)", fontWeight: 500,
                      }}>{p.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                  <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 8 }}>
                    {new Date(d.start_date).toLocaleDateString("en-IN")} — {new Date(d.end_date).toLocaleDateString("en-IN")}
                  </p>
                </div>
                {d.is_active && (
                  <Button size="sm" variant="destructive" onClick={() => handleRevoke(d.id)}>Revoke</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--text-tertiary)", display: "block", marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "var(--surface-sunken)", border: "1px solid var(--surface-border)",
  borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontFamily: "var(--font-body)", fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
};
