# NexLoan — White Label & Enterprise Features
## prompt4.md — For Antigravity AI Coding Agent

---

> **READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE.**
>
> This prompt transforms NexLoan from a single-tenant product into a
> white-label B2B lending platform. This is an architectural evolution,
> not a feature addition. Every section must be executed in order.
> Do not skip sections. Do not combine steps. Do not improvise.
>
> **What "white label" means here:**
> One NexLoan codebase. One deployment per client (bank/NBFC/credit union).
> Each deployment has its own branding, its own database, its own config.
> The client never sees "NexLoan" — they see their own brand.
> Theoremlabs is invisible to the end user.

---

## PART 0 — CRITICAL REMOVALS FIRST

Before building anything new, remove the following from the existing codebase.

### Remove: Loan Readiness Score Landing Page

The current landing page (`/` or `/landing`) with the "Know before you apply"
readiness checker widget must be completely removed.

**Files to delete:**
- `frontend/app/page.tsx` (the readiness checker landing page)
- `frontend/components/landing/ReadinessChecker.tsx`
- `frontend/components/landing/HeroSection.tsx`
- Any imports of these components in `layout.tsx`

**Replace with:** The white-label client branding page (specified in Section 2).

**Backend to keep:** `POST /api/readiness/check` endpoint stays — it may be
used internally. Just remove the public-facing UI for it.

---

## PART 1 — WHITE LABEL ARCHITECTURE

---

### 1.1 — The White Label Model

**Deployment model: One deployment per client (Option A — Single Tenant)**

Each client gets:
- Their own Render backend service
- Their own Vercel frontend deployment
- Their own PostgreSQL database (Supabase project)
- Their own Redis instance (Upstash)
- Their own Cloudflare R2 bucket
- Their own environment variables

What is shared across all deployments:
- The codebase (one GitHub repo)
- The CI/CD pipeline
- Updates and bug fixes (deploy to all clients when ready)

**How branding works:**
A single `tenant_config.json` file (or environment variable) tells the
frontend and backend who the client is and what their brand looks like.
Changing this file changes the entire look and feel of the product.

---

### 1.2 — New Database Table: `tenant_config`

Add to `backend/app/models/loan.py`:

```python
class TenantConfig(Base):
    __tablename__ = "tenant_config"

    id                      = Column(UUID(as_uuid=True), primary_key=True,
                                     default=uuid.uuid4)
    # Identity
    tenant_id               = Column(String(50), unique=True, nullable=False)
    # e.g. "hdfc-bank", "axis-nbfc", "kotak-finance"
    client_name             = Column(String(200), nullable=False)
    # e.g. "HDFC Bank Personal Loans"

    # Branding
    logo_url                = Column(String(500))
    # URL to client's logo (stored in R2)
    favicon_url             = Column(String(500))
    primary_color           = Column(String(7), default="#1A1A2E")
    # Hex color — used for buttons, accents, active states
    secondary_color         = Column(String(7), default="#F5F5F5")
    font_family             = Column(String(100), default="Inter")
    tagline                 = Column(String(300))
    # e.g. "Personal Loans, Simplified" — shown on auth page

    # Contact & Legal
    support_email           = Column(String(200))
    support_phone           = Column(String(20))
    website_url             = Column(String(300))
    terms_url               = Column(String(300))
    privacy_url             = Column(String(300))
    registered_name         = Column(String(300))
    # Full legal name e.g. "HDFC Bank Limited"
    rbi_registration        = Column(String(100))
    # RBI/NBFC registration number

    # Email Branding
    email_from_name         = Column(String(200))
    # e.g. "HDFC Bank Loans" — shown in From field of emails
    email_from_address      = Column(String(200))
    email_header_color      = Column(String(7), default="#1A1A2E")
    email_logo_url          = Column(String(500))

    # Feature Flags — enable/disable features per client
    feature_preclosure      = Column(Boolean, default=True)
    feature_emi_pause       = Column(Boolean, default=True)
    feature_loan_comparison = Column(Boolean, default=True)
    feature_collateral_loans = Column(Boolean, default=False)
    feature_multi_language  = Column(Boolean, default=False)
    feature_support_chat    = Column(Boolean, default=True)

    # Financial Config
    default_preclosure_rate         = Column(Float, default=2.0)
    # % charge on outstanding principal
    preclosure_free_months          = Column(Integer, default=6)
    # No preclosure allowed in first N months
    preclosure_early_charge_rate    = Column(Float, default=10.0)
    # Extra % charge if closed within preclosure_free_months
    preclosure_link_validity_hours  = Column(Integer, default=24)
    max_loan_amount                 = Column(Float, default=2500000)
    min_loan_amount                 = Column(Float, default=50000)
    max_tenure_months               = Column(Integer, default=60)
    min_tenure_months               = Column(Integer, default=12)

    # Announcement / Media
    announcement_text       = Column(Text)
    # Shown as a banner on borrower dashboard
    announcement_active     = Column(Boolean, default=False)
    announcement_color      = Column(String(7), default="#F59E0B")
    # amber for info, red for urgent

    # Collateral Policy (JSON — flexible per client)
    collateral_policy       = Column(JSON, default={})
    # {
    #   "threshold_amount": 1000000,  ← loans above this need collateral
    #   "accepted_types": ["gold", "property", "fd"],
    #   "valuation_required": true
    # }

    # Department Config (JSON)
    departments             = Column(JSON, default=[])
    # ["Credit", "Operations", "Customer Service", "Risk", "Collections"]

    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow,
                                     onupdate=datetime.utcnow)
```

### 1.3 — Tenant Config API

Add to `backend/app/routers/admin.py`:

