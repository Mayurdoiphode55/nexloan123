"use client";

import React, { useEffect, useState } from "react";
import { enquiryAPI } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

interface Enquiry {
  id: string; full_name: string; mobile: string; email?: string;
  loan_type?: string; approx_amount?: number; message?: string;
  status: string; claimed_by_name?: string; created_at: string;
}

export default function EnquiriesPage() {
  const { showToast } = useToast();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchData = () => {
    enquiryAPI.getQueue(filter || undefined)
      .then(r => setEnquiries(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleClaim = async (id: string) => {
    setProcessing(id);
    try { await enquiryAPI.claim(id); showToast("Enquiry claimed!", "success"); fetchData(); }
    catch { showToast("Failed to claim", "error"); }
    finally { setProcessing(null); }
  };

  const handleConvert = async (id: string) => {
    setProcessing(id);
    try { const r = await enquiryAPI.convert(id); showToast(`Converted to ${r.data.loan_number}`, "success"); fetchData(); }
    catch { showToast("Failed to convert", "error"); }
    finally { setProcessing(null); }
  };

  const statusVariant = (s: string) => {
    if (s === "NEW") return "info" as const;
    if (s === "CLAIMED") return "warning" as const;
    if (s === "CONVERTED") return "success" as const;
    return "neutral" as const;
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 700 }}>Loan Enquiries</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {["", "NEW", "CLAIMED", "CONVERTED"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--surface-border)',
              background: filter === f ? 'var(--accent-subtle)' : 'transparent',
              color: filter === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              {f || "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card><p style={{ color: 'var(--text-tertiary)', padding: 32, textAlign: 'center' }}>Loading...</p></Card>
      ) : enquiries.length === 0 ? (
        <Card><p style={{ color: 'var(--text-tertiary)', padding: 32, textAlign: 'center' }}>No enquiries found.</p></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {enquiries.map(e => (
            <Card key={e.id} hover>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{e.full_name}</span>
                    <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <span>📱 {e.mobile}</span>
                    {e.email && <span>✉️ {e.email}</span>}
                    {e.loan_type && <span>📋 {e.loan_type}</span>}
                    {e.approx_amount && <span>💰 ₹{e.approx_amount.toLocaleString('en-IN')}</span>}
                  </div>
                  {e.message && <p style={{ marginTop: 8, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.message}</p>}
                  {e.claimed_by_name && <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>Claimed by: {e.claimed_by_name}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {e.status === "NEW" && <Button size="sm" onClick={() => handleClaim(e.id)} loading={processing === e.id}>Claim</Button>}
                  {(e.status === "CLAIMED" || e.status === "RESPONDED") && <Button size="sm" onClick={() => handleConvert(e.id)} loading={processing === e.id}>Convert to Loan</Button>}
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                {new Date(e.created_at).toLocaleString('en-IN')}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
