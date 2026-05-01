'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/tenant';

interface MediaFile {
  key: string;
  url: string;
  type: string;
  filename: string;
  uploaded_at: string;
}

export default function MediaLibraryPage() {
  const tenant = useTenant();
  const primary = tenant.primary_color || '#4F46E5';

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('general');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const base = process.env.NEXT_PUBLIC_API_URL || '';
  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('nexloan_token')}`,
  });

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${base}/api/admin/media/list`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFiles(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  }, [base]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(''); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('type', uploadType);
      const res = await fetch(`${base}/api/admin/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('nexloan_token')}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }
      setMsg('File uploaded successfully ✓');
      fetchFiles();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
    setTimeout(() => { setMsg(''); setError(''); }, 3000);
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Delete this file?')) return;
    try {
      await fetch(`${base}/api/admin/media/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      setMsg('File deleted');
      fetchFiles();
    } catch {
      setError('Failed to delete');
    }
    setTimeout(() => { setMsg(''); setError(''); }, 3000);
  };

  const TYPE_OPTIONS = [
    { value: 'logo', label: '🎨 Logo', hint: 'Auto-updates your brand logo' },
    { value: 'email_header', label: '✉️ Email Header', hint: 'Used in all outgoing emails' },
    { value: 'banner', label: '📢 Banner', hint: 'Dashboard announcement images' },
    { value: 'general', label: '📁 General', hint: 'Policy docs, promotional media' },
  ];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Media Library</h1>
        <p style={{ fontSize: 14, color: '#6B7280' }}>Upload and manage logos, banners, and documents.</p>
      </div>

      {/* Upload Section */}
      <div style={{
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
        padding: 24, marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Upload New File</h3>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', marginBottom: 6 }}>File Type</label>
            <select value={uploadType} onChange={e => setUploadType(e.target.value)}
              style={{
                padding: '9px 14px', border: '1px solid #E5E7EB', borderRadius: 6,
                fontSize: 13, color: '#111827', minWidth: 160,
              }}>
              {TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <label style={{
            padding: '9px 20px', background: primary, color: '#fff', borderRadius: 6,
            fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1, display: 'inline-block',
          }}>
            {uploading ? 'Uploading…' : '⬆ Choose File & Upload'}
            <input type="file" accept="image/*,.pdf,.svg" onChange={handleUpload}
              style={{ display: 'none' }} disabled={uploading} />
          </label>

          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {TYPE_OPTIONS.find(t => t.value === uploadType)?.hint}
          </span>
        </div>

        {msg && <p style={{ marginTop: 12, fontSize: 12, color: '#059669', fontWeight: 500 }}>{msg}</p>}
        {error && <p style={{ marginTop: 12, fontSize: 12, color: '#DC2626', fontWeight: 500 }}>{error}</p>}
      </div>

      {/* Files Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Loading files…</div>
      ) : files.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🖼️</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>No media files yet</p>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>Upload your first file above.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {files.map(f => (
            <div key={f.key} style={{
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
              overflow: 'hidden', transition: 'border-color 0.15s',
            }}>
              {/* Preview */}
              <div style={{
                height: 120, background: '#F9FAFB', display: 'flex',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {f.url?.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) ? (
                  <img src={f.url} alt={f.filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 36 }}>📄</span>
                )}
              </div>

              {/* Info */}
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.filename}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    background: '#EEF2FF', color: primary, textTransform: 'uppercase',
                  }}>{f.type}</span>
                  <button onClick={() => handleDelete(f.key)} style={{
                    fontSize: 11, color: '#DC2626', background: 'none', border: 'none',
                    cursor: 'pointer', fontWeight: 600,
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