```
GET  /api/admin/tenant-config
     — Returns full tenant config (admin only)

PUT  /api/admin/tenant-config
     — Updates tenant config fields (admin only)
     — On update: invalidate frontend config cache

POST /api/admin/tenant-config/logo
     — Upload new logo to R2, update logo_url in tenant_config

GET  /api/config
     — PUBLIC endpoint (no auth)
     — Returns SAFE subset of tenant config for frontend:
       {client_name, logo_url, primary_color, secondary_color,
        tagline, support_email, support_phone, feature_flags,
        announcement_text, announcement_active, announcement_color,
        registered_name, terms_url, privacy_url}
     — Cache this response in Redis for 5 minutes
     — Frontend calls this on every page load
```

### 1.4 — Environment Variable for Tenant Identity

Add to `backend/.env`:
```env
TENANT_ID=nexloan-default
# This identifies which client this deployment serves
# Each client's deployment has a different value:
# hdfc-bank, axis-nbfc, kotak-finance, etc.
```

On startup, `init_db()` checks if a `tenant_config` row exists for this
`TENANT_ID`. If not, creates one with defaults. Admin then customizes
through the admin panel.

---

## PART 2 — NEW FIRST PAGE: WHITE LABEL BRANDING PAGE

**This replaces the removed landing page entirely.**

The new first page is the **client's branded login entry point**.
When anyone visits the root URL (`/`), they see this page.
It is 100% driven by the `GET /api/config` response.

### 2.1 — Page: `/` (Auth Entry — White Label)

**File:** `frontend/app/page.tsx`

**Layout:** Two-column split. Left 45%, right 55%.

**Color scheme for this page:**
- Background: pure white `#FFFFFF`
- Left panel background: client's `primary_color` (from tenant config)
- Right panel background: white
- All text follows the 75% white / 25% grey proportion rule
- Zero dark mode on this page — always light

**Left Panel (client branding):**

```
┌─────────────────────────────────────┐
│  [CLIENT LOGO — from tenant config] │
│  Large, centered, max 200px wide    │
│                                     │
│  [CLIENT NAME]                      │
│  Large, bold, white text            │
│  font: var(--font-display)          │
│  font-size: 36px                    │
│                                     │
│  [TAGLINE]                          │
│  White text, 60% opacity            │
│  font-size: 18px                    │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [ANNOUNCEMENT BANNER]              │
│  Only shown if announcement_active  │
│  Rounded card, announcement_color   │
│  background at 20% opacity          │
│  announcement_text displayed        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Bottom of panel:                   │
│  "Powered by NexLoan"               │
│  Very small, white, 40% opacity     │
│  This is the ONLY place NexLoan     │
│  branding appears to end users      │
└─────────────────────────────────────┘
```

**Right Panel (auth form):**

```
┌─────────────────────────────────────┐
│  "Welcome back"                     │
│  font-size: 28px, font-weight: 700  │
│  color: #111111                     │
│                                     │
│  "Sign in to your account"          │
│  font-size: 14px, color: #6B7280    │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Full Name input]    (register)    │
│  [Email input]                      │
│  [+91 Mobile input]                 │
│                                     │
│  [Continue button]                  │
│  Background: client primary_color   │
│                                     │
│  "Already registered? Sign in"      │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Footer:                            │
│  "[registered_name]"                │
│  "[rbi_registration]"               │
│  "[terms_url] · [privacy_url]"      │
│  All in #9CA3AF, font-size: 11px    │
└─────────────────────────────────────┘
```

**Dynamic behavior:**
- The entire page calls `GET /api/config` on load
- While loading: show a skeleton (grey placeholder boxes)
- Logo, name, tagline, primary color, announcement — all from API
- If `announcement_active` is false: left panel shows logo + name + tagline only
- Button color = client's `primary_color`

**Mobile (< 640px):**
- Left panel collapses to a top banner (80px tall)
- Shows logo + client name horizontally
- Auth form fills the rest of the screen

---

## PART 3 — DASHBOARD REDESIGN

**Design rules (non-negotiable):**
- Color proportion: 75% white, 25% grey
- Zero dark backgrounds on any dashboard page
- Zero excessive colors — only use client's `primary_color` for accents
- Minimalistic — every element must earn its place
- One-click process flow — the most common action on each screen
  is always the most prominent element
- No horizontal scrolling ever
- Reduce vertical scrolling — above-the-fold content must be meaningful

### 3.1 — Design Tokens for Dashboard (Light Mode Only)

```css
/* Dashboard-specific tokens — override tokens.css for dashboard pages */
--dash-bg:           #F9FAFB;   /* page background — off-white */
--dash-surface:      #FFFFFF;   /* cards */
--dash-border:       #E5E7EB;   /* borders — grey-200 */
--dash-border-hover: #D1D5DB;   /* hover borders */
--dash-text-primary:   #111827; /* almost black */
--dash-text-secondary: #6B7280; /* grey-500 */
--dash-text-tertiary:  #9CA3AF; /* grey-400 */
--dash-accent:       var(--client-primary); /* from tenant config */
--dash-success:      #059669;
--dash-warning:      #D97706;
--dash-error:        #DC2626;
```

Apply `var(--client-primary)` dynamically via JavaScript on page load:
```javascript
document.documentElement.style.setProperty(
  '--client-primary', tenantConfig.primary_color
)
```

### 3.2 — Borrower Dashboard Layout

**File:** `frontend/app/dashboard/page.tsx`

**Layout:** Fixed sidebar (220px) + main content. No horizontal scroll.

