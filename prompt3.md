# NexLoan Phase 3 — Feature Specification
> Build on top of the existing NexLoan v2.0 codebase (FastAPI backend + Next.js 16 frontend)

---

## Architecture Overview (Current State)

- **Backend:** FastAPI + SQLAlchemy (async) + PostgreSQL (Supabase) + Redis (Upstash) + Brevo email
- **Frontend:** Next.js 16 (Turbopack) + TypeScript + Vanilla CSS
- **Auth:** JWT-based OTP flow. `mayurdoiphode55@gmail.com` = LOAN_OFFICER. All others = BORROWER.
- **Email:** Brevo REST API (`BREVO_API_KEY` in `backend/.env`) — working and tested
- **Port:** Backend runs on `127.0.0.1:8001`. Frontend on `localhost:3000` with rewrite proxy.

---

## Feature 1 — EMI Reminders + In-App Notifications

### 1A. Email Reminders via Brevo (APScheduler)

**Install:** `pip install apscheduler`

**Scheduler setup inside FastAPI lifespan (`app/main.py`):**
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
scheduler.add_job(send_emi_reminders, 'cron', hour=9, minute=0)
scheduler.start()  # in lifespan startup
scheduler.shutdown()  # in lifespan shutdown
```

**`send_emi_reminders` logic (`app/services/reminder_service.py`):**
1. Query all loans with status = `ACTIVE`
2. For each loan, get the next unpaid installment from `loan_schedule`
3. Calculate days until due date
4. Send appropriate Brevo email:
   - `days == 7` → "Your EMI of ₹{amount} is due on {date}"
   - `days == 1` → "Tomorrow is your EMI date — ₹{amount}"
   - `days == 0` → "Today is your EMI day — pay now"
   - `days == -1` → "Your EMI was due yesterday — pay now to avoid impact"
5. Also create a record in the `notifications` table for in-app display
6. Do NOT send duplicate reminders — check `notifications` table for existing entry with same loan_id + type + date

**Email templates:** Reuse `send_otp_email` pattern from `app/services/email_service.py`. Create `send_emi_reminder_email(email, name, amount, due_date, loan_number)`.

---

### 1B. In-App Notification Bell

**New DB table (`notifications`):**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- emi_reminder, emi_paid, loan_approved, etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Add to Alembic migration:** Create `backend/alembic/versions/YYYYMMDD_add_notifications.py`

**New backend router (`app/routers/notifications.py`):**
```
GET  /api/notifications/          → list user's notifications (last 50, newest first)
GET  /api/notifications/unread-count → returns {"count": 3}
PUT  /api/notifications/{id}/read → mark one as read
PUT  /api/notifications/read-all  → mark all as read
```
All routes protected by `get_current_user` dependency.

**Frontend — Notification Bell (`components/NotificationBell.tsx`):**
- Bell icon (🔔) in the top navbar (in `app/(app)/layout.tsx`)
- Shows a red badge with unread count (fetched from `/api/notifications/unread-count`)
- Badge hidden when count = 0
- Clicking opens a dropdown panel showing notifications
- Each notification row: icon (based on type) + title + message + relative time ("2 hours ago")
- Unread notifications have a subtle highlight background
- "Mark all as read" button at the top of the dropdown
- Poll for new notifications every 60 seconds (simple `setInterval`)
- Use the existing `api` axios instance from `lib/api.ts`

**Notification types and icons:**
- `emi_reminder` → 📅
- `emi_paid` → ✅
- `loan_approved` → 🎉
- `loan_disbursed` → 💰
- `kyc_verified` → 🔍
- `support_reply` → 💬
- `callback_scheduled` → 📞

---

## Feature 2 — Live Loan Status Tracker (Milestone Tracker)

### Visual Design

Not a bar chart. A **vertical milestone timeline** — like Swiggy order tracking but for loans.

```
[██████████████████████░░░░░░░░░] 62% Complete
 ↑ Disbursed                          Closed ↑

