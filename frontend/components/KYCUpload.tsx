"use client";

import React, { useRef, useState } from "react";
import DocumentScanner3D from "@/components/3d/DocumentScanner3D";

interface KYCUploadProps {
  label: string;
  accept?: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
}

export default function KYCUpload({
  label,
  accept = "image/jpeg,image/png",
  file,
  onFileSelect,
}: KYCUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onFileSelect(f);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`kyc-upload ${file ? "kyc-upload--filled" : ""}`}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleSelect}
        className="kyc-upload__input"
      />

      {!file ? (
        <div className="kyc-upload__empty">
          <svg className="kyc-upload__icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="kyc-upload__title">{label}</p>
          <p className="kyc-upload__subtitle">JPG or PNG · Max 5MB</p>
        </div>
      ) : (
        <div className="kyc-upload__preview">
          <DocumentScanner3D />
          {preview && <img src={preview} alt={label} className="kyc-upload__image" />}
          <div className="kyc-upload__overlay">
            <span className="kyc-upload__filename">{file.name}</span>
          </div>
          <button className="kyc-upload__remove" onClick={handleRemove} type="button">×</button>
        </div>
      )}

      <style jsx>{`
        .kyc-upload {
          position: relative;
          border: 2px dashed var(--surface-border);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
          cursor: pointer;
          transition: all var(--transition-base);
          overflow: hidden;
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kyc-upload:hover:not(.kyc-upload--filled) {
          border-color: var(--accent-400);
          background: rgba(124, 58, 237, 0.04);
        }

        .kyc-upload--filled {
          border-style: solid;
          border-color: var(--surface-border-hover);
          padding: 0;
          cursor: default;
        }

        .kyc-upload__input {
          display: none;
        }

        .kyc-upload__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: var(--space-2);
        }

        .kyc-upload__icon {
          color: var(--text-tertiary);
          margin-bottom: var(--space-1);
        }

        .kyc-upload__title {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--text-primary);
        }

        .kyc-upload__subtitle {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
        }

        .kyc-upload__preview {
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 180px;
        }

        .kyc-upload__image {
          width: 100%;
          height: 100%;
          min-height: 180px;
          object-fit: cover;
          display: block;
        }

        .kyc-upload__overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.75));
          padding: var(--space-3) var(--space-4);
        }

        .kyc-upload__filename {
          font-size: var(--text-xs);
          color: var(--neutral-0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }

        .kyc-upload__remove {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          color: var(--neutral-900);
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          line-height: 1;
        }

        .kyc-upload__remove:hover {
          background: var(--color-error);
          color: var(--neutral-0);
        }
      `}</style>
    </div>
  );
}