```
┌──────────┬────────────────────────────────────────────┐
│          │  [TOP BAR]                                  │
│          │  Client logo (small) + Page title          │
│ SIDEBAR  │  Bell icon + User avatar + Logout          │
│          ├────────────────────────────────────────────┤
│  Logo    │                                             │
│          │  [PENDING TASKS ROW] ← shown immediately   │
│  Nav     │  after login, at very top of content       │
│  links   │                                             │
│          │  [LOAN SUMMARY] [CREDIT SCORE] [DTI]       │
│  ──────  │  Three cards in a row                      │
│          │                                             │
│  Dept:   │  [LOAN STATUS TRACKER]                     │
│  Credit  │  Milestone timeline                        │
│          │                                             │
│  ──────  │  [EMI SCHEDULE TABLE]                      │
│          │  (if loan is ACTIVE)                       │
│  Logout  │                                             │
└──────────┴────────────────────────────────────────────┘
```

**Sidebar contents (top to bottom):**
- Client logo (from tenant config) — 40px tall, centered
- Horizontal rule
- Nav links with icons:
  - Dashboard (home icon)
  - My Loans (document icon)
  - Track Application (pin icon)
  - Statements (download icon)
  - Loan Comparison (scales icon)
  - Support (headset icon)
- Horizontal rule (bottom)
- Employee department label:
  ```
  DEPARTMENT
  Credit Operations
  ```
  Small, grey, non-interactive. Shows current user's department.
- Logout button

### 3.3 — Pending Tasks Section

**Shown immediately after login, before anything else.**
This is the most important change to the dashboard.

```
┌──────────────────────────────────────────────────────┐
│  PENDING TASKS                          3 tasks      │
│  ─────────────────────────────────────────────────── │
│  📋 KYC documents awaiting review          [Review→] │
│  ✍️  Loan NL-2026-00020 awaiting your sign  [Sign→]  │
│  📞 Callback request — slot: Morning       [Call→]   │
└──────────────────────────────────────────────────────┘
```

Rules:
- If zero pending tasks: section is hidden entirely (no empty state shown)
- Each task has a single action button — one click takes the user directly
  to the relevant screen
- Tasks are fetched from a new `GET /api/user/pending-tasks` endpoint
- Tasks are ordered by urgency (overdue first, then by date)
- Badge on the sidebar "Dashboard" nav link shows pending task count

**What constitutes a pending task for a borrower:**
- Loan in KYC_PENDING → "Your documents are being reviewed"
- Loan in COUNTER_OFFERED → "You have a special offer waiting"
- EMI overdue → "EMI #X is overdue by N days"
- Pre-closure request sent → "Pre-closure confirmation pending"
- Callback scheduled → "Callback scheduled for [slot]"
- Support ticket has reply → "Agent replied to your support ticket"

### 3.4 — Operation Status Display

For Loan Officers and Admins only.
Shown in their dashboard pending tasks section.

**Operation 1: Application Review Queue**
```
┌─────────────────────────────────────────────────────┐
│  OPERATION 1 — APPLICATION REVIEW                   │
│  ●  5 applications awaiting review     [Open Queue] │
│     Oldest: 2 hours ago                             │
└─────────────────────────────────────────────────────┘
```

**Operation 2: Disbursement Processing**
```
┌─────────────────────────────────────────────────────┐
│  OPERATION 2 — DISBURSEMENT                         │
│  ●  2 loans approved, pending disburse [Process]    │
│     Total pending: ₹3,40,000                        │
└─────────────────────────────────────────────────────┘
```

Both operations are color-coded:
- Green dot: queue is empty
- Amber dot: 1–5 items pending
- Red dot: 6+ items pending (urgent)

---

## PART 4 — ROLE-BASED ACCESS CONTROL (RBAC)

### 4.1 — Role Definitions

```python
class UserRole(str, Enum):
    BORROWER       = "BORROWER"
    LOAN_OFFICER   = "LOAN_OFFICER"
    VERIFIER       = "VERIFIER"      # KYC verification specialist
    UNDERWRITER    = "UNDERWRITER"   # Credit decision maker
    ADMIN          = "ADMIN"
    SUPER_ADMIN    = "SUPER_ADMIN"
```

### 4.2 — Role Permissions Matrix

| Action | BORROWER | LOAN_OFFICER | VERIFIER | UNDERWRITER | ADMIN | SUPER_ADMIN |
|--------|----------|--------------|----------|-------------|-------|-------------|
| View own loans | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View all loans | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit application | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Verify KYC | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Run underwriting | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve/Reject | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Disburse loan | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Mark EMI paid | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Close loan | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| View admin metrics | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Edit tenant config | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create employees | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage roles | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delegate access | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

### 4.3 — Backend RBAC Implementation

Add to `backend/app/utils/auth.py`:

```python
from functools import wraps
from fastapi import HTTPException

def require_role(*allowed_roles: str):
    """
    FastAPI dependency that checks user role.
    Usage: Depends(require_role("ADMIN", "SUPER_ADMIN"))
    """
    async def role_checker(
        current_user: dict = Depends(get_current_user)
    ) -> dict:
        user_role = current_user.get("role", "BORROWER")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {allowed_roles}. "
                       f"Your role: {user_role}"
            )
        return current_user
    return role_checker

# Usage in routers:
# @router.post("/approve")
# async def approve_loan(
#     current_user = Depends(require_role("UNDERWRITER", "ADMIN", "SUPER_ADMIN"))
# ):
```

Add `role` and `department` to the `users` table:
```python
role            = Column(Enum(UserRole), default=UserRole.BORROWER)
department      = Column(String(100))
# e.g. "Credit", "Operations", "Customer Service", "Risk"
employee_id     = Column(String(50))
# Internal employee ID for non-borrower users
is_active       = Column(Boolean, default=True)
```