● Inquiry Created         17 Apr, 9:01 AM ✅
● KYC Uploaded            17 Apr, 9:18 AM ✅
● AI KYC Verification     17 Apr, 9:19 AM ✅ (Score: 756)
● Loan Approved           17 Apr, 9:20 AM ✅ (₹1,00,000 @ 11%)
◉ Disbursement            17 Apr, 9:20 AM ← CURRENT (pulsing dot)
○ First EMI Due           5 May 2026      ⏳
○ Loan Active             —               ○
○ Loan Closed             —               ○
```

### Milestone Definitions (map from audit_logs)

| Milestone | Maps to audit_log action |
|---|---|
| Inquiry Created | `loan_created` |
| KYC Uploaded | `kyc_uploaded` |
| AI KYC Verified | `kyc_verified` |
| Credit Scored | `underwriting_completed` |
| Approved / Counter / Rejected | `loan_approved` / `counter_offered` / `loan_rejected` |
| Disbursed | `loan_disbursed` |
| Repayment Started | first `emi_paid` |
| Loan Closed | `loan_closed` |

### Backend

**New endpoint** in `app/routers/tracking.py`:
```
GET /api/tracking/{loan_id}/timeline
```
Response:
```json
{
  "loan_id": "...",
  "progress_percent": 62,
  "milestones": [
    {
      "key": "inquiry_created",
      "label": "Inquiry Created",
      "status": "completed",   // completed | current | upcoming
      "timestamp": "2026-04-17T09:01:00Z",
      "detail": null
    },
    {
      "key": "disbursed",
      "label": "Disbursement Processing",
      "status": "current",
      "timestamp": "2026-04-17T09:20:00Z",
      "detail": null
    },
    {
      "key": "first_emi",
      "label": "First EMI Due",
      "status": "upcoming",
      "timestamp": null,
      "estimated_date": "2026-05-05"
    }
  ]
}
```

### Frontend

**Component:** `components/dashboard/LoanTimeline.tsx`
- Horizontal progress bar at top (percentage filled, green gradient)
- Vertical list of milestone rows below
- Completed: green filled circle + green checkmark + timestamp
- Current: accent purple pulsing circle + "In Progress" label (CSS animation: `@keyframes pulse`)
- Upcoming: grey empty circle + estimated date or "—"
- Already exists as a page at `app/(app)/track/page.tsx` — update it to use this component

---

## Feature 3 — Support System (Chat + Callback Request)

### 3A. Support Ticket Escalation

**Existing tables:** `support_tickets` and `support_messages` already exist (from phase 2).

**Escalation trigger in NexBot (`app/routers/chatbot.py`):**
- Detect keywords: `["agent", "human", "complaint", "escalate", "not helpful", "talk to someone"]`
- If detected: create a `support_ticket` record, send Brevo email to support team, respond with:
  > "I've connected you with a NexLoan support agent. They'll respond within 2 hours. Ticket #NX-XXXX created."

**Loan Officer dashboard** (`app/(app)/officer/page.tsx`) should show open support tickets with a "Reply" button.

### 3B. Callback Request

**New DB table:**
```sql
CREATE TABLE callback_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    loan_id UUID REFERENCES loan_applications(id),
    phone_number VARCHAR(15) NOT NULL,
    preferred_slot VARCHAR(50) NOT NULL,  -- 'morning' | 'afternoon' | 'evening'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'scheduled' | 'completed'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Preferred slots:**
- `morning` → "9 AM – 12 PM"
- `afternoon` → "12 PM – 5 PM"
- `evening` → "5 PM – 8 PM"

**New backend endpoint** (`app/routers/support.py`):
```
POST /api/support/callback-request
Body: { phone_number, preferred_slot, loan_id (optional) }
```
On success:
1. Save to `callback_requests` table
2. Send Brevo email to `mayurdoiphode55@gmail.com`: "New callback request from {name} — {slot} — {phone}"
3. Send Brevo confirmation email to user: "We'll call you between {slot_time} today"
4. Create notification: type=`callback_scheduled`, "Your callback is scheduled for {slot}"

**Frontend (`components/dashboard/CallbackModal.tsx`):**
- "📞 Request a Callback" button in the support section and in the chatbot
- Opens a modal with:
  - Phone number field (pre-filled from user profile)
  - Slot selector (3 cards: Morning / Afternoon / Evening, click to select)
  - "Confirm Callback" button
  - Success state: "✅ We'll call you between 9 AM – 12 PM today!"

