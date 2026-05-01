'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoanSlider from '@/components/LoanSlider';
import KYCUpload from '@/components/KYCUpload';
import { loanAPI, coApplicantAPI } from '@/lib/api';
import { useTenant } from '@/lib/tenant';

const STEPS = ['Personal', 'Loan Detail', 'KYC', 'Confirm'];

export default function ApplyPage() {
  const router = useRouter();
  const tenant = useTenant();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loanData, setLoanData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('nexloan_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      router.push('/');
    }
  }, [router]);

  const [formData, setFormData] = useState({
    dob_month: '',
    dob_day: '',
    dob_year: '',
    gender: '',
    employment_type: 'SALARIED',
    loan_amount: 500000,
    purpose: 'Other',
    tenure_months: 36,
    monthly_income: 50000,
    existing_emi: 0,
    loan_type: 'NON_COLLATERAL' as string,
    collateral_type: '' as string,
    collateral_value: 0,
    collateral_description: '' as string,
  });

  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [kycResult, setKycResult] = useState<any>(null);

  const [hasCoApplicant, setHasCoApplicant] = useState(false);
  const [coApplicant, setCoApplicant] = useState({
    full_name: '', relationship: 'SPOUSE', phone: '', monthly_income: 0, employment_type: 'SALARIED', existing_emi: 0,
  });
  const handleCoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setCoApplicant(p => ({ ...p, [name]: type === 'number' ? Number(value) : value }));
  };

  const calculateEstimateEMI = () => {
    const P = formData.loan_amount;
    const r = 15 / (12 * 100);
    const n = formData.tenure_months;
    if (P === 0 || n === 0) return 0;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    return Math.round(emi);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' || type === 'range' ? Number(value) : value,
    }));
  };

  const handleSubmitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!formData.dob_month || !formData.dob_day || !formData.dob_year) {
        throw new Error("Date of Birth is required");
      }
      if (!formData.gender) {
        throw new Error("Gender is required");
      }
      
      if (requiresCollateral && (!formData.collateral_type || !formData.collateral_value || !formData.collateral_description)) {
        throw new Error("Collateral details are required for this loan amount.");
      }

      const dobDate = `${formData.dob_year}-${String(formData.dob_month).padStart(2, '0')}-${String(formData.dob_day).padStart(2, '0')}`;
      
      const inquiryPayload = {
        loan_amount: formData.loan_amount,
        tenure_months: formData.tenure_months,
        purpose: formData.purpose,
        monthly_income: formData.monthly_income,
        employment_type: formData.employment_type,
        existing_emi: formData.existing_emi,
        date_of_birth: dobDate + "T00:00:00Z",
        gender: formData.gender,
        ...(requiresCollateral ? {
          collateral_type: formData.collateral_type,
          collateral_value: formData.collateral_value,
          collateral_description: formData.collateral_description
        } : {})
      };
      const response = await loanAPI.createInquiry(inquiryPayload);
      const loan = response.data;
      setLoanData(loan);
      // If co-applicant was added, submit it
      if (hasCoApplicant && coApplicant.full_name && coApplicant.phone && coApplicant.monthly_income > 0) {
        try {
          await coApplicantAPI.add(loan.loan_id, { ...coApplicant, consent_given: true });
        } catch { /* non-blocking */ }
      }
      setStep(3);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
          : err.message || 'Failed to create inquiry';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitKYC = async () => {
    if (!panFile || !aadhaarFile) {
      setError("Please upload both PAN and Aadhaar cards.");
      return;
    }
    if (!loanData?.loan_id) {
      setError("Loan session lost. Please go back and resubmit your details.");
      setStep(2);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('pan_card', panFile);
      formData.append('aadhaar_card', aadhaarFile);
      const response = await loanAPI.uploadKYC(loanData.loan_id, formData);
      setKycResult(response.data);
      setStep(4);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
          : err.message || 'Failed to upload KYC';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Loading...
      </div>
    );
  }

  const collateralThreshold: number = tenant?.collateral_policy?.threshold_amount ?? Infinity;
  const requiresCollateral: boolean =
    !!(tenant?.feature_collateral_loans) && isFinite(collateralThreshold) && formData.loan_amount > collateralThreshold;

  return (
    <div className="apply-page">
      {/* ── Progress Header ──────────────── */}
      <div className="apply-header">
        <div>
          <h1 className="apply-header__title">Loan Application</h1>
          <p className="apply-header__subtitle">SECURE & AI-VERIFIED • {user.full_name?.toUpperCase()}</p>
        </div>

        <div className="apply-steps">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <div key={label} className="apply-steps__item">
                {i > 0 && (
                  <div className={`apply-steps__line ${isCompleted ? 'apply-steps__line--done' : ''}`} />
                )}
                <div className={`apply-steps__circle ${isCurrent ? 'apply-steps__circle--current' : ''} ${isCompleted ? 'apply-steps__circle--done' : ''}`}>
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span className={`apply-steps__label ${isCurrent || isCompleted ? 'apply-steps__label--active' : ''}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Error Alert ──────────────────── */}
      {error && (
        <div className="apply-error animate-card-entrance">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {/* ── STEP 1: Personal Details ─────── */}
      {step === 1 && (
        <div className="animate-card-entrance">
          <div className="apply-section-heading">
            <h2>Personal Details</h2>
            <div className="apply-section-heading__rule" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
            <div className="apply-grid-2">
              <Input label="Full Name" value={user.full_name} disabled />
              <Input label="Email Address" value={user.email} disabled />
              <Input label="Mobile Number" value={user.mobile} addon="+91" disabled />
              <div className="apply-field" style={{ gridColumn: '1 / -1' }}>
                <label className="apply-field__label" style={{ marginBottom: '8px', display: 'block' }}>DATE OF BIRTH</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <select
                    name="dob_month"
                    value={formData.dob_month}
                    onChange={handleInputChange}
                    className="apply-field__select"
                    required
                  >
                    <option value="" disabled>Month</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={String(m)}>
                        {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    name="dob_day"
                    value={formData.dob_day}
                    onChange={handleInputChange}
                    placeholder="Day"
                    min="1"
                    max="31"
                    className="apply-field__input"
                    required
                    style={{ background: 'var(--surface-sunken)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', width: '100%', fontSize: '15px' }}
                  />
                  <input
                    type="number"
                    name="dob_year"
                    value={formData.dob_year}
                    onChange={handleInputChange}
                    placeholder="Year"
                    min="1900"
                    max={new Date().getFullYear() - 18}
                    className="apply-field__input"
                    required
                    style={{ background: 'var(--surface-sunken)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', width: '100%', fontSize: '15px' }}
                  />
                </div>
              </div>

              <div className="apply-field" style={{ gridColumn: '1 / -1' }}>
                <label className="apply-field__label">GENDER</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="apply-field__select"
                  required
                >
                  <option value="" disabled>Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="apply-field" style={{ marginTop: 'var(--space-4)' }}>
              <label className="apply-field__label">EMPLOYMENT TYPE</label>
              <select
                name="employment_type"
                value={formData.employment_type}
                onChange={handleInputChange}
                className="apply-field__select"
              >
                <option value="SALARIED">Salaried</option>
                <option value="BUSINESS">Business</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="apply-actions">
              <div />
              <Button type="submit" size="lg">Next Step →</Button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 2: Loan Requirements ────── */}
      {step === 2 && (
        <div className="animate-card-entrance">
          <div className="apply-section-heading">
            <h2>Loan Requirements</h2>
            <div className="apply-section-heading__rule" />
          </div>

          <form onSubmit={handleSubmitStep2}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              <LoanSlider
                label="HOW MUCH DO YOU NEED?"
                min={50000}
                max={10000000}
                step={10000}
                value={formData.loan_amount}
                onChange={(v) => setFormData((p) => ({ ...p, loan_amount: v }))}
                formatValue={(v) => `₹${v.toLocaleString('en-IN')}`}
                formatMin="₹50,000"
                formatMax="₹1 Cr"
              />

              <LoanSlider
                label="FOR HOW LONG?"
                min={6}
                max={120}
                step={6}
                value={formData.tenure_months}
                onChange={(v) => setFormData((p) => ({ ...p, tenure_months: v }))}
                formatValue={(v) => `${v}`}
                suffix="MO"
                formatMin="6 Months"
                formatMax="120 Months"
              />

              {/* EMI Preview Card */}
              <div className="emi-preview">
                <div className="emi-preview__info">
                  <span className="emi-preview__label">ESTIMATED MONTHLY EMI</span>
                  <p className="emi-preview__hint">Based on ~15% p.a. standard rate</p>
                </div>
                <div className="emi-preview__amount">
                  ₹{calculateEstimateEMI().toLocaleString('en-IN')}
                </div>
              </div>

              <div className="apply-grid-2">
                <div className="apply-field">
                  <label className="apply-field__label">MONTHLY INCOME (₹)</label>
                  <input
                    required
                    type="number"
                    name="monthly_income"
                    min={15000}
                    value={formData.monthly_income}
                    onChange={handleInputChange}
                    className="apply-field__date"
                  />
                </div>
                <div className="apply-field">
                  <label className="apply-field__label">EXISTING EMIs (₹)</label>
                  <input
                    type="number"
                    name="existing_emi"
                    min={0}
                    value={formData.existing_emi}
                    onChange={handleInputChange}
                    className="apply-field__date"
                  />
                </div>
              </div>

              <div className="apply-field">
                <label className="apply-field__label">LOAN PURPOSE</label>
                <select
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  className="apply-field__select"
                >
                  <option value="Medical">Medical Emergency</option>
                  <option value="Education">Education</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Home Renovation">Home Renovation</option>
                  <option value="Travel">Travel</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Collateral Loan Requirement */}
              {requiresCollateral && (
                <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: 8, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>🛡️</span>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: '#92400E' }}>Collateral Required</h4>
                      <p style={{ fontSize: 12, color: '#B45309' }}>
                        Loans above ₹{(collateralThreshold).toLocaleString('en-IN')} require an asset pledge.
                      </p>
                    </div>
                  </div>
                  
                  <div className="co-form animate-card-entrance" style={{ marginTop: 0 }}>
                    <div className="apply-grid-2">
                      <div className="apply-field">
                        <label className="apply-field__label">ASSET TYPE *</label>
                        <select name="collateral_type" value={formData.collateral_type} onChange={handleInputChange} className="apply-field__select" required>
                          <option value="" disabled>Select asset type</option>
                          <option value="GOLD">Gold</option>
                          <option value="PROPERTY">Property</option>
                          <option value="VEHICLE">Vehicle</option>
                          <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                        </select>
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">ASSET VALUE (₹) *</label>
                        <input type="number" name="collateral_value" min={0} value={formData.collateral_value} onChange={handleInputChange} className="apply-field__date" required placeholder="Estimated value" />
                      </div>
                    </div>
                    <div className="apply-field">
                      <label className="apply-field__label">ASSET DESCRIPTION *</label>
                      <input type="text" name="collateral_description" required value={formData.collateral_description} onChange={(e) => setFormData(p => ({ ...p, collateral_description: e.target.value }))} className="apply-field__date" placeholder="e.g. 24K gold jewellery, 50gm" />
                    </div>
                  </div>
                </div>
              )}
              {/* Co-Applicant Toggle */}
              <div className="co-toggle">
                <div className="co-toggle__header" onClick={() => setHasCoApplicant(v => !v)}>
                  <div>
                    <span className="co-toggle__title">Add Co-Applicant</span>
                    <span className="co-toggle__hint">Boost eligibility with a joint application</span>
                  </div>
                  <div className={`co-toggle__switch ${hasCoApplicant ? 'co-toggle__switch--on' : ''}`}>
                    <span className="co-toggle__knob" />
                  </div>
                </div>

                {hasCoApplicant && (
                  <div className="co-form animate-card-entrance">
                    <div className="apply-grid-2">
                      <div className="apply-field">
                        <label className="apply-field__label">CO-APPLICANT FULL NAME</label>
                        <input required={hasCoApplicant} type="text" name="full_name" value={coApplicant.full_name} onChange={handleCoChange} className="apply-field__date" placeholder="e.g. Priya Sharma" />
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">RELATIONSHIP</label>
                        <select name="relationship" value={coApplicant.relationship} onChange={handleCoChange} className="apply-field__select">
                          <option value="SPOUSE">Spouse</option>
                          <option value="PARENT">Parent</option>
                          <option value="SIBLING">Sibling</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">PHONE NUMBER</label>
                        <input required={hasCoApplicant} type="tel" name="phone" value={coApplicant.phone} onChange={handleCoChange} className="apply-field__date" placeholder="10-digit number" />
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">MONTHLY INCOME (₹)</label>
                        <input required={hasCoApplicant} type="number" name="monthly_income" min={0} value={coApplicant.monthly_income} onChange={handleCoChange} className="apply-field__date" />
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">EMPLOYMENT TYPE</label>
                        <select name="employment_type" value={coApplicant.employment_type} onChange={handleCoChange} className="apply-field__select">
                          <option value="SALARIED">Salaried</option>
                          <option value="BUSINESS">Business</option>
                          <option value="SELF_EMPLOYED">Self Employed</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="apply-field">
                        <label className="apply-field__label">EXISTING EMIs (₹)</label>
                        <input type="number" name="existing_emi" min={0} value={coApplicant.existing_emi} onChange={handleCoChange} className="apply-field__date" />
                      </div>
                    </div>
                    <p className="apply-trust" style={{ textAlign: 'left', marginTop: 'var(--space-3)' }}>By continuing, the co-applicant consents to credit check.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="apply-actions">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>← Back</Button>
              <Button type="submit" size="lg" loading={loading}>Continue to KYC →</Button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 3: KYC Upload ───────────── */}
      {step === 3 && (
        <div className="animate-card-entrance">
          <div className="apply-section-heading">
            <h2>Identity Verification</h2>
            <div className="apply-section-heading__rule" />
          </div>

          <p className="apply-kyc-intro">
            Our AI-vision system verifies your documents instantly.
          </p>

          <div className="apply-grid-2" style={{ marginTop: 'var(--space-6)' }}>
            <KYCUpload label="Upload PAN Card" file={panFile} onFileSelect={setPanFile} />
            <KYCUpload label="Upload Aadhaar Card" file={aadhaarFile} onFileSelect={setAadhaarFile} />
          </div>

          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button
              size="lg"
              fullWidth
              loading={loading}
              disabled={!panFile || !aadhaarFile}
              onClick={handleSubmitKYC}
            >
              Submit for AI Verification
            </Button>
          </div>

          <p className="apply-trust">
            🔒 256-bit encrypted · RBI compliant · Documents not shared
          </p>

          <div className="apply-actions" style={{ marginTop: 'var(--space-4)' }}>
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>← Back</Button>
            <div />
          </div>
        </div>
      )}

      {/* ── STEP 4: Confirmation ─────────── */}
      {step === 4 && (
        <div className="apply-confirm animate-card-entrance">
          <div className="apply-confirm__check">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="var(--color-success)" strokeWidth="2" opacity="0.3" />
              <path
                d="M20 33L28 41L44 23"
                stroke="var(--color-success)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="100"
                strokeDashoffset="0"
                style={{ animation: 'checkDraw 800ms ease-out forwards' }}
              />
            </svg>
          </div>

          <h2 className="apply-confirm__title">Application Received!</h2>
          <p className="apply-confirm__subtitle">
            Your documents are being verified by our AI engine.
          </p>

          <Card variant="elevated" className="apply-confirm__card">
            <div className="apply-confirm__row">
              <span className="apply-confirm__label">LOAN REFERENCE</span>
              <span className="apply-confirm__value apply-confirm__value--mono">{loanData?.loan_number}</span>
            </div>
            <div className="apply-confirm__row-divider" />
            <div className="apply-confirm__row">
              <span className="apply-confirm__label">VERIFICATION STATUS</span>
              <Badge variant={kycResult?.verdict === 'PASS' ? 'success' : 'warning'}>
                {kycResult?.verdict === 'PASS' ? 'KYC Verified' : 'KYC Pending'}
              </Badge>
            </div>
            {kycResult?.remarks && (
              <>
                <div className="apply-confirm__row-divider" />
                <div className="apply-confirm__row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <span className="apply-confirm__label">AI REMARKS</span>
                  <p className="apply-confirm__remarks">&ldquo;{kycResult.remarks}&rdquo;</p>
                </div>
              </>
            )}
          </Card>

          <Button size="lg" onClick={() => router.push('/dashboard')}>
            Go to Dashboard →
          </Button>
        </div>
      )}

      <style jsx>{`
        .apply-page {
          max-width: 800px;
          margin: 0 auto;
        }

        /* ── Header ──────────────────────── */
        .apply-header {
          margin-bottom: var(--space-8);
        }
        .apply-header__title {
          font-family: var(--font-display);
          font-size: var(--text-2xl);
          font-weight: 700;
          color: var(--text-primary);
        }
        .apply-header__subtitle {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-top: var(--space-1);
        }

        /* ── Steps ───────────────────────── */
        .apply-steps {
          display: flex;
          align-items: center;
          margin-top: var(--space-6);
          gap: 0;
        }
        .apply-steps__item {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          flex: 1;
        }
        .apply-steps__line {
          position: absolute;
          top: 14px;
          right: 50%;
          width: 100%;
          height: 1px;
          background: var(--surface-border);
          z-index: 0;
        }
        .apply-steps__line--done {
          background: var(--color-success);
        }
        .apply-steps__circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-xs);
          font-weight: 700;
          border: 1px solid var(--surface-border);
          color: var(--text-tertiary);
          background: var(--surface-base);
          position: relative;
          z-index: 1;
          transition: all var(--transition-base);
        }
        .apply-steps__circle--current {
          background: var(--accent-500);
          border-color: var(--accent-500);
          color: var(--neutral-0);
        }
        .apply-steps__circle--done {
          background: var(--color-success);
          border-color: var(--color-success);
          color: var(--neutral-0);
        }
        .apply-steps__label {
          font-size: var(--text-xs);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
          margin-top: var(--space-2);
          font-weight: 500;
        }
        .apply-steps__label--active {
          color: var(--text-primary);
        }

        /* ── Section Heading ─────────────── */
        .apply-section-heading {
          margin-bottom: var(--space-6);
        }
        .apply-section-heading h2 {
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--text-primary);
        }
        .apply-section-heading__rule {
          height: 1px;
          background: var(--surface-border);
          margin-top: var(--space-3);
        }

        /* ── Grid ────────────────────────── */
        .apply-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
        }
        @media (max-width: 640px) {
          .apply-grid-2 { grid-template-columns: 1fr; }
        }

        /* ── Native field styling ────────── */
        .apply-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .apply-field__label {
          font-size: var(--text-xs);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--text-tertiary);
        }
        .apply-field__date,
        .apply-field__select {
          width: 100%;
          padding: 14px 16px;
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: var(--text-base);
          outline: none;
          transition: all var(--transition-base);
          appearance: none;
        }
        .apply-field__date:focus,
        .apply-field__select:focus {
          border-color: var(--accent-400);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
        }
        .apply-field__select {
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%236B6560' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }

        /* ── EMI Preview ─────────────────── */
        .emi-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-8);
          background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05));
          border: 1px solid rgba(124,58,237,0.30);
          border-radius: var(--radius-xl);
          flex-wrap: wrap;
          gap: var(--space-4);
        }
        .emi-preview__label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
        }
        .emi-preview__hint {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: var(--space-1);
        }
        .emi-preview__amount {
          font-family: var(--font-display);
          font-size: var(--text-5xl);
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          transition: all var(--transition-fast);
        }
        @media (max-width: 640px) {
          .emi-preview__amount { font-size: var(--text-4xl); }
        }

        /* ── Actions ─────────────────────── */
        .apply-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: var(--space-8);
          padding-top: var(--space-6);
          border-top: 1px solid var(--surface-border);
        }

        /* ── KYC Intro ───────────────────── */
        .apply-kyc-intro {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          text-align: center;
        }
        .apply-trust {
          text-align: center;
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: var(--space-4);
          letter-spacing: 0.02em;
        }

        /* ── Confirmation ────────────────── */
        .apply-confirm {
          text-align: center;
          padding: var(--space-8) 0;
        }
        .apply-confirm__check {
          margin-bottom: var(--space-6);
        }
        .apply-confirm__title {
          font-family: var(--font-display);
          font-size: var(--text-3xl);
          font-weight: 700;
          color: var(--text-primary);
        }
        .apply-confirm__subtitle {
          color: var(--text-secondary);
          margin-top: var(--space-2);
          margin-bottom: var(--space-8);
        }
        .apply-confirm__card {
          max-width: 400px;
          margin: 0 auto var(--space-8);
          text-align: left;
        }
        .apply-confirm__row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3) 0;
        }
        .apply-confirm__row-divider {
          border-bottom: 1px dotted var(--surface-border);
        }
        .apply-confirm__label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-tertiary);
        }
        .apply-confirm__value {
          color: var(--text-primary);
          font-weight: 600;
        }
        .apply-confirm__value--mono {
          font-family: var(--font-mono);
          color: var(--text-accent);
        }
        .apply-confirm__remarks {
          font-size: var(--text-sm);
          color: var(--text-tertiary);
          font-style: italic;
          line-height: 1.6;
        }

        /* ── Error ───────────────────────── */
        .apply-error {
          padding: var(--space-3) var(--space-4);
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: var(--radius-md);
          color: var(--color-error);
          font-size: var(--text-sm);
          margin-bottom: var(--space-6);
        }
        .co-toggle {
          background: var(--surface-sunken);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .co-toggle__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4) var(--space-5);
          cursor: pointer;
          user-select: none;
        }
        .co-toggle__title {
          font-weight: 600;
          font-size: var(--text-sm);
          color: var(--text-primary);
          display: block;
        }
        .co-toggle__hint {
          font-size: var(--text-xs);
          color: var(--text-tertiary);
          margin-top: 2px;
          display: block;
        }
        .co-toggle__switch {
          width: 44px;
          height: 24px;
          background: var(--surface-border);
          border-radius: 12px;
          position: relative;
          transition: background var(--transition-base);
          flex-shrink: 0;
        }
        .co-toggle__switch--on { background: var(--accent-500); }
        .co-toggle__knob {
          position: absolute;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform var(--transition-base);
        }
        .co-toggle__switch--on .co-toggle__knob { transform: translateX(20px); }
        .co-form { padding: var(--space-5); border-top: 1px solid var(--surface-border); display: flex; flex-direction: column; gap: var(--space-4); }
      `}</style>
    </div>
  );
}
