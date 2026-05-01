# NexLoan 🚀

> **AI-First Personal Loan Origination & Lifecycle Management Platform**
> Built by [Theoremlabs](https://theoremlabs.io) · Version 2.0 · Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Triple-Layer AI KYC Pipeline](#3-triple-layer-ai-kyc-pipeline)
4. [Underwriting & Risk Engine](#4-underwriting--risk-engine)
5. [Complete Feature Set](#5-complete-feature-set)
6. [Technology Stack](#6-technology-stack)
7. [System Architecture](#7-system-architecture)
8. [Security & Compliance](#8-security--compliance)
9. [DevOps & Engineering Practices](#9-devops--engineering-practices)
10. [Development Setup](#10-development-setup)
11. [End-to-End User Journey](#11-end-to-end-user-journey)

---

## 1. Executive Summary

NexLoan is an AI-first personal loan origination and lifecycle management platform built by Theoremlabs. It automates every stage of the lending journey — from borrower inquiry and KYC verification to underwriting, disbursement, EMI repayment, and final loan closure — reducing loan processing time from days to seconds.

Unlike conventional lending software that relies on manual document review and static decision trees, NexLoan employs a proprietary **Triple-Layer AI pipeline** to extract, understand, and validate identity documents (Aadhaar and PAN cards) with a degree of accuracy that rivals human review. Combined with a deterministic underwriting engine, dynamic risk-based pricing, and a conversational borrower interface, NexLoan represents a fundamentally different approach to digital lending.

The platform is designed as a **white-label product**, enabling banks, NBFCs, cooperative credit societies, and microfinance institutions to deploy NexLoan under their own brand identity — with full customization of branding, financial parameters, loan products, and operational workflows.

| Metric | Value |
|---|---|
| Loan Processing Speed | Seconds (not days) |
| KYC Verification | Triple-Layer AI Pipeline |
| Deployment Model | White-Label per Client |
| Compliance | RBI Digital Lending Ready |

---

## 2. Product Overview

### 2.1 Loan Lifecycle

NexLoan handles the complete personal loan lifecycle across eight distinct stages. Each stage is a well-defined system state with enforced transition rules, audit logging, and role-specific access controls.

| # | Stage | Description | Responsible Role |
|---|---|---|---|
| 1 | **Inquiry & Lead** | Borrower submits basic financial profile. Loan record created. | Borrower |
| 2 | **Application** | Full application with personal details, income, employment info. | Borrower |
| 3 | **KYC Verification** | PAN + Aadhaar uploaded. Triple-Layer AI pipeline runs. | Verifier / AI |
| 4 | **Underwriting** | Theoremlabs Credit Score calculated. Loan approved, counter-offered, or rejected. | Underwriter / AI |
| 5 | **Disbursement** | Approved loan disbursed. Full EMI amortization schedule generated. | Loan Officer |
| 6 | **Servicing** | Monthly EMI repayments tracked. Pause, prepayment, health dashboard available. | Borrower |
| 7 | **Pre-Closure** | Optional early settlement via secure time-limited link. | Borrower |
| 8 | **Closure** | Final EMI triggers zero-touch closure. No-Dues Certificate generated. | System (Auto) |

### 2.2 White-Label Architecture

NexLoan is deployed as a **per-client single-tenant application**. Each client (bank, NBFC, or financial institution) receives a completely isolated deployment with its own database, document storage, and configuration.

The client's branding, colors, logo, and financial parameters are stored in the `TenantConfig` system and applied dynamically to every user-facing surface. The only visible reference to NexLoan in a client deployment is a small "Powered by NexLoan" attribution in the footer of the authentication page.

```
client-hdfc.nexloan.in    →  separate deployment, separate DB, HDFC branding
client-axis.nexloan.in    →  separate deployment, separate DB, Axis branding
client-kotak.nexloan.in   →  separate deployment, separate DB, Kotak branding
```

---

## 3. Triple-Layer AI KYC Pipeline

The KYC verification pipeline is the most technically sophisticated component of NexLoan. Standard OCR approaches fail on Indian identity documents due to complex layouts, mixed scripts, varying print quality, and the critical need to extract specific fields from precise locations on the card.

NexLoan solves this with a four-stage pipeline where each layer compensates for the weaknesses of the one before it.

### Layer 1 — Groq Llama-3.2 Vision ⚡ (High-Speed Extraction)

- Processes document images using Groq's LPU (Language Processing Unit) architecture for near-instant inference
- The vision model identifies bounding boxes and extracts text fields based on visual positioning and layout context
- Returns structured JSON including name, document number, date of birth, and presence of photo/signature
- Operates at speeds that make real-time verification practical during the application flow

### Layer 2 — LayoutLM DocVQA 🧠 (Contextual Document Understanding)

- Standard OCR returns "garbage text" from complex identity documents — a stream of characters with no positional awareness
- LayoutLM (via Hugging Face's Inference API) understands document structure. It "knows" that a 12-digit number near the bottom of an Aadhaar card is the UID
- Document Question Answering (DocVQA) mode allows targeted field extraction: *"What is the PAN number on this card?"*
- Resolves ambiguities from Layer 1 by cross-referencing structural understanding of the document layout

### Layer 3 — BERT NER + Fuzzy Matching 🔍 (Fraud Detection)

- BERT-based Named Entity Recognition (NER) identifies person names from extracted raw text
- Levenshtein distance algorithms perform fuzzy matching between the extracted document name and the applicant's declared name
- Catches identity fraud: if the PAN card says "MAYUR DOIPHODE" but the applicant declares "SAHIL SHARMA", the system flags it
- Generates a dynamic **AI Confidence Score** (0.0–1.0) that determines auto-approval or manual review routing
- Accounts for legitimate Indian name variations: initials, transliteration differences, name order, middle name omissions

### Layer 4 — Tesseract OCR Fallback 🛡️ (Reliability Guarantee)

- If all three AI API layers are unavailable (network failure, rate limits, model cold starts), Tesseract runs locally
- Ensures 100% uptime for the KYC pipeline regardless of external API status
- Results from the fallback layer are marked with lower confidence and automatically routed to manual review

### 3.1 AI Narrative Reports

Instead of surfacing raw confidence scores and JSON to loan officers, NexLoan translates AI findings into plain-English narrative reports:

| Verdict | Example Report |
|---|---|
| ✅ PASS | *"Identity Verified: PAN DHIPD0767H confirmed for MAYUR NANASAHEB DOIPHODE. Name matches application with 97% confidence. Signature present."* |
| ⚠️ MANUAL REVIEW | *"Partial Match: Document name is MAYUR DOIPHODE (abbreviated). Application shows MAYUR NANASAHEB DOIPHODE. Middle name omission detected — manual verification recommended."* |
| 🚩 FAIL | *"Identity Mismatch: Name on PAN card is SAHIL SHARMA but applicant declared MAYUR DOIPHODE. High fraud risk. Application blocked pending investigation."* |

---

## 4. Underwriting & Risk Engine

NexLoan's underwriting engine uses **deterministic financial modeling** rather than opaque ML predictions. Every decision is explainable, auditable, and configurable per client.

### 4.1 Theoremlabs Credit Score

The Theoremlabs Credit Score is a proprietary scoring algorithm producing a value between **300 and 850**. Unlike CIBIL which requires a bureau API call, this score is calculated instantly from the borrower's declared profile.

**Base score: 300 points. Points added for each factor:**

| Factor | Condition | Points | Max |
|---|---|---|---|
| Monthly Income | ≥ ₹1,00,000 | +200 | 200 |
| Monthly Income | ≥ ₹50,000 | +150 | |
| Monthly Income | ≥ ₹30,000 | +100 | |
| Monthly Income | ≥ ₹15,000 | +50 | |
| Employment Type | Salaried | +100 | 100 |
| Employment Type | Business | +70 | |
| Employment Type | Self-Employed | +60 | |
| Existing DTI | < 10% | +150 | 150 |
| Existing DTI | < 20% | +100 | |
| Existing DTI | < 35% | +50 | |
| Loan-to-Income | ≤ 1× annual income | +100 | 100 |
| Loan-to-Income | ≤ 2× annual income | +70 | |
| Loan-to-Income | ≤ 3× annual income | +40 | |
| Age | 25–45 years | +100 | 100 |
| Age | 45–55 years | +60 | |

**Score capped at 850.**

### 4.2 Interest Rate Bands

| Score Range | Band | Interest Rate | Outcome |
|---|---|---|---|
| 750 – 850 | Excellent | 10.5% p.a. | Auto Approve |
| 700 – 749 | Good | 12.5% p.a. | Auto Approve |
| 650 – 699 | Fair | 15.0% p.a. | Auto Approve |
| 600 – 649 | Below Average | 18.0% p.a. | Auto Approve |
| 300 – 599 | Poor | 24.0% p.a. | Reject / Counter Offer |

**Eligibility rules:**
- Credit score must be ≥ 600
- Total DTI (existing EMI + proposed EMI) ÷ income must be ≤ 50%

### 4.3 EMI Amortization Engine

Standard reducing-balance formula:

```
EMI = P × r × (1+r)^n  ÷  ((1+r)^n − 1)

Where:
  P = Principal amount disbursed
  r = Monthly interest rate (annual_rate ÷ 12 ÷ 100)
  n = Tenure in months
```

Upon disbursement, a complete month-by-month repayment schedule is generated and persisted in the database for the entire loan tenure. Each installment row stores: principal component, interest component, EMI amount, outstanding balance, due date, and payment status.

### 4.4 Dynamic Counter-Offer

When a borrower's requested amount exceeds their eligible limit, NexLoan does not simply reject. It calculates the maximum amount the borrower qualifies for and presents a counter-offer. If the eligible amount is at least ₹50,000, the borrower can accept or decline — converting a rejection into a partial approval.

---

## 5. Complete Feature Set

### 5.1 Borrower Features

- **Passwordless Authentication** — Email OTP login via Brevo REST API. No passwords stored. Redis-backed OTP with 5-minute TTL and rate limiting (3 requests/hour per IP).
- **Loan Readiness Score** — 60-second pre-qualification tool. Estimates eligible amount and interest rate without KYC or credit bureau impact.
- **Smart Application Flow** — Multi-step form with live EMI calculation, real-time interest cost preview, and intelligent collateral requirement detection based on loan amount.
- **AI-Powered KYC** — Upload PAN and Aadhaar cards. Triple-Layer AI pipeline runs automatically. Results shown in seconds with plain-English verdict.
- **Live Application Tracker** — Visual milestone timeline from Inquiry through Closure, sourced directly from the audit log.
- **EMI Dashboard** — Full amortization schedule with paid/pending/overdue/paused status, Razorpay-integrated payment flow, and one-click EMI payment.
- **EMI Pause** — Defer one EMI per year with no penalty. The paused installment moves to the end of the tenure. Brevo confirmation sent automatically.
- **Financial Health Dashboard** — Real-time interest savings calculator for prepayments, credit score trajectory, and Groq-generated weekly financial tips cached per user.
- **Pre-Closure** — Request early settlement via a secure 24-hour tokenized link. Charges calculated per client policy. T&C acceptance enforced.
- **Loan Closure Celebration** — Animated closure screen with journey metrics (total repaid, interest saved, score improvement) and an instant pre-approved loyalty offer.
- **Downloadable Statements** — EMI payment statement, annual interest certificate (Section 24 IT filing), and account statement — all as client-branded PDFs via WeasyPrint.
- **Loan Comparison Tool** — Side-by-side comparison of up to two loan scenarios with EMI, total interest, total cost, and affordability analysis relative to income.
- **Support Tickets** — Raise persistent support tickets with asynchronous chat-style communication with loan officers. Status tracking included.
- **Callback Requests** — Request a callback with a reason, preferred time slot (Morning / Afternoon / Evening), and phone number. Loan officer sees full context before calling.
- **In-App Notifications** — Bell icon with unread badge. Notification center for EMI reminders, approval updates, and system alerts.
- **Multi-Language Foundation** — i18n infrastructure built with next-intl. English complete. Hindi, Kannada, Telugu ready for translation.

### 5.2 Loan Officer Features

- **Work Queue Dashboard** — Prioritized queue of all loans requiring officer action, with amber/red urgency indicators based on queue depth and wait time.
- **Two-Panel Loan Review** — Select a loan from the queue to see full borrower profile, KYC document previews, AI narrative report, credit score breakdown, and action buttons side by side.
- **KYC Override** — Verifiers can override AI verdicts with mandatory reason documentation for compliance.
- **Internal Notes** — Loan officers can add internal notes to any loan. Notes are visible to all officers and admin but not to borrowers.
- **Support Ticket Management** — Respond to borrower support tickets and escalations directly from the officer panel.
- **Callback Queue** — Manage and track callback requests with full borrower context pre-loaded.
- **Operation Status Indicators** — Real-time display of review queue depth and disbursement pipeline status with color-coded urgency dots.

### 5.3 Admin Features

- **Tenant Configuration** — Full white-label branding control: logo, primary color, name, tagline, email sender name, and footer legal text.
- **Financial Parameter Config** — Set min/max loan amounts, tenure limits, pre-closure charge rates, free period months, and collateral thresholds per deployment.
- **Feature Flags** — Enable or disable EMI pause, pre-closure, loan comparison, collateral loans, and multi-language support per client deployment.
- **Employee Management** — Create loan officers, verifiers, and underwriters. Assign departments. Track transfer history via `employee_history` table.
- **Role-Based Access Control** — Granular permissions per role. No user can perform actions outside their role's permission set.
- **Admin Delegation** — Assign temporary specific permissions to a colleague during leave. Permissions are granular (not full role transfer).
- **Media Library** — Upload and manage logos, email headers, and announcement banners stored in Cloudflare R2.
- **Announcement System** — Post platform-wide announcements to the borrower dashboard with configurable color coding and active toggle.
- **Metrics Dashboard** — Total loans, approval rate, revenue, active loans, 7-day volume bar chart, and status breakdown visualization.
- **Enquiry Management** — View and manage service enquiries from prospective borrowers with status pipeline and officer assignment.
- **Reapply Reminders** — Track rejected borrowers due for 90-day improvement follow-up. Send reminder emails with personalized improvement plans.
- **Statement Automation** — Toggle monthly auto-statements for all active borrowers. Manual statement generation available per loan.

---

## 6. Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| Frontend Framework | Next.js 15 (App Router) | SSR, routing, API integration |
| Frontend Language | TypeScript | Type safety, zero `any` policy |
| Styling | Tailwind CSS + CSS Tokens | Utility-first with design system tokens |
| 3D Graphics | Three.js + React Three Fiber | Interactive 3D CreditCoin visual |
| Animations | Framer Motion | Page transitions, card stagger, modals |
| Icons | Lucide React | Consistent SVG icon library |
| i18n | next-intl | Multi-language support infrastructure |
| Backend Framework | FastAPI (Python 3.12) | Async REST API, auto-generated docs |
| ORM | SQLAlchemy 2.0 Async | Type-safe async database operations |
| DB Migrations | Alembic | Version-controlled schema migrations |
| Database | PostgreSQL (Supabase) | Primary relational data store |
| Cache / Sessions | Redis (Upstash) | OTP storage, chat sessions, config cache |
| Document Storage | Cloudflare R2 | KYC documents and media (10GB free) |
| AI Layer 1 | Groq — Llama 3.2 Vision | KYC document field extraction |
| AI Layer 2 | HuggingFace — LayoutLM DocVQA | Document structure understanding |
| AI Layer 3 | HuggingFace — BERT NER | Name extraction and fraud detection |
| AI Fallback | Pytesseract (local) | OCR fallback, no external API dependency |
| AI Text / Chat | Groq — Llama 3.1 70B | Chatbot, improvement plans, tips |
| Email | Brevo REST API | OTP, transactional emails, statements |
| Payments | Razorpay (sandbox) | EMI payment integration with simulation |
| Task Scheduling | APScheduler | EMI reminders, monthly statements |
| PDF Generation | WeasyPrint | Statements, certificates, KFS documents |
| Rate Limiting | SlowAPI | Auth endpoint protection |
| Error Monitoring | Sentry | Production error tracking + PII scrubbing |
| Uptime Monitoring | UptimeRobot | Health check polling + downtime alerts |
| CI/CD | GitHub Actions | Lint, typecheck, build, secret scan, deploy |
| Frontend Deploy | Vercel | Zero-config Next.js deployment |
| Backend Deploy | Render | Python ASGI server hosting |

---

## 7. System Architecture

### 7.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                FRONTEND  (Vercel)                   │
│   Next.js 15 + TypeScript + Tailwind CSS            │
│   Borrower UI  |  Officer UI  |  Admin UI           │
└────────────────────┬────────────────────────────────┘
                     │  HTTPS / REST API (JWT Auth)
┌────────────────────▼────────────────────────────────┐
│                BACKEND  (Render)                    │
│   FastAPI Python 3.12 + SQLAlchemy 2.0 Async        │
│   Auth | Loans | KYC | Payments | Admin | Chat      │
│   AI Pipeline | APScheduler | WeasyPrint PDF        │
└──────┬──────────────┬────────────┬──────────────────┘
       │              │            │
  PostgreSQL       Redis      Cloudflare R2
  (Supabase)     (Upstash)    (KYC Docs)
                              
       │              │
  Groq API        HuggingFace
  (Vision+Text)   (LayoutLM+NER)
```

### 7.2 Loan State Machine

Every loan is governed by a strict state machine. Invalid transitions return HTTP 400. Every valid transition writes to the immutable `AuditLog`.

```
INQUIRY → APPLICATION → KYC_PENDING → KYC_VERIFIED
                                            │
                                      UNDERWRITING
                                      ┌─────┴──────┐
                                   APPROVED    REJECTED
                                 COUNTER_OFFERED
                                      │
                                  DISBURSED → ACTIVE
                                                │
                              ┌─────────────────┤
                           CLOSED          PRE_CLOSED
```

### 7.3 Database Schema

| Table | Purpose & Key Fields |
|---|---|
| `users` | Borrowers, officers, admins. Stores role, department, employee_id, is_active. |
| `loans` | Central entity. All lifecycle fields, credit score, DTI, collateral, EMI, status. |
| `emi_schedule` | Month-by-month amortization. Principal, interest, balance, status per row. |
| `payments` | Razorpay order IDs and payment records per EMI installment. |
| `kyc_documents` | R2 document URLs, AI extracted fields, confidence score, verdict per loan. |
| `audit_logs` | Immutable ledger of every state change. Actor, from/to status, metadata, timestamp. |
| `support_tickets` | Borrower-initiated support requests with status pipeline. |
| `ticket_messages` | Chat-style messages per ticket from borrower and officer. |
| `callback_requests` | Callback requests with reason, preferred time slot, status. |
| `notifications` | In-app notifications per user with read/unread state. |
| `tenant_config` | Full white-label configuration. Branding, features, financial params. |
| `admin_delegations` | Temporary permission grants between employees with date range. |
| `service_enquiries` | Pre-application loan enquiries from prospective borrowers. |
| `employee_history` | Department and role change history for transfer tracking. |
| `chat_messages` | Persistent chatbot conversation history for cross-session memory. |

---

## 8. Security & Compliance

### 8.1 Authentication & Session Management

- Passwordless OTP login via Brevo REST API. No passwords ever stored or transmitted.
- OTPs stored in Redis with 5-minute TTL. Deleted immediately upon successful verification.
- JWT tokens encode `user_id`, `mobile`, and `role`. Signed with HS256. 24-hour expiry.
- Rate limiting: 3 OTP requests/hour per IP, 10 verification attempts/hour. Enforced via SlowAPI.
- All protected endpoints require `Authorization: Bearer <token>` header.

### 8.2 Data Privacy

- Aadhaar numbers masked before database storage: `XXXX-XXXX-1234` format. Raw number never persisted.
- KYC document images stored in Cloudflare R2 with private access only.
- Sentry configured with PII scrubbing — PAN numbers, Aadhaar numbers, OTPs, and KYC fields are redacted before any error event is sent.
- Request bodies containing KYC data are never logged.

### 8.3 RBI Digital Lending Compliance

- **Key Fact Statement (KFS)** generated and presented before disbursement. Borrower acknowledgment required.
- **3-day cooling-off period** — Borrower can cancel loan within 3 days of disbursement with no penalty.
- **DLA & LSP disclosures** shown to all users on the platform.
- **Immutable audit trail** for every state change. `AuditLog` table is append-only.
- **Regulatory footer** on all pages: full registered name and RBI/NBFC registration number.
- **Aadhaar masking** before storage per RBI data privacy guidelines.

### 8.4 Role-Based Access Control

| Role | Permissions |
|---|---|
| `BORROWER` | View and manage own loans only. Submit applications. Make payments. |
| `LOAN_OFFICER` | View all loans. Process disbursements. Mark EMI paid. Manage support. |
| `VERIFIER` | View all loans. Approve or reject KYC. Cannot make credit decisions. |
| `UNDERWRITER` | View all loans. Run underwriting. Approve, reject, or counter-offer. |
| `ADMIN` | Full operational access. Configure tenant settings. Manage employees. |
| `SUPER_ADMIN` | All admin permissions plus role management and system-level config. |

---

## 9. DevOps & Engineering Practices

### 9.1 Repository Structure

NexLoan uses a **monorepo** managed in a single GitHub repository.

```
nexloan/
├── backend/          FastAPI application
├── frontend/         Next.js application
├── ai-pipeline/      Standalone AI evaluation framework
│   ├── extractors/   Individual layer implementations
│   ├── evaluations/  Test documents + eval runner
│   └── prompts/      Prompt files (version controlled)
├── infra/            Render config, nginx
├── docs/             Architecture docs, ADRs, runbooks
└── .github/
    ├── workflows/    ci.yml, deploy.yml, ai-eval.yml
    └── PULL_REQUEST_TEMPLATE.md
```

### 9.2 Branching Strategy

```
main           ← Production. Protected. No direct pushes. Ever.
  └── staging  ← Testing. All features merge here first.
        ├── feature/NL-42-co-applicant
        ├── fix/NL-55-kyc-500-error
        ├── ai/NL-61-layoutlm-improvement
        └── hotfix/NL-99-otp-failure   ← Branches from main
```

**Branch naming convention:**

| Type | Pattern | Example |
|---|---|---|
| Feature | `feature/NL-XX-description` | `feature/NL-42-co-applicant` |
| Bug fix | `fix/NL-XX-description` | `fix/NL-55-kyc-500-error` |
| AI pipeline | `ai/NL-XX-description` | `ai/NL-61-layoutlm-improvement` |
| Infrastructure | `infra/NL-XX-description` | `infra/NL-70-render-pipeline` |
| Hotfix | `hotfix/NL-XX-description` | `hotfix/NL-99-otp-failure` |

### 9.3 CI/CD Pipeline

**CI — runs on every PR to `main` or `staging`:**
- Backend Python: Ruff lint + format check + mypy type check + import validation + hardcoded secret scan
- Frontend: TypeScript `tsc --noEmit` + ESLint + full production build
- Security: Gitleaks secret scanner on full git history
- AI pipeline: Prompt file validation + syntax check (on `ai/` branches)

**CD — triggers on merge to `main`:**
- Triggers Render deploy hook for backend
- Polls `GET /health` until deployment is confirmed healthy
- Triggers Vercel deploy hook for frontend
- Posts deployment status notification

**Commit message format:**
```
feat:     new feature
fix:      bug fix
ai:       AI pipeline change
infra:    CI/CD or infrastructure
refactor: code change, no functional change
docs:     documentation only
```

### 9.4 Code Review Rules

| Change Type | Reviewer Required |
|---|---|
| Frontend UI | Any other engineer |
| Backend feature | Any other engineer |
| Auth / payments / KYC | Team lead must review |
| AI pipeline | Team lead + AI engineer |
| CI/CD / infrastructure | Team lead only |

**Rules:** No self-approvals. No merges without at least 1 approval. CI must be green. All PR checklist items checked.

### 9.5 Monitoring

| Tool | Purpose |
|---|---|
| **Sentry** | Captures all unhandled exceptions. Staging and production environments separate. PII scrubbing enabled. |
| **UptimeRobot** | Pings `/health` every 5 minutes. Sends email alert on downtime. Also keeps Render free tier alive. |
| **`GET /health`** | Returns database, Redis, and API key status. Returns HTTP 503 if any dependency is degraded. |

---

## 10. Development Setup

### 10.1 Prerequisites

- Node.js v20+
- Python 3.12+
- PostgreSQL (local or [Supabase](https://supabase.com) free tier)
- Redis (local or [Upstash](https://upstash.com) free tier)
- Tesseract OCR installed on system path
  - **Windows:** Download from [UB Mannheim](https://github.com/UB-Mannheim/tesseract/wiki), install to `C:\Program Files\Tesseract-OCR\`
  - **Linux:** `sudo apt-get install tesseract-ocr`
  - **Mac:** `brew install tesseract`

### 10.2 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in all values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis URL (`rediss://` for Upstash SSL, `redis://` for local) |
| `JWT_SECRET` | Strong random secret for JWT signing |
| `GROQ_API_KEY` | Groq Cloud API key (`gsk_...`) |
| `BREVO_API_KEY` | Brevo transactional email key (`xkeysib-...`) |
| `HF_API_KEY` | Hugging Face Inference API token (`hf_...`) |
| `R2_ACCOUNT_ID` | Cloudflare R2 account identifier |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `R2_BUCKET_NAME` | R2 bucket name for KYC document storage |
| `R2_PUBLIC_URL` | Public URL for R2 bucket access |
| `EMAIL_FROM` | Verified sender address in Brevo |
| `SENTRY_DSN` | Sentry DSN (leave empty to disable) |
| `ENVIRONMENT` | `local` \| `staging` \| `production` |
| `TENANT_ID` | Client identifier for white-label config |

Copy `frontend/.env.local.example` to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_SENTRY_DSN=              # leave empty for local
NEXT_PUBLIC_ENVIRONMENT=local
```

### 10.3 Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8001

# API docs available at:
# http://localhost:8001/docs
```

### 10.4 Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Application available at:
# http://localhost:3000
```

### 10.5 Local Development Notes

> **OTP bypass:** The backend accepts `123456` as a universal master OTP for any email address during local development. This bypasses the Brevo API call for faster testing.

> **Razorpay simulation:** Razorpay is in simulation mode by default. No real payment credentials required locally.

> **HuggingFace cold starts:** LayoutLM may take 20–30 seconds to respond on first call due to free-tier model cold starts. The system retries automatically up to 3 times with 20-second waits.

> **DEBUG mode:** Set `DEBUG=true` in `backend/.env` to see full Python tracebacks in API error responses. Always `DEBUG=false` in production.

---

## 11. End-to-End User Journey

```
1. LANDING & REGISTRATION
   ─────────────────────────────────────────────────────────────────────
   Borrower arrives at the client-branded page (client logo, name, tagline).
   Enters name, email, and mobile number to register.

2. OTP VERIFICATION
   ─────────────────────────────────────────────────────────────────────
   6-digit OTP sent to email via Brevo. 6-box input with auto-advance
   and paste support. JWT issued on success.

3. LOAN READINESS CHECK (Optional)
   ─────────────────────────────────────────────────────────────────────
   60-second instant estimate of likely approval amount and rate.
   No KYC required. No credit bureau impact.

4. SMART APPLICATION (Steps 1–4)
   ─────────────────────────────────────────────────────────────────────
   Step 1: Personal details (pre-filled from auth)
   Step 2: Loan requirements — sliders with live EMI preview
   Step 3: KYC upload — PAN + Aadhaar with AI verification display
   Step 4: Confirmation screen with loan reference number

5. AI KYC VERIFICATION
   ─────────────────────────────────────────────────────────────────────
   Live animated display shows each layer executing:
   Groq Vision → LayoutLM → BERT NER → Decision
   Verdict shown with plain-English explanation.

6. UNDERWRITING DECISION
   ─────────────────────────────────────────────────────────────────────
   Theoremlabs Credit Score displayed with band label.
   ● APPROVED → sanction email sent, proceed to disbursement
   ● COUNTER OFFERED → partial amount presented for acceptance
   ● REJECTED → Groq-generated 3-step improvement plan + 90-day reminder

7. DISBURSEMENT
   ─────────────────────────────────────────────────────────────────────
   Loan officer reviews in officer dashboard, processes disbursement.
   Complete EMI amortization schedule generated and persisted.

8. SERVICING
   ─────────────────────────────────────────────────────────────────────
   Borrower pays EMIs via Razorpay. Can pause 1 EMI/year.
   Financial health dashboard shows prepayment impact.
   Downloadable statements available anytime.

9. CLOSURE
   ─────────────────────────────────────────────────────────────────────
   Final EMI payment triggers zero-touch closure automatically.
   Closure celebration page: confetti → journey stats → No-Dues Certificate.
   Instant pre-approved loyalty offer at discounted rate.
```

---

## Architecture Decision Records

Key architectural decisions are documented in `docs/adr/`:

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Monorepo structure over polyrepo | Accepted |
| ADR-002 | Single-tenant per client (not multi-tenant) | Accepted |
| ADR-003 | Prompt files version-controlled (not hardcoded) | Accepted |
| ADR-004 | WeasyPrint for PDF (no external service) | Accepted |

---

## Contributing

1. Pick a ticket from Linear (`NL-XX`)
2. Create a branch: `git checkout -b feature/NL-XX-description`
3. Build and test locally
4. Open PR targeting `staging` with the PR template filled completely
5. CI must pass. At least 1 reviewer approval required.
6. Squash and merge.

See `docs/branching-strategy.md` for the complete workflow.

---

## License

Proprietary — Theoremlabs & Product Advisory Consulting LLC. All rights reserved.

---

*NexLoan — Built with AI, designed for humans.*
*A Theoremlabs Product · [theoremlabs.io](https://theoremlabs.io)*