---

## Feature 4 — Downloadable Payment Statements (PDF)

**Install:** `pip install weasyprint`
> Note: WeasyPrint requires GTK on Windows for local dev. On Linux (Render), it works out of the box. For local testing on Windows, use `weasyprint` with `--dev` or test on the deployed server.

**Alternative for Windows local dev:** Use `xhtml2pdf` or `reportlab` if WeasyPrint has GTK issues.

### Documents to Generate

**1. EMI Payment Statement PDF**
```
GET /api/payments/{loan_id}/statement/pdf
Query: ?from_date=2026-04-01&to_date=2027-03-31   (optional, defaults to all)
```
Content: NexLoan letterhead + table of all paid EMIs with principal/interest split + totals

**2. Interest Certificate (Section 24 — Tax)**
```
GET /api/payments/{loan_id}/interest-certificate/pdf
Query: ?financial_year=2026-27
```
Content: Total interest paid in that FY, user details, loan details, declaration

**3. Loan Sanction Letter**
```
GET /api/application/{loan_id}/sanction-letter/pdf
```
Content: Approved amount, rate, tenure, EMI, T&C — generated at loan approval, downloadable anytime

### Implementation Pattern

```python
# app/services/pdf_service.py
from weasyprint import HTML

def generate_pdf(html_content: str) -> bytes:
    return HTML(string=html_content).write_pdf()

# In router:
from fastapi.responses import Response
pdf_bytes = generate_pdf(html)
return Response(
    content=pdf_bytes,
    media_type="application/pdf",
    headers={"Content-Disposition": f"attachment; filename=statement_{loan_id}.pdf"}
)
```

### Frontend PDF Download Button

```typescript
// In any component:
const downloadPDF = async (endpoint: string, filename: string) => {
  const res = await api.get(endpoint, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Add download buttons to:**
- `app/(app)/dashboard/page.tsx` → "Download Statement" and "Interest Certificate"
- `app/(app)/apply/page.tsx` → "Download Sanction Letter" (after approval)

---

## Feature 5 — Loan Comparison Tool

**No backend needed.** Pure frontend calculation.

**New page:** `app/(app)/compare/page.tsx`

### UI Layout

Two side-by-side cards (3 on desktop). Each card has:
- Loan amount slider: ₹50,000 – ₹10,00,000 (step: ₹10,000)
- Tenure selector: 6 / 12 / 18 / 24 / 36 / 48 / 60 months
- Interest rate: auto-calculated based on amount/tenure (use existing `underwriting_engine` formula, expose via a simple `GET /api/underwriting/estimate-rate?amount=X&tenure=Y` endpoint), or let user input manually
- Display: Monthly EMI, Total Interest, Total Cost, "Save ₹X vs Option B"

**EMI Formula (TypeScript):**
```typescript
function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const r = annualRate / 12 / 100;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}
```

**Recommendation line at bottom:**
> "Based on your income of ₹{income}, Option B's EMI is {percent}% of your income — comfortable."

Fetch income from user profile (already stored from loan application).

**Add to Sidebar nav** under Borrower section: "⚖️ Compare Loans" → `/compare`

---

## Feature 6 — i18n Infrastructure

**Install:** `npm install next-intl`

**Do NOT translate everything now.** Just set up the infrastructure with English strings. Hindi/Kannada/Telugu are Phase 2.

### File Structure

```
frontend/
└── messages/
    ├── en.json    ← Complete, build now
    ├── hi.json    ← Empty placeholder
    ├── kn.json    ← Empty placeholder
    └── te.json    ← Empty placeholder