Add `role` to the JWT payload when creating tokens:
```python
def create_access_token(user_id: str, mobile: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "mobile": mobile,
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
```

### 4.4 — Employee Management Endpoints

Add to `backend/app/routers/admin.py`:

```
POST /api/admin/employees/create
     — Creates a non-borrower user (LOAN_OFFICER, VERIFIER, etc.)
     — Body: {full_name, email, mobile, role, department, employee_id}
     — Sends welcome email with OTP via Brevo

GET  /api/admin/employees
     — Lists all employees with their roles and departments

PUT  /api/admin/employees/{user_id}/role
     — Changes a user's role (SUPER_ADMIN only)

PUT  /api/admin/employees/{user_id}/department
     — Changes a user's department

DELETE /api/admin/employees/{user_id}/deactivate
     — Soft deactivates a user (is_active = False)
     — They cannot log in but data is preserved
```

---

## PART 5 — ADMIN DELEGATION SYSTEM

### 5.1 — Database Table

```python
class AdminDelegation(Base):
    __tablename__ = "admin_delegations"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    delegator_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    # The admin/officer going on leave
    delegate_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    # The person temporarily receiving access
    permissions     = Column(JSON)
    # List of specific permissions granted:
    # ["approve_loans", "disburse_loans", "view_all_loans"]
    # NOT full role access — only specific actions
    start_date      = Column(DateTime, nullable=False)
    end_date        = Column(DateTime, nullable=False)
    reason          = Column(String(500))
    # e.g. "Annual leave 1–7 May 2026"
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### 5.2 — Delegation Endpoints

```
POST /api/admin/delegation/create
     — Admin creates a delegation
     — Body: {delegate_id, permissions[], start_date, end_date, reason}
     — Sends Brevo email to both delegator and delegate

GET  /api/admin/delegation/active
     — Returns all currently active delegations
     — Shows who is covering for whom

DELETE /api/admin/delegation/{id}/revoke
     — Revokes delegation early

Background job (APScheduler — daily):
     — Deactivates expired delegations (end_date < now)
     — Sends reminder email 1 day before delegation expires
```

### 5.3 — How Delegation Affects Auth

When a user makes a request, check:
1. Their own role permissions
2. Any active delegations they are the `delegate_id` for
3. Union of both gives their effective permissions for this request

```python
async def get_effective_permissions(user_id: str, db: AsyncSession) -> set:
    """Returns all permissions the user currently has,
    including delegated ones."""
    user = await get_user(user_id, db)
    base_permissions = ROLE_PERMISSIONS[user.role]

    active_delegations = await db.execute(
        select(AdminDelegation).where(
            AdminDelegation.delegate_id == user_id,
            AdminDelegation.is_active == True,
            AdminDelegation.start_date <= datetime.utcnow(),
            AdminDelegation.end_date >= datetime.utcnow(),
        )
    )
    delegated = active_delegations.scalars().all()
    extra_permissions = set()
    for d in delegated:
        extra_permissions.update(d.permissions)

    return base_permissions | extra_permissions
```

---

## PART 6 — LOAN APPLICATION WORKFLOW (ENHANCED)

### 6.1 — Clear Stage Definition

The loan workflow now has four explicitly named stages with assigned roles:

```
Stage 1: APPLICATION REVIEW    → LOAN_OFFICER reviews submitted application
Stage 2: VERIFICATION          → VERIFIER checks KYC documents
Stage 3: APPROVAL              → UNDERWRITER makes credit decision
Stage 4: PROCESSING            → LOAN_OFFICER handles disbursement
```

Each stage is a real loan status. Map existing statuses:
```
INQUIRY           → Pre-Stage 1 (borrower filling application)
APPLICATION       → Stage 1 entry (submitted, awaiting review)
KYC_PENDING       → Stage 2 entry (documents uploaded, awaiting verification)
KYC_VERIFIED      → Stage 2 complete (ready for underwriting)
UNDERWRITING      → Stage 3 entry
APPROVED          → Stage 3 complete
COUNTER_OFFERED   → Stage 3 variant
REJECTED          → Stage 3 terminal
DISBURSED         → Stage 4 complete
ACTIVE            → Post-processing (loan running)
```

### 6.2 — Verification Parameters

Add a `VerificationConfig` section to `tenant_config`:

```python
verification_parameters = Column(JSON, default={
    "require_pan": True,
    "require_aadhaar": True,
    "require_salary_slip": False,
    "require_bank_statement": False,
    "require_itr": False,
    "require_form_16": False,
    "min_ai_confidence": 0.6,
    # AI confidence below this → MANUAL_REVIEW
    "allow_manual_override": True,
    # Verifier can override AI verdict
    "override_requires_reason": True,
})
```

Admin can change these from the tenant config settings page.

### 6.3 — Loan Officer Dashboard (`/officer`)

**File:** `frontend/app/officer/page.tsx`

Layout: Two-panel. Left = queue list. Right = selected loan detail.

**Left panel — Work Queue:**
```
WORK QUEUE                          Filter: [All ▼]
──────────────────────────────────────────────────
● NL-2026-00042  MAYUR DOIPHODE    KYC_PENDING
  Submitted 2h ago                 [Review]
● NL-2026-00041  PRIYA SHARMA      APPROVED
  Approved 45min ago               [Disburse]
● NL-2026-00039  RAHUL MEHTA       UNDERWRITING
  Awaiting decision                [Evaluate]
