"use client";

import React, { useEffect, useState } from "react";
import { supportAPI } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

export default function BorrowerSupportPage() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: "", description: "" });
  const [busy, setBusy] = useState(false);

  const fetchTickets = () => {
    setLoading(true);
    supportAPI.listTickets()
      .then((res) => setTickets(res.data))
      .catch(() => showToast("Failed to load tickets", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.description) return;
    setBusy(true);
    try {
      await supportAPI.createTicket(form);
      showToast("Ticket submitted successfully", "success");
      setForm({ subject: "", description: "" });
      fetchTickets();
    } catch {
      showToast("Failed to submit ticket", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 40 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Support & Helpdesk</h1>

      <Card style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Raise a New Ticket</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Subject</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. Issue with EMI payment"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 14 }}
              required
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Please describe your issue in detail..."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 14, resize: "vertical" }}
              required
            />
          </div>
          <div>
            <Button type="submit" loading={busy}>Submit Ticket</Button>
          </div>
        </form>
      </Card>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Your Previous Tickets</h2>
      {loading ? (
        <p style={{ color: "#6B7280" }}>Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "40px 20px" }}>
          <p style={{ color: "#6B7280" }}>You have no support tickets.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map((t) => (
            <Card key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{t.subject}</h3>
                <p style={{ fontSize: 12, color: "#6B7280" }}>{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 12, background: t.status === "CLOSED" ? "#F3F4F6" : "#FEF3C7", color: t.status === "CLOSED" ? "#374151" : "#B45309", fontWeight: 600 }}>
                  {t.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