```

### Config (`frontend/i18n.ts`)

```typescript
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### English strings (`messages/en.json`)

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "apply": "Apply for Loan",
    "track": "Track Loan",
    "compare": "Compare Loans",
    "notifications": "Notifications"
  },
  "dashboard": {
    "title": "Your Dashboard",
    "credit_score_label": "THEOREMLABS CREDIT SCORE",
    "download_statement": "Download Statement",
    "interest_certificate": "Interest Certificate"
  },
  "notifications": {
    "emi_due_7days": "Your EMI of ₹{amount} is due on {date}",
    "emi_due_1day": "Tomorrow is your EMI date — ₹{amount}",
    "emi_due_today": "Today is your EMI day — ₹{amount}",
    "emi_missed": "Your EMI was due yesterday — pay now",
    "emi_paid": "EMI #{number} paid successfully ✅",
    "loan_approved": "Your loan of ₹{amount} is approved! 🎉",
    "callback_scheduled": "Callback scheduled for {slot}"
  },
  "support": {
    "request_callback": "Request a Callback",
    "callback_success": "We'll call you between {slot_time}",
    "morning": "Morning (9 AM – 12 PM)",
    "afternoon": "Afternoon (12 PM – 5 PM)",
    "evening": "Evening (5 PM – 8 PM)"
  },
  "emi": {
    "pause_title": "Pause Your EMI",
    "pause_description": "You can pause 1 EMI per year with no penalty.",
    "confirm_pause": "Confirm Pause"
  }
}
```

### Language Selector

Add a globe icon (🌐) in the navbar dropdown with: English / हिन्दी / ಕನ್ನಡ / తెలుగు
- Store selection in `localStorage`
- Also save to user profile (`preferred_language` column in `users` table)

---

## Implementation Order (Recommended)

Build in this exact sequence to avoid blockers:

1. **DB Migration** — Add `notifications` table + `callback_requests` table + `preferred_language` to users
2. **Notifications Router** — Backend CRUD for notifications
3. **Notification Bell** — Frontend component (most used feature, high visibility)
4. **Loan Timeline** — Update `/api/tracking/{loan_id}/timeline` + `LoanTimeline.tsx`
5. **Callback Request** — `CallbackModal.tsx` + backend endpoint + Brevo emails
6. **EMI Reminder Scheduler** — APScheduler in lifespan + `reminder_service.py`
7. **PDF Generation** — `pdf_service.py` + 3 download endpoints + frontend download buttons
8. **Loan Comparison Tool** — Pure frontend `/compare` page
9. **i18n Infrastructure** — `next-intl` setup + `en.json` + language selector

---

## Critical Rules for This Build

1. **No mock data.** Everything connects to real Supabase DB and real Brevo API.
2. **All new API routes** must use `get_current_user` dependency (JWT-protected).
3. **Notifications are additive** — never replace existing notifications, only append.
4. **PDF downloads** return `application/pdf` with `Content-Disposition: attachment`.
5. **APScheduler** must be started in the FastAPI `lifespan` startup and shut down cleanly.
6. **LOAN_OFFICER role** (`mayurdoiphode55@gmail.com`) sees all support tickets and callback requests in the officer dashboard.
7. **BORROWER role** sees only their own notifications, statements, and support tickets.
8. **Backend port** is `8001` for local dev. Frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://127.0.0.1:8001`.
9. **WeasyPrint** — if it fails on Windows, use `xhtml2pdf` as fallback. Always works on Linux (Render).
10. **i18n** — only set up infrastructure now. Do not block any feature on translation completeness.

---

## Existing Code to Reuse

| Need | Where it already exists |
|---|---|
| Brevo email sender | `app/services/email_service.py` → `_send_brevo_api_email()` |
| JWT auth dependency | `app/utils/auth.py` → `get_current_user` |
| DB session | `app/utils/database.py` → `get_db` |
| Axios API client | `frontend/lib/api.ts` |
| Toast notifications | `frontend/components/ToastProvider.tsx` |
| Loan schedule data | `loan_schedule` table (installment_no, due_date, amount, principal, interest, status) |
| Audit logs | `audit_logs` table (loan_id, action, details, timestamp) |
| Support tickets (basic) | `app/routers/support.py` + `support_tickets` table |
| Officer page | `frontend/app/(app)/officer/page.tsx` |

---

## Environment Variables (No New Ones Needed)

All features use existing env vars:
- `BREVO_API_KEY` — email sending ✅
- `DATABASE_URL` — Supabase PostgreSQL ✅
- `REDIS_URL` — Upstash Redis ✅
- `JWT_SECRET` — authentication ✅

---

*This is Phase 3 of NexLoan. Phase 1 = core loan flow. Phase 2 = officer/admin/payments. Phase 3 = smart notifications, tracking, statements, comparison, support, i18n.*