──────────────────────────────────────────────────
```

Color dots: amber = pending action, green = ready to proceed, blue = info

**Right panel — Loan Detail:**
When a queue item is clicked:
- Borrower profile summary
- Loan details
- KYC document previews (PAN + Aadhaar thumbnails, click to expand)
- AI Narrative Report (plain English verdict)
- Action buttons based on current status and officer's role:
  - VERIFIER sees: "Approve KYC" / "Request Additional Docs" / "Reject KYC"
  - UNDERWRITER sees: "Approve" / "Counter Offer" / "Reject" with reason field
  - LOAN_OFFICER sees: "Process Disbursement" / "Send to Borrower"
- Internal notes field — text area, saves on blur, visible to all officers

---

## PART 7 — PRE-CLOSURE MANAGEMENT

### 7.1 — Pre-Closure Config (from TenantConfig)

The admin controls pre-closure entirely from the settings page.
All values come from `tenant_config`:

```
feature_preclosure          = True/False (enable/disable entirely)
default_preclosure_rate     = 2.0 (% of outstanding principal)
preclosure_free_months      = 6 (cannot pre-close in first 6 months)
preclosure_early_charge_rate = 10.0 (% charge if closed in first 6 months)
preclosure_link_validity_hours = 24
```

**Business logic:**

```python
def calculate_preclosure_charges(
    loan: Loan,
    tenant: TenantConfig,
    remaining_schedule: list,
) -> dict:
    months_active = (datetime.utcnow() - loan.disbursed_at).days // 30

    outstanding_principal = sum(row["principal"] for row in remaining_schedule)

    if months_active < tenant.preclosure_free_months:
        # Early closure — apply higher charge
        charge_rate = tenant.preclosure_early_charge_rate
        early_closure_penalty = True
    else:
        # Normal pre-closure
        charge_rate = tenant.default_preclosure_rate
        early_closure_penalty = False

    preclosure_charge = round(outstanding_principal * charge_rate / 100, 2)
    total_payable = round(outstanding_principal + preclosure_charge, 2)

    return {
        "outstanding_principal": outstanding_principal,
        "charge_rate_pct": charge_rate,
        "preclosure_charge": preclosure_charge,
        "total_payable": total_payable,
        "early_closure_penalty": early_closure_penalty,
        "months_active": months_active,
        "free_months_remaining": max(
            0, tenant.preclosure_free_months - months_active
        ),
        "message": (
            f"Note: Closing within the first "
            f"{tenant.preclosure_free_months} months incurs a "
            f"{charge_rate}% charge on outstanding principal."
            if early_closure_penalty else None
        ),
    }
```

### 7.2 — Pre-Closure Secure Link Flow

```
1. Borrower clicks "Request Pre-Closure" on dashboard
2. Backend generates a secure token (UUID + HMAC signed)
3. Token stored in Redis with TTL = preclosure_link_validity_hours * 3600
4. Brevo email sent to borrower with the link:
   https://[client-domain]/preclosure/confirm?token=xxxxx
5. Borrower clicks link → opens pre-closure confirmation page
6. Page shows: outstanding amount, charge, total payable, T&C
7. Borrower must check T&C checkbox before proceeding
8. Borrower clicks "Confirm Pre-closure"
9. Token verified against Redis — if expired: show error page
10. If valid: process pre-closure, send no-dues certificate
```

**New endpoint:**
```
POST /api/closure/{loan_id}/request-preclosure
     — Generates secure token
     — Sends email with link
     — Returns: {message: "Pre-closure link sent to your email"}

GET  /api/closure/preclosure/verify?token=xxx
     — Validates token (not expired)
     — Returns: preclosure quote details + T&C text
     — Does NOT complete the closure yet

POST /api/closure/preclosure/confirm
     — Body: {token, tc_accepted: true}
     — Validates token again
     — tc_accepted must be true or 400 error
     — Processes the closure
     — Deletes token from Redis
     — Sends no-dues certificate email
```

**New page:** `frontend/app/preclosure/confirm/page.tsx`
- Reads `?token=` from URL
- Calls verify endpoint
- Shows quote in a clean card
- T&C text (from tenant_config or hardcoded default)
- Checkbox: "I have read and agree to the pre-closure terms"
- "Confirm Pre-Closure" button — disabled until checkbox checked
- On success: celebration screen (same as closure celebration)
- On expired token: "This link has expired. Please request a new one."

---

## PART 8 — LOAN TYPE MANAGEMENT (COLLATERAL / NON-COLLATERAL)

### 8.1 — Loan Type Logic

Whether a loan requires collateral is determined by:
1. The loan amount vs the client's collateral threshold
2. The client's `collateral_policy` in `tenant_config`

```python
def requires_collateral(loan_amount: float, tenant: TenantConfig) -> bool:
    policy = tenant.collateral_policy
    threshold = policy.get("threshold_amount", float("inf"))
    return loan_amount > threshold
```

### 8.2 — New Fields on Loans Table

```python
loan_type           = Column(String(20), default="NON_COLLATERAL")
# "COLLATERAL" or "NON_COLLATERAL"

