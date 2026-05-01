'use client';

import { useState, useEffect } from 'react';
import { configAPI } from '@/lib/api';
import { useTenant } from '@/lib/tenant';

type Tab = 'branding' | 'loan_products' | 'preclosure' | 'notifications' | 'team' | 'delegation';

// ── Sub-components defined OUTSIDE the page to prevent focus loss on re-render ──

function Field({ label, type = 'text', value, onChange, hint }: any) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{hint}</p>}
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 6,
          fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}

function Toggle({ label, value, onChange, hint, primary }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{label}</p>
        {hint && <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: value ? primary : '#D1D5DB', cursor: 'pointer',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 3,
          left: value ? 22 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

function SaveButton({ onClick, label = 'Save Changes', saving, saved, error, primary }: any) {
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #F3F4F6', display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={onClick} disabled={saving}
        style={{ padding: '10px 24px', background: primary, color: '#fff', border: 'none',
          borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Saving…' : label}
      </button>
      {saved && <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>{saved}</span>}
      {error && <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'branding', label: 'Branding', icon: '🎨' },
  { id: 'loan_products', label: 'Loan Products', icon: '💳' },
  { id: 'preclosure', label: 'Pre-Closure', icon: '🔒' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'delegation', label: 'Delegation', icon: '🤝' },
];

export default function AdminSettingsPage() {
  const tenant = useTenant();
  const [activeTab, setActiveTab] = useState<Tab>('branding');
  const [cfg, setCfg] = useState<Record<string, any>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const primary = tenant.primary_color || '#4F46E5';

  useEffect(() => {
    const token = localStorage.getItem('nexloan_token');
    if (!token) return;
    configAPI.getAdmin().then(r => setCfg(r.data)).catch(() => {});

    const h = { Authorization: `Bearer ${token}` };
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    fetch(`${base}/api/users/employees`, { headers: h }).then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${base}/api/delegation/active`, { headers: h }).then(r => r.json()).then(d => setDelegations(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const save = async (updates: Record<string, any>) => {
    setSaving(true); setSaved(''); setError('');
    try {
      await configAPI.update(updates);
      setCfg(prev => ({ ...prev, ...updates }));
      setSaved('Settings saved ✓');
      setTimeout(() => setSaved(''), 2500);
    } catch { setError('Failed to save settings.'); }
    finally { setSaving(false); }
  };



  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>Configure your white-label platform.</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Tab list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                background: activeTab === tab.id ? '#F3F4F6' : 'transparent',
                borderLeft: activeTab === tab.id ? `2px solid ${primary}` : '2px solid transparent',
                border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? primary : '#374151', textAlign: 'left',
              }}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '24px 28px' }}>

          {/* ── BRANDING ────────────────── */}
          {activeTab === 'branding' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Brand Identity</h2>
              <Field label="Client / Institution Name *" value={cfg.client_name}
                onChange={(v: string) => setCfg(p => ({ ...p, client_name: v }))} />
              <Field label="Tagline" value={cfg.tagline}
                onChange={(v: string) => setCfg(p => ({ ...p, tagline: v }))}
                hint="Shown on the login page below your logo." />
              <Field label="Logo URL" value={cfg.logo_url}
                onChange={(v: string) => setCfg(p => ({ ...p, logo_url: v }))}
                hint="Direct URL to your logo image (SVG or PNG recommended)." />
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Primary Brand Color
                </label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <input type="color" value={cfg.primary_color || '#4F46E5'}
                    onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))}
                    style={{ width: 48, height: 40, border: '1px solid #E5E7EB', borderRadius: 6, cursor: 'pointer' }} />
                  <input value={cfg.primary_color || '#4F46E5'}
                    onChange={e => setCfg(p => ({ ...p, primary_color: e.target.value }))}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 14 }} />
                </div>
              </div>
              <Field label="Registered Legal Name" value={cfg.registered_name}
                onChange={(v: string) => setCfg(p => ({ ...p, registered_name: v }))} />
              <Field label="RBI Registration Number" value={cfg.rbi_registration}
                onChange={(v: string) => setCfg(p => ({ ...p, rbi_registration: v }))} />
              <Field label="Support Email" type="email" value={cfg.support_email}
                onChange={(v: string) => setCfg(p => ({ ...p, support_email: v }))} />
              <Field label="Support Phone" type="tel" value={cfg.support_phone}
                onChange={(v: string) => setCfg(p => ({ ...p, support_phone: v }))} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '20px 0 12px' }}>Announcement Banner</h3>
              <Toggle label="Show Announcement Banner" value={cfg.announcement_active}
                onChange={(v: boolean) => setCfg(p => ({ ...p, announcement_active: v }))} primary={primary} />
              <Field label="Announcement Text" value={cfg.announcement_text}
                onChange={(v: string) => setCfg(p => ({ ...p, announcement_text: v }))} />
              <SaveButton onClick={() => save({
                client_name: cfg.client_name, tagline: cfg.tagline, logo_url: cfg.logo_url,
                primary_color: cfg.primary_color, registered_name: cfg.registered_name,
                rbi_registration: cfg.rbi_registration, support_email: cfg.support_email,
                support_phone: cfg.support_phone, announcement_active: cfg.announcement_active,
                announcement_text: cfg.announcement_text,
              })} primary={primary} saving={saving} saved={saved} error={error} />
            </div>
          )}

          {/* ── LOAN PRODUCTS ────────────── */}
          {activeTab === 'loan_products' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Loan Product Configuration</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Min Loan Amount (₹)" type="number" value={cfg.min_loan_amount}
                  onChange={(v: string) => setCfg(p => ({ ...p, min_loan_amount: Number(v) }))} />
                <Field label="Max Loan Amount (₹)" type="number" value={cfg.max_loan_amount}
                  onChange={(v: string) => setCfg(p => ({ ...p, max_loan_amount: Number(v) }))} />
                <Field label="Min Tenure (months)" type="number" value={cfg.min_tenure_months}
                  onChange={(v: string) => setCfg(p => ({ ...p, min_tenure_months: Number(v) }))} />
                <Field label="Max Tenure (months)" type="number" value={cfg.max_tenure_months}
                  onChange={(v: string) => setCfg(p => ({ ...p, max_tenure_months: Number(v) }))} />
              </div>
              <Toggle label="Enable Collateral Loans" value={cfg.feature_collateral_loans}
                onChange={(v: boolean) => setCfg(p => ({ ...p, feature_collateral_loans: v }))}
                hint="Allows borrowers to apply with collateral (gold, property, vehicle)." primary={primary} />
              <Toggle label="Enable Loan Comparison Tool" value={cfg.feature_loan_comparison}
                onChange={(v: boolean) => setCfg(p => ({ ...p, feature_loan_comparison: v }))} primary={primary} />
              <Toggle label="Enable EMI Pause" value={cfg.feature_emi_pause}
                onChange={(v: boolean) => setCfg(p => ({ ...p, feature_emi_pause: v }))} primary={primary} />
              <SaveButton onClick={() => save({
                min_loan_amount: cfg.min_loan_amount, max_loan_amount: cfg.max_loan_amount,
                min_tenure_months: cfg.min_tenure_months, max_tenure_months: cfg.max_tenure_months,
                feature_collateral_loans: cfg.feature_collateral_loans,
                feature_loan_comparison: cfg.feature_loan_comparison,
                feature_emi_pause: cfg.feature_emi_pause,
              })} primary={primary} saving={saving} saved={saved} error={error} />
            </div>
          )}

          {/* ── PRE-CLOSURE ──────────────── */}
          {activeTab === 'preclosure' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Pre-Closure Policy</h2>
              <Toggle label="Enable Pre-Closure" value={cfg.feature_preclosure}
                onChange={(v: boolean) => setCfg(p => ({ ...p, feature_preclosure: v }))}
                hint="Allow borrowers to close loans early." primary={primary} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                <Field label="Standard Pre-Closure Rate (%)" type="number" value={cfg.default_preclosure_rate}
                  onChange={(v: string) => setCfg(p => ({ ...p, default_preclosure_rate: Number(v) }))} />
                <Field label="Free Pre-Closure Period (months)" type="number" value={cfg.preclosure_free_months}
                  onChange={(v: string) => setCfg(p => ({ ...p, preclosure_free_months: Number(v) }))}
                  hint="Months from disbursement during which pre-closure is not allowed." />
                <Field label="Early Period Charge Rate (%)" type="number" value={cfg.preclosure_early_charge_rate}
                  onChange={(v: string) => setCfg(p => ({ ...p, preclosure_early_charge_rate: Number(v) }))} />
                <Field label="Secure Link Validity (hours)" type="number" value={cfg.preclosure_link_validity_hours}
                  onChange={(v: string) => setCfg(p => ({ ...p, preclosure_link_validity_hours: Number(v) }))} />
              </div>
              <SaveButton onClick={() => save({
                feature_preclosure: cfg.feature_preclosure,
                default_preclosure_rate: cfg.default_preclosure_rate,
                preclosure_free_months: cfg.preclosure_free_months,
                preclosure_early_charge_rate: cfg.preclosure_early_charge_rate,
                preclosure_link_validity_hours: cfg.preclosure_link_validity_hours,
              })} primary={primary} saving={saving} saved={saved} error={error} />
            </div>
          )}

          {/* ── NOTIFICATIONS ────────────── */}
          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Email Notifications</h2>
              <Field label="From Name" value={cfg.email_from_name}
                onChange={(v: string) => setCfg(p => ({ ...p, email_from_name: v }))} />
              <Field label="From Email Address" type="email" value={cfg.email_from_address}
                onChange={(v: string) => setCfg(p => ({ ...p, email_from_address: v }))} />
              <Toggle label="Auto Monthly Statement Email" value={cfg.auto_monthly_statement}
                onChange={(v: boolean) => setCfg(p => ({ ...p, auto_monthly_statement: v }))}
                hint="Automatically email EMI statements to borrowers on the 1st of each month." primary={primary} />
              <Toggle label="Support Chat Widget" value={cfg.feature_support_chat}
                onChange={(v: boolean) => setCfg(p => ({ ...p, feature_support_chat: v }))} primary={primary} />
              <SaveButton onClick={() => save({
                email_from_name: cfg.email_from_name, email_from_address: cfg.email_from_address,
                auto_monthly_statement: cfg.auto_monthly_statement, feature_support_chat: cfg.feature_support_chat,
              })} primary={primary} saving={saving} saved={saved} error={error} />
            </div>
          )}

          {/* ── TEAM ─────────────────────── */}
          {activeTab === 'team' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Team Members</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
                      {['Name','Email','Role','Department','Status'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                          fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9CA3AF' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(!Array.isArray(employees) || employees.length === 0) ? (
                      <tr><td colSpan={5} style={{ padding: '32px 12px', textAlign: 'center', color: '#9CA3AF', fontSize: 14 }}>
                        No team members yet. Go to Admin → Users to create employees.
                      </td></tr>
                    ) : employees.map((emp: any) => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>{emp.full_name}</td>
                        <td style={{ padding: '10px 12px', color: '#6B7280' }}>{emp.email}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, background: '#EEF2FF',
                            color: primary, fontSize: 11, fontWeight: 600 }}>{emp.role}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6B7280' }}>{emp.department || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: emp.is_active ? '#059669' : '#DC2626' }}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DELEGATION ───────────────── */}
          {activeTab === 'delegation' && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Active Delegations</h2>
              {(!Array.isArray(delegations) || delegations.length === 0) ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: '#9CA3AF' }}>No active delegations. Go to Admin → Delegations to create one.</p>
                </div>
              ) : delegations.map((d: any) => (
                <div key={d.id} style={{ padding: '14px 16px', background: '#F9FAFB', borderRadius: 8,
                  border: '1px solid #E5E7EB', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{d.delegate_name}</p>
                      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {new Date(d.start_date).toLocaleDateString()} → {new Date(d.end_date).toLocaleDateString()}
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                        Permissions: {(d.delegated_permissions || []).join(', ')}
                      </p>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 4, background: '#F0FDF4',
                      color: '#059669', fontSize: 11, fontWeight: 600 }}>ACTIVE</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
