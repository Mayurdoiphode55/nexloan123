/**
 * NexLoan TypeScript Types — All API response interfaces
 * No `any` types. Every API response is strictly typed.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type LoanStatus =
  | 'INQUIRY' | 'APPLICATION' | 'KYC_PENDING' | 'KYC_VERIFIED'
  | 'UNDERWRITING' | 'APPROVED' | 'REJECTED' | 'COUNTER_OFFERED'
  | 'DISBURSED' | 'ACTIVE' | 'PRE_CLOSED' | 'CLOSED'

export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PAUSED'

export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'OTHER'

export type UserRole = 'BORROWER' | 'LOAN_OFFICER' | 'ADMIN' | 'SUPER_ADMIN'

export type MilestoneStatus = 'DONE' | 'CURRENT' | 'PENDING'

// ─── Readiness ──────────────────────────────────────────────────────────────

export interface ReadinessResult {
  readiness_score: number
  estimated_amount_min: number
  estimated_amount_max: number
  estimated_rate_min: number
  estimated_rate_max: number
  likely_approved: boolean
  score_breakdown: Record<string, number>
  improvement_tips: string[]
}

// ─── User ───────────────────────────────────────────────────────────────────

export interface User {
  id: string
  full_name: string
  email: string
  mobile: string
  is_verified: boolean
  role: UserRole
  is_active?: boolean
  created_at: string
}

// ─── Loan ───────────────────────────────────────────────────────────────────

export interface Loan {
  id: string
  loan_number: string
  status: LoanStatus
  loan_amount: number
  tenure_months: number
  purpose: string | null
  monthly_income: number | null
  employment_type: EmploymentType | null
  existing_emi: number
  approved_amount: number | null
  counter_offer_amount: number | null
  counter_offer_rate: number | null
  counter_accepted: boolean | null
  interest_rate: number | null
  emi_amount: number | null
  credit_score: number | null
  dti_ratio: number | null
  rejection_reason: string | null
  improvement_plan: string | null
  emi_pauses_used: number
  reapply_reminder_date: string | null
  disbursed_at: string | null
  disbursed_amount: number | null
  closed_at: string | null
  total_paid: number
  created_at: string
  updated_at: string
}

// ─── EMI Schedule ───────────────────────────────────────────────────────────

export interface EMIScheduleRow {
  id: string
  installment_no: number
  due_date: string
  emi_amount: number
  principal: number
  interest: number
  outstanding_balance: number
  status: PaymentStatus
  paid_at: string | null
  paid_amount: number | null
  pause_reason: string | null
}

// ─── Underwriting ───────────────────────────────────────────────────────────

export interface UnderwritingResult {
  loan_id: string
  status: string
  credit_score: number | null
  credit_tier: string | null
  dti_ratio: number | null
  interest_rate: number | null
  approved_amount: number | null
  counter_offer_amount: number | null
  counter_offer_rate: number | null
  rejection_reason: string | null
  improvement_plan: string | null
  reapply_reminder_date: string | null
}

// ─── Financial Health ───────────────────────────────────────────────────────

export interface FinancialHealth {
  interest_saved_if_prepay_10k: number
  tenure_reduction_if_prepay_10k: number
  interest_saved_if_prepay_25k: number
  tenure_reduction_if_prepay_25k: number
  on_time_payments: number
  credit_score_trajectory: 'improving' | 'stable' | 'declining'
  next_milestone: string
  groq_tip: string
}

// ─── Closure Stats ──────────────────────────────────────────────────────────

export interface ClosureStats {
  total_paid: number
  original_amount: number
  interest_paid: number
  early_payments_count: number
  interest_saved: number
  estimated_score_improvement: number
  reapply_offer_amount: number
  reapply_offer_rate: number
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminMetrics {
  total_loans: number
  approval_rate: number
  total_revenue: number
  active_loans: number
  status_breakdown: Record<string, number>
  avg_credit_score: number
  daily_volume: { date: string; count: number }[]
}

export interface ReapplyReminder {
  loan_id: string
  loan_number: string
  applicant_name: string
  applicant_email: string
  rejection_date: string
  reapply_date: string
  improvement_plan: string
}

// ─── KYC ────────────────────────────────────────────────────────────────────

export interface KYCDocument {
  pan_doc_url: string | null
  pan_number: string | null
  pan_name_extracted: string | null
  pan_legible: boolean | null
  pan_name_match: boolean | null
  aadhaar_doc_url: string | null
  aadhaar_number: string | null
  aadhaar_name_extracted: string | null
  aadhaar_legible: boolean | null
  aadhaar_photo_present: boolean | null
  ai_verdict: string | null
  ai_remarks: string | null
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  action: string
  from_status: string | null
  to_status: string | null
  actor: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export interface Milestone {
  id: string
  milestone: string
  description: string
  status: MilestoneStatus
  completed_at: string | null
}

export interface MilestoneResponse {
  loan_id: string
  loan_number: string
  current_status: string
  estimated_timeline: string
  milestones: Milestone[]
}

export interface DocumentStatusInfo {
  document_type: string
  status: 'PENDING' | 'VERIFIED' | 'FAILED'
  verified_at: string | null
  notes: string | null
}

export interface DocumentsResponse {
  loan_id: string
  documents: DocumentStatusInfo[]
}

// ─── User Management ────────────────────────────────────────────────────────

export interface UserListItem {
  id: string
  full_name: string
  email: string
  mobile: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  created_at: string
  department?: string | null
  branch_location?: string | null
  employee_id?: string | null
}

// ─── Support Tickets ────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string
  user_id: string
  loan_id: string | null
  subject: string
  description?: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  created_at: string
  updated_at: string | null
}

export interface TicketMessage {
  id: string
  sender_id: string
  sender_role: string
  message: string
  created_at: string
}

export interface TicketDetail extends SupportTicket {
  messages: TicketMessage[]
}

// ─── Referral ───────────────────────────────────────────────────────────────

export interface ReferralCode {
  referral_code: string
  stats: {
    invited: number
    signed_up: number
    earned: number
  }
}

export interface ReferralItem {
  id: string
  referred_email: string | null
  status: 'PENDING' | 'SIGNED_UP' | 'LOAN_APPROVED' | 'REWARDED'
  reward_amount: number
  created_at: string
}

// ─── Chat Memory ────────────────────────────────────────────────────────────

export interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
  session_id: string
}

// ─── Officer Dashboard (Phase 3) ────────────────────────────────────────────

export interface OfficerQueueItem {
  id: string
  loan_number: string
  borrower_name: string
  borrower_email: string
  loan_amount: number | null
  status: LoanStatus
  credit_score: number | null
  monthly_income: number | null
  employment_type: string | null
  ai_recommendation: string | null
  loan_type?: string
  created_at: string
}

export interface OfficerLoanFull {
  loan: {
    id: string
    loan_number: string
    status: LoanStatus
    loan_amount: number | null
    tenure_months: number | null
    purpose: string | null
    approved_amount: number | null
    interest_rate: number | null
    emi_amount: number | null
    credit_score: number | null
    dti_ratio: number | null
    rejection_reason: string | null
    ai_recommendation: string | null
    officer_decision: string | null
    officer_override_reason: string | null
    loan_type?: string
    collateral_type?: string | null
    collateral_value?: number | null
    collateral_description?: string | null
    collateral_verified?: boolean
    created_at: string
  }
  borrower: {
    id: string
    full_name: string
    email: string
    mobile: string
    monthly_income: number | null
    employment_type: string | null
    existing_emi: number | null
    date_of_birth: string | null
  }
  kyc: {
    pan_doc_url: string | null
    pan_number: string | null
    pan_name_extracted: string | null
    pan_legible: boolean | null
    pan_name_match: boolean | null
    aadhaar_doc_url: string | null
    aadhaar_number: string | null
    aadhaar_name_extracted: string | null
    aadhaar_legible: boolean | null
    aadhaar_photo_present: boolean | null
    ai_verdict: string | null
    ai_remarks: string | null
    verified_at: string | null
  } | null
  notes: OfficerNote[]
  document_requests: OfficerDocRequest[]
  audit_trail: AuditLogEntry[]
}

export interface OfficerNote {
  id: string
  officer_name: string
  content: string
  is_internal: boolean
  created_at: string
}

export interface OfficerDocRequest {
  id: string
  document_type: string
  reason: string | null
  status: 'REQUESTED' | 'UPLOADED' | 'VERIFIED'
  created_at: string
}

export interface OfficerMetrics {
  approval_rate: number
  total_decisions: number
  processed_today: number
  processed_this_week: number
  avg_processing_time: string
}

// ─── Phase 2 Types ──────────────────────────────────────────────────────────

export interface DashboardKPIs {
  active_loans: number
  total_disbursed: number
  total_loans: number
  npa_rate: number
  pending_kyc: number
  pending_callbacks: number
}

export interface PendingTask {
  type: string
  icon: string
  label: string
  customer_name: string
  loan_id?: string
  loan_number?: string
  time_elapsed: string
  cta: string
  cta_url: string
}

export interface PipelineStage {
  stage: string
  count: number
}

export interface RepaymentHealth {
  month: string
  paid: number
  pending: number
  overdue: number
  paused: number
  total: number
}

export interface LoanEnquiryItem {
  id: string
  full_name: string
  mobile: string
  email?: string
  loan_type?: string
  approx_amount?: number
  message?: string
  status: string
  claimed_by_name?: string
  created_at: string
}

export interface DelegationItem {
  id: string
  delegator_name: string
  delegate_name: string
  permissions: string[]
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export interface AnnouncementItem {
  id: string
  title: string
  body: string
  image_url?: string
  expiry_date?: string
  is_active?: boolean
  created_at: string
}