# Collateral fields (only used if loan_type = COLLATERAL)
collateral_type     = Column(String(50))
# "gold", "property", "fd", "vehicle"
collateral_value    = Column(Float)
# Estimated market value of collateral
collateral_description = Column(Text)
# Free text description
collateral_doc_url  = Column(String(500))
# Valuation/ownership document stored in R2
collateral_verified = Column(Boolean, default=False)
collateral_verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                                nullable=True)
```

### 8.3 — Collateral in Application Flow

In Step 2 of the application (Loan Requirements):
- After the borrower enters the loan amount
- Frontend calls `GET /api/config` to get `collateral_policy`
- If `loan_amount > threshold_amount`:
  - Show a banner: "Loans above ₹{threshold} require collateral"
  - Show collateral fields: Type (dropdown from accepted_types), Value,
    Description, Document upload
- If below threshold: no collateral fields shown

In the Officer dashboard:
- Collateral loans show a "COLLATERAL" badge on the queue item
- Verifier must mark `collateral_verified = True` before loan can proceed
- Shows collateral document in the verification panel

---

## PART 9 — LOAN SERVICE ENQUIRY MODULE

### 9.1 — Database Table

```python
class ServiceEnquiry(Base):
    __tablename__ = "service_enquiries"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    # Anonymous enquiries allowed — user_id optional
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             nullable=True)
    name            = Column(String(200), nullable=False)
    email           = Column(String(200), nullable=False)
    mobile          = Column(String(15), nullable=False)
    loan_type_interest = Column(String(100))
    # "Personal Loan", "Gold Loan", "Business Loan" etc.
    loan_amount_range = Column(String(50))
    # "₹1L–₹5L", "₹5L–₹25L", "Above ₹25L"
    message         = Column(Text)
    status          = Column(String(20), default="NEW")
    # NEW, CONTACTED, CONVERTED, CLOSED
    assigned_to     = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             nullable=True)
    notes           = Column(Text)
    # Internal officer notes
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow,
                             onupdate=datetime.utcnow)
```

### 9.2 — Enquiry Endpoints

```
POST /api/enquiry/submit     — No auth. Public form submission.
     Sends Brevo notification to admin email.

GET  /api/admin/enquiries    — Admin/Officer sees all enquiries
GET  /api/admin/enquiries/{id} — Single enquiry detail
PUT  /api/admin/enquiries/{id}/status — Update status
PUT  /api/admin/enquiries/{id}/assign — Assign to officer
```

### 9.3 — Enquiry UI

**Public enquiry form — accessible from the auth page footer link.**
**File:** `frontend/app/enquiry/page.tsx`

Simple clean form (no login required):
- Full Name, Email, Mobile
- "I'm interested in" — pill buttons: Personal Loan / Gold Loan / Business Loan
- Loan amount range — dropdown
- Message (optional)
- Submit button

On submit: success message "Thank you. Our team will contact you within 24 hours."

**In Admin panel:** A tab showing all enquiries with status pipeline
(NEW → CONTACTED → CONVERTED → CLOSED), assignee, and notes.

---

## PART 10 — EMAIL STATEMENT AUTOMATION

### 10.1 — Statement Types

Three statement types, all generated with WeasyPrint:

**1. EMI Payment Statement**
- Table of all paid installments
- Period filter: custom date range or full loan period
- Fields: No, Due Date, Paid Date, EMI Amount, Principal, Interest, Balance
- Totals row at bottom

**2. Interest Certificate (Annual)**
- For Income Tax filing — Section 24 deduction
- Shows total interest paid in a financial year (April–March)
- Formatted as a certificate with client branding/letterhead

**3. Loan Account Statement (Monthly/Yearly)**
- Full account activity
- Opening balance, all transactions, closing balance
- Similar to a bank statement

### 10.2 — Endpoints

```
GET /api/statements/{loan_id}/emi-statement?from_date=&to_date=
    Returns: PDF blob (Content-Type: application/pdf)
    Content-Disposition: attachment; filename="EMI_Statement_NL-2026-00020.pdf"

GET /api/statements/{loan_id}/interest-certificate?financial_year=2025-26
    Returns: PDF blob

GET /api/statements/{loan_id}/account-statement?period=monthly&month=2026-04
    Returns: PDF blob

POST /api/statements/{loan_id}/email-statement
     Body: {statement_type, period, email}
     Generates PDF and sends via Brevo as attachment
     Returns: {message: "Statement emailed to your@email.com"}
```

### 10.3 — Automated Monthly Statement Job

APScheduler job — runs on the 1st of every month at 7 AM:

```python
async def send_monthly_statements():
    """
    Sends monthly statement to all borrowers with ACTIVE loans
    if tenant_config has auto_monthly_statement = True
    """
    active_loans = await get_all_active_loans()
    for loan in active_loans:
        pdf_bytes = generate_account_statement(loan, period="last_month")
        await send_statement_email(
            to_email=loan.user.email,
            name=loan.user.full_name,
            loan_number=loan.loan_number,
            pdf_bytes=pdf_bytes,
            period="Monthly Statement — April 2026"
        )
```

Add `auto_monthly_statement` boolean to `tenant_config`.

### 10.4 — Statement PDF Design

All PDFs use the client's branding:
- Header: client logo + client name + registered address
- Color accent: client's `primary_color`
- Footer: "Powered by NexLoan | [rbi_registration]"
- Watermark: "OFFICIAL DOCUMENT" in light grey diagonal text

---

## PART 11 — MEDIA & ANNOUNCEMENT SECTION

### 11.1 — Media Library

**File:** `frontend/app/admin/media/page.tsx`

Admin can upload and manage:
- Client logo (used everywhere in the product)
- Email header image (used in all Brevo emails)
- Announcement banners (shown to borrowers on dashboard)
- Any promotional images

All files stored in Cloudflare R2 under `media/{tenant_id}/` prefix.

### 11.2 — Endpoints

```
POST /api/admin/media/upload
     — Multipart upload
     — Body: file + type (logo/email_header/banner/general)
     — Stores in R2, returns URL
     — If type=logo: auto-updates tenant_config.logo_url

GET  /api/admin/media/list
     — Lists all uploaded media files with URLs and types

DELETE /api/admin/media/{file_key}
     — Deletes from R2

PUT  /api/admin/announcements
     — Body: {text, active, color}
     — Updates announcement in tenant_config
     — Frontend reads this on next page load
```

### 11.3 — Announcement Banner

**Shown to borrowers on their dashboard — immediately visible, above fold.**

```
┌────────────────────────────────────────────────────────────┐
│ 📢  Festival offer: 0.5% rate reduction on loans above     │
│     ₹2L applied before 30 April. T&C apply.          [×]  │
└────────────────────────────────────────────────────────────┘
```

- Background: `announcement_color` at 10% opacity
- Left border: 3px solid `announcement_color`
- User can dismiss (×) — stores dismissed state in `sessionStorage`
- Dismissal resets on next login
- Admin can update text anytime — takes effect immediately

---

## PART 12 — EMPLOYEE DEPARTMENT TRACKING

### 12.1 — Department Management

Admin can define departments in `tenant_config.departments`:
```json
["Credit", "Operations", "Customer Service", "Risk", "Collections", "Tech"]
```

Each employee user has a `department` field.

### 12.2 — Where Department Is Shown

**In the sidebar (borrower & employee dashboards):**
```
──────────────────
DEPARTMENT
Credit Operations
──────────────────
```
Small, grey label. Non-interactive for borrowers.
For employees: links to their department page.

**In the admin employee list:**
Table columns: Name, Role, Department, Employee ID, Status, Actions

**In loan audit trail:**
When an officer takes an action (approve, verify, disburse):
```
LOAN_APPROVED by John Smith (Underwriting dept) at 9:20 AM
```
The department is stored in the audit log `metadata` JSON field.

### 12.3 — Department Transfer Tracking

When an employee's department is changed via `PUT /api/admin/employees/{id}/department`:
- Previous department stored in an `employee_history` table
- Admin can see transfer history: "Moved from Risk → Credit on 15 Apr 2026"

```python
class EmployeeHistory(Base):
    __tablename__ = "employee_history"
    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    change_type     = Column(String(50))
    # "DEPARTMENT_CHANGE", "ROLE_CHANGE", "DEACTIVATED", "REACTIVATED"
    old_value       = Column(String(200))
    new_value       = Column(String(200))
    changed_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    reason          = Column(String(500))
    created_at      = Column(DateTime, default=datetime.utcnow)
```

---

## PART 13 — ADMIN SETTINGS PAGE

**File:** `frontend/app/admin/settings/page.tsx`

A single, comprehensive settings page for the admin. Organized into tabs.

### Tab 1 — Branding
- Logo upload (drag and drop + preview)
- Client name, tagline
- Primary color (color picker)
- Email from name, email from address
- Save button — calls `PUT /api/admin/tenant-config`

### Tab 2 — Loan Products
- Min/max loan amount (number inputs)
- Min/max tenure (number inputs)
- Collateral threshold amount
- Accepted collateral types (multi-select checkboxes)
- Verification parameters (checkboxes for required documents)

### Tab 3 — Pre-Closure
- Enable/Disable pre-closure toggle (big, prominent)
- Default pre-closure charge rate (%)
- Free period months (number)
- Early closure charge rate (%)
- Link validity hours
- T&C text (rich text area — plain text for now)
- Save button

### Tab 4 — Notifications
- Auto monthly statement toggle
- EMI reminder days (7 days / 1 day / day-of toggles)
- Announcement management (text, color, active toggle)

### Tab 5 — Team
- Employee list table
- Add employee button
- Change role dropdown per employee
- Deactivate button per employee
- View transfer history button

### Tab 6 — Delegation
- Create delegation form: delegate to, permissions, start/end date, reason
- Active delegations table
- Revoke button per delegation

---

## PART 14 — FRONTEND DESIGN RULES (DASHBOARD OVERHAUL)

**These rules override all previous UI specifications for dashboard pages.**
The new design is light, minimal, professional.

### Color Usage Rules (STRICT)

```
75% of every page must be: white (#FFFFFF) or off-white (#F9FAFB)
25% of every page can be: grey tones (#E5E7EB, #D1D5DB, #9CA3AF)
Accent color (client primary): buttons, active states, key numbers ONLY
Red/amber/green: status indicators only — never decorative
Never: dark backgrounds on dashboard pages
Never: multiple competing accent colors
Never: gradients on cards
```

### Typography Rules

```
Page titles:     24px, font-weight: 700, #111827
Section titles:  16px, font-weight: 600, #111827, uppercase + letter-spacing
Card labels:     11px, font-weight: 500, #6B7280, uppercase, letter-spacing
Body text:       14px, font-weight: 400, #374151
Numbers/amounts: JetBrains Mono, font-weight: 600, #111827
Status labels:   12px, font-weight: 600, uppercase (via Badge component)
```

### Card Design Rules

```
Background:     #FFFFFF
Border:         1px solid #E5E7EB
Border radius:  8px (not 24px — more corporate, less consumer)
Padding:        20px
Shadow:         none (borders do the job)
Hover:          border-color → #D1D5DB only (no translateY)
```

### Table Design Rules

```
Header row:     background #F9FAFB, text #6B7280, uppercase, 11px
Data rows:      background white, border-bottom 1px solid #F3F4F6
Hover row:      background #F9FAFB
Amount columns: right-aligned, JetBrains Mono
Action column:  right-aligned, text buttons (no full-width buttons in tables)
```

### Button Rules

```
Primary:    background=client primary_color, text=white, radius=6px
            padding: 8px 16px (compact — not large blocks)
Secondary:  border=1px #D1D5DB, background=white, text=#374151
Danger:     border=1px #FECACA, background=#FEF2F2, text=#DC2626
Text btn:   no border, no background, color=client primary_color
            used inside tables and for secondary actions
```

### Sidebar Rules

```
Background:     #FFFFFF
Right border:   1px solid #E5E7EB
Width:          220px (fixed, non-collapsible on desktop)
Logo area:      48px tall, padding 16px
Nav item:       height 36px, font-size 14px, color #6B7280
Active nav:     background #F3F4F6, color client primary_color,
                left border 2px solid client primary_color
Hover nav:      background #F9FAFB
Dept label:     bottom of sidebar, font-size 11px, #9CA3AF, uppercase
```

---

## PART 15 — NEW ROUTES SUMMARY

```
Frontend new pages:
/                           White-label branded auth entry
/preclosure/confirm         Secure pre-closure confirmation
/officer                    Loan officer work queue
/admin/settings             Full tenant configuration
/admin/settings/branding    Branding tab (deep link)
/admin/settings/preclosure  Pre-closure tab (deep link)
/admin/settings/team        Team management tab (deep link)
/admin/settings/delegation  Delegation tab (deep link)
/admin/media                Media library
/enquiry                    Public service enquiry form
/admin/enquiries            Admin enquiry management

Backend new endpoint prefixes:
/api/config                 Public tenant config
/api/admin/tenant-config    Admin tenant config CRUD
/api/admin/employees        Employee management
/api/admin/delegation       Delegation management
/api/admin/media            Media upload/list/delete
/api/admin/announcements    Announcement management
/api/admin/enquiries        Enquiry management
/api/statements             PDF statement generation
/api/closure/preclosure/    Secure pre-closure flow
/api/user/pending-tasks     Pending tasks for dashboard
```

---

## PART 16 — DATABASE MIGRATIONS

After all model changes, create and run Alembic migration:

```bash
cd backend
alembic revision --autogenerate -m "white_label_and_enterprise_features"
alembic upgrade head
```

New tables to be created by migration:
- `tenant_config`
- `admin_delegations`
- `service_enquiries`
- `employee_history`

Columns added to existing tables:
- `users`: role, department, employee_id, is_active
- `loans`: loan_type, collateral_type, collateral_value,
           collateral_description, collateral_doc_url,
           collateral_verified, collateral_verified_by
- `tenant_config`: all fields as specified in Part 1

---

## PART 17 — REQUIREMENTS.TXT ADDITIONS

Add to `backend/requirements.txt`:
```
weasyprint==62.3
apscheduler==3.10.4
slowapi==0.1.9         # (if not already added)
```

---

## PART 18 — EXECUTION ORDER

Execute in this exact sequence. Each phase must be complete and working
before starting the next.

```
Phase 1: Remove readiness landing page (Part 0)
Phase 2: Create tenant_config DB table + seed with defaults (Part 1)
Phase 3: Build GET /api/config endpoint (Part 1.3)
Phase 4: Build new white-label first page / (Part 2)
Phase 5: Add RBAC — roles, permissions, JWT changes (Part 4)
Phase 6: Add employee management endpoints (Part 4.4)
Phase 7: Rebuild dashboard layout + pending tasks (Part 3)
Phase 8: Build officer dashboard /officer (Part 6.3)
Phase 9: Build admin delegation system (Part 5)
Phase 10: Build pre-closure secure link flow (Part 7)
Phase 11: Add loan type / collateral fields (Part 8)
Phase 12: Build service enquiry module (Part 9)
Phase 13: Build PDF statement generation (Part 10)
Phase 14: Build media library + announcement system (Part 11)
Phase 15: Build employee department tracking (Part 12)
Phase 16: Build admin settings page (Part 13)
Phase 17: Run Alembic migration (Part 16)
Phase 18: Run full end-to-end verification
```

---

## PART 19 — FINAL VERIFICATION CHECKLIST

**White Label:**
- [ ] `GET /api/config` returns tenant branding without auth
- [ ] First page shows client logo, name, tagline from API
- [ ] Button color matches tenant `primary_color`
- [ ] "Powered by NexLoan" is the ONLY NexLoan reference visible to borrowers
- [ ] Admin can update logo and see change reflected immediately

**RBAC:**
- [ ] BORROWER cannot access `/officer` or `/admin` routes
- [ ] VERIFIER can approve KYC but cannot approve loans
- [ ] UNDERWRITER can approve loans but cannot disburse
- [ ] Delegation temporarily grants specific permissions
- [ ] JWT contains role and is validated on every protected endpoint

**Dashboard:**
- [ ] Pending tasks appear immediately after login
- [ ] Zero pending tasks = section hidden (not empty state)
- [ ] Dashboard is 75% white / 25% grey — no dark backgrounds
- [ ] Client's primary color used only for accents and buttons
- [ ] Department label visible in sidebar for all users

**Pre-Closure:**
- [ ] Secure link generated and sent via Brevo
- [ ] Link expires after configured hours
- [ ] Early closure (within free months) applies higher charge rate
- [ ] T&C checkbox must be checked before confirmation
- [ ] Expired token shows clean error page (not 500)
- [ ] Feature can be completely disabled from admin settings

**Collateral:**
- [ ] Loans above threshold show collateral fields in application
- [ ] Loans below threshold show no collateral fields
- [ ] VERIFIER must mark collateral verified before approval
- [ ] Collateral document stored in R2

**Statements:**
- [ ] PDF downloads correctly with client branding in header
- [ ] Interest certificate shows correct financial year totals
- [ ] Email statement sends PDF as Brevo attachment
- [ ] Monthly auto-statement job runs without errors

**Settings Page:**
- [ ] All 6 tabs load correctly
- [ ] Branding changes reflect immediately after save
- [ ] Pre-closure enable/disable toggle works
- [ ] Employee creation sends welcome email
- [ ] Delegation creation notifies both users via Brevo

**Enquiry:**
- [ ] Public form submits without login
- [ ] Admin sees new enquiry with notification
- [ ] Status pipeline updates correctly

---

*NexLoan White Label Platform — Powered by Theoremlabs*
*prompt4.md — Enterprise Edition*