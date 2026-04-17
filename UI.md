# NexLoan — Industry-Grade UI Redesign Prompt
## For AI Coding Agent (Antigravity / Claude Code / Cursor)

---

> **Read this entire file before writing a single line of code.**
> This is a complete UI specification. Execute section by section.
> Every design decision here is intentional. Do not substitute, simplify, or skip.
> The goal: someone opens NexLoan and thinks a 6-person design team built this.

---

## 1. Design Philosophy

NexLoan's new UI is inspired by **CRED's Charcoal design language** — the philosophy of making financial interactions feel premium, intentional, and almost artistic. Not a banking app. Not a generic fintech template. A product that respects its user's intelligence and rewards their attention.

### The Four Pillars

**1. Editorial Weight**
Every screen should feel like it was *composed*, not assembled. Numbers are large and confident. Whitespace is generous and deliberate. Nothing competes for attention unnecessarily.

**2. Typographic Hierarchy**
Typography does the heavy lifting. The difference between a good screen and a great screen is almost always spacing and font weight — not color or illustration.

**3. Restrained Color**
The palette is mostly monochrome — near-black, off-white, deep grays. Color is used sparingly and purposefully: one accent color (electric indigo/violet), used only for CTAs, active states, and key data points. Never decorative.

**4. Micro-interactions That Earn Trust**
Buttons respond. Cards animate in. Success states feel satisfying. Every interaction has a physical weight. This is what separates a designed product from a coded one.

---

## 2. Design System — Tokens (The Single Source of Truth)

Create this file first: `styles/tokens.css`
Every value in the entire UI comes from here. No hardcoded hex codes anywhere else.

```css
/* ============================================================
   NEXLOAN DESIGN TOKENS
   Reference: CRED Charcoal design language
   ============================================================ */

:root {
  /* ── Primitive Color Scale ─────────────────────────────── */

  /* Neutrals — the backbone of the entire UI */
  --neutral-0:   #FFFFFF;
  --neutral-50:  #F7F7F5;
  --neutral-100: #EEECEA;
  --neutral-200: #D4D1CC;
  --neutral-300: #B0ABA3;
  --neutral-400: #8C8680;
  --neutral-500: #6B6560;
  --neutral-600: #4A4540;
  --neutral-700: #2E2B27;
  --neutral-800: #1C1A17;
  --neutral-900: #111010;
  --neutral-950: #0A0909;

  /* Accent — Electric Indigo. Used sparingly. Only for primary actions + key numbers */
  --accent-300: #A78BFA;
  --accent-400: #8B5CF6;
  --accent-500: #7C3AED;
  --accent-600: #6D28D9;

  /* Semantic Colors */
  --color-success:  #22C55E;
  --color-warning:  #F59E0B;
  --color-error:    #EF4444;
  --color-info:     #3B82F6;

  /* Gold — for credit score "Excellent" band only */
  --gold-400: #FBBF24;
  --gold-500: #F59E0B;

  /* ── Semantic Surface Tokens (Dark Mode — Default) ─────── */
  --surface-base:       var(--neutral-950);   /* page background */
  --surface-raised:     var(--neutral-900);   /* cards */
  --surface-overlay:    var(--neutral-800);   /* modals, dropdowns */
  --surface-sunken:     #0D0C0C;             /* input fields */
  --surface-border:     rgba(255,255,255,0.08);
  --surface-border-hover: rgba(255,255,255,0.16);

  /* ── Semantic Text Tokens (Dark Mode) ──────────────────── */
  --text-primary:    var(--neutral-0);
  --text-secondary:  var(--neutral-300);
  --text-tertiary:   var(--neutral-500);
  --text-disabled:   var(--neutral-600);
  --text-inverse:    var(--neutral-950);
  --text-accent:     var(--accent-400);

  /* ── Button Tokens ─────────────────────────────────────── */
  --btn-primary-bg:        var(--accent-500);
  --btn-primary-bg-hover:  var(--accent-400);
  --btn-primary-text:      var(--neutral-0);
  --btn-secondary-bg:      transparent;
  --btn-secondary-border:  var(--surface-border-hover);
  --btn-secondary-text:    var(--text-primary);
  --btn-ghost-text:        var(--text-secondary);

  /* ── Typography Scale ───────────────────────────────────── */
  --font-display:  'Sora', 'Inter', sans-serif;   /* headings, display numbers */
  --font-body:     'Inter', sans-serif;            /* body text, UI labels */
  --font-mono:     'JetBrains Mono', monospace;   /* loan numbers, amounts */

  --text-xs:    0.75rem;    /* 12px — labels, badges */
  --text-sm:    0.875rem;   /* 14px — secondary body */
  --text-base:  1rem;       /* 16px — primary body */
  --text-lg:    1.125rem;   /* 18px — emphasized body */
  --text-xl:    1.25rem;    /* 20px — card titles */
  --text-2xl:   1.5rem;     /* 24px — section headers */
  --text-3xl:   1.875rem;   /* 30px — page titles */
  --text-4xl:   2.25rem;    /* 36px — hero numbers */
  --text-5xl:   3rem;       /* 48px — dashboard big numbers */
  --text-6xl:   3.75rem;    /* 60px — splash/hero */

  /* ── Spacing Scale (8px base grid) ─────────────────────── */
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */

  /* ── Border Radius ──────────────────────────────────────── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-2xl:  32px;
  --radius-full: 9999px;

  /* ── Shadows ────────────────────────────────────────────── */
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.6);
  --shadow-accent: 0 0 24px rgba(124,58,237,0.25);

  /* ── Transitions ────────────────────────────────────────── */
  --transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base:   250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:   400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ── Light Mode Overrides ───────────────────────────────────── */
[data-theme="light"] {
  --surface-base:       var(--neutral-50);
  --surface-raised:     var(--neutral-0);
  --surface-overlay:    var(--neutral-100);
  --surface-sunken:     var(--neutral-100);
  --surface-border:     rgba(0,0,0,0.08);
  --surface-border-hover: rgba(0,0,0,0.16);

  --text-primary:    var(--neutral-900);
  --text-secondary:  var(--neutral-600);
  --text-tertiary:   var(--neutral-400);
  --text-disabled:   var(--neutral-300);
  --text-inverse:    var(--neutral-0);
  --text-accent:     var(--accent-600);

  --btn-primary-bg:        var(--accent-600);
  --btn-primary-bg-hover:  var(--accent-500);

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.12);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.16);
  --shadow-accent: 0 0 24px rgba(109,40,217,0.15);
}
```

---

## 3. Typography Rules

Import these fonts in `app/layout.tsx`:

```typescript
import { Inter, Sora, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

### Typography Rules the Agent Must Follow

- **Display numbers** (EMI amounts, loan amounts, credit scores): `font-family: var(--font-display)`, `font-weight: 700`, `letter-spacing: -0.02em`
- **Page titles / H1**: `font-family: var(--font-display)`, `font-weight: 600`, `letter-spacing: -0.01em`
- **Card titles / H2**: `font-family: var(--font-body)`, `font-weight: 600`
- **Body text**: `font-family: var(--font-body)`, `font-weight: 400`
- **Labels / captions**: `font-family: var(--font-body)`, `font-weight: 500`, `letter-spacing: 0.02em`, `text-transform: uppercase`, `font-size: var(--text-xs)`
- **Loan reference numbers, amounts in tables**: `font-family: var(--font-mono)`
- **Never** use `font-weight: 300` (too thin, feels cheap)
- **Never** mix more than 2 font families on one screen

---

## 4. Component Library

Build all of these as reusable components in `components/ui/`. Every page is built from these.

### 4.1 Button

```
Variants: primary | secondary | ghost | destructive
Sizes: sm | md | lg
States: default | hover | active | loading | disabled
```

**Primary button rules:**
- Background: `var(--btn-primary-bg)`
- Border radius: `var(--radius-md)`
- Font weight: 600, letter-spacing: 0.01em
- Padding: `14px 28px` (lg), `10px 20px` (md), `7px 14px` (sm)
- On hover: background shifts to `var(--btn-primary-bg-hover)`, subtle upward transform `translateY(-1px)`, shadow `var(--shadow-accent)`
- On active: `translateY(0)`, shadow removed
- Loading state: replace text with a subtle spinner (CSS animation, not an icon library)
- Transition: `var(--transition-fast)` on all properties

**Secondary button rules:**
- Background: transparent
- Border: `1px solid var(--surface-border-hover)`
- On hover: border color shifts to `var(--accent-400)`, text color shifts to `var(--accent-400)`

### 4.2 Input Field

```
States: default | focused | error | disabled | filled
```

- Background: `var(--surface-sunken)`
- Border: `1px solid var(--surface-border)`
- Border radius: `var(--radius-md)`
- Padding: `14px 16px`
- Font size: `var(--text-base)`
- On focus: border color `var(--accent-400)`, subtle glow `0 0 0 3px rgba(124,58,237,0.15)`
- Label: floats above when filled (animated, not static). Label starts inside, moves up on focus/fill.
- Error state: border `var(--color-error)`, error message below in `var(--color-error)` at `var(--text-sm)`
- Transition: `var(--transition-base)`

### 4.3 Card

```
Variants: default | elevated | bordered | interactive
```

- Background: `var(--surface-raised)`
- Border radius: `var(--radius-xl)`
- Border: `1px solid var(--surface-border)`
- Padding: `var(--space-6)` (default), `var(--space-8)` (large)
- **Interactive cards**: On hover, border color shifts to `var(--surface-border-hover)`, `translateY(-2px)`, shadow `var(--shadow-md)`. Transition: `var(--transition-base)`
- **Never** use box-shadow as a substitute for border. Use both together, intentionally.

### 4.4 Badge / Status Pill

```
Variants: success | warning | error | info | neutral | accent
```

- Shape: `border-radius: var(--radius-full)`
- Padding: `4px 10px`
- Font: `var(--text-xs)`, `font-weight: 600`, `letter-spacing: 0.05em`, `text-transform: uppercase`
- Each variant has a background at 15% opacity of its color, and text at full color
  - Example success: `background: rgba(34,197,94,0.12)`, `color: var(--color-success)`
- Add a subtle `2px solid` border at 30% opacity of the color

### 4.5 Theme Toggle

- Position: top-right of the navbar
- Icon: sun (light) / moon (dark) — draw with SVG, no icon library
- On toggle: smooth transition on all color tokens `transition: background 300ms, color 300ms`
- Store preference in `localStorage` key `nexloan_theme`
- On initial load, read from `localStorage`, fall back to `prefers-color-scheme`

### 4.6 Skeleton Loader

- Every data-fetching component must have a skeleton version
- Background: `var(--surface-overlay)`
- Shimmer animation: a `linear-gradient` moving left to right, `1.5s` infinite
- Match the exact shape and size of the content it replaces
- Never show a spinner for data that has a known layout — always use skeleton

### 4.7 Toast Notification

- Position: bottom-center, `position: fixed`, `z-index: 9999`
- Slides up from bottom, fades out after 3 seconds
- Variants: success (green left border), error (red left border), info (accent left border)
- Background: `var(--surface-overlay)`, border radius `var(--radius-lg)`
- Max width: 380px

---

## 5. Page-by-Page Specifications

---

### Page 1 — Auth / Register (`/`)

**Layout:** Full screen, centered card. No sidebar. Background is `var(--surface-base)` with a very subtle radial gradient: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.12), transparent)` — this is the only decorative element.

**The card:**
- Width: 420px (desktop), 100% with 24px horizontal padding (mobile)
- Background: `var(--surface-raised)`
- Border: `1px solid var(--surface-border)`
- Border radius: `var(--radius-2xl)`
- Padding: `var(--space-10)`
- No box-shadow. The border does the work.

**Inside the card (top to bottom):**

1. **Logo mark** — Text "NexLoan" in `var(--font-display)`, `font-weight: 700`, `font-size: var(--text-2xl)`. Below it: "Powered by Theoremlabs" in `var(--text-xs)`, `var(--text-tertiary)`, `letter-spacing: 0.08em`, uppercase. Add a horizontal rule: `1px solid var(--surface-border)` below the tagline. Space: `var(--space-8)` between logo and rule, `var(--space-8)` below rule.

2. **Heading** — "Create your account" in `var(--text-xl)`, `font-weight: 600`, `var(--text-primary)`. Below it: "Join thousands of members. No paperwork." in `var(--text-sm)`, `var(--text-secondary)`. Space: `var(--space-6)` below.

3. **Form fields** (using the Input component from 4.2):
   - Full Name
   - Email Address
   - Mobile Number (with `+91` country code prefix, non-editable, styled as a left addon)
   - `var(--space-4)` gap between fields

4. **Primary CTA button** — "Continue →", full width, large size. `var(--space-6)` top margin.

5. **Divider** — `var(--space-6)` below button. A horizontal line with "or" centered in it. Line: `1px solid var(--surface-border)`. "or" text: `var(--text-tertiary)`, `var(--text-sm)`.

6. **Sign In link** — "Already a member? **Sign in**". Centered. "Sign in" is `var(--text-accent)`, bold, underline on hover.

7. **Footer** — `var(--space-8)` top margin. "© 2026 NexLoan · Secured by AES-256 Encryption" in `var(--text-xs)`, `var(--text-tertiary)`, centered.

**Animation:** On load, the card fades in and slides up 16px. `animation: cardEntrance 400ms var(--transition-base) forwards`. The form fields stagger in at 50ms intervals.

---

### Page 2 — OTP Verification (`/verify`)

**Same layout as auth page (centered card).**

**Inside the card:**

1. **Back arrow** — top-left of card, `←` as text or SVG, `var(--text-secondary)`, cursor pointer. On hover: `var(--text-primary)`.

2. **Lock icon** — centered SVG, 48×48px, drawn as a simple padlock outline. Color: `var(--accent-400)`. Below it: `var(--space-4)` gap.

3. **Heading** — "Verify your identity" in `var(--text-xl)`, `font-weight: 600`. Below: "We sent a 6-digit code to `email@address.com`" — the email address is bold and `var(--text-primary)`. Rest is `var(--text-secondary)`, `var(--text-sm)`.

4. **OTP Input** — 6 individual boxes, not one input.
   - Each box: 52px × 64px, `var(--surface-sunken)` background, `1px solid var(--surface-border)`, `var(--radius-md)`.
   - Font: `var(--font-mono)`, `var(--text-3xl)`, `font-weight: 700`, centered.
   - Gap between boxes: `var(--space-3)`.
   - On focus: accent border + glow (same as input component).
   - When a digit is typed: box gets a subtle scale animation `scale(1.04)` then returns.
   - Auto-advance to next box on input. Backspace goes back.
   - Paste: handle clipboard paste correctly — fill all 6 boxes at once.

5. **Timer** — "Code expires in **4:32**" — countdown. Bold monospace number. When under 60 seconds: color shifts to `var(--color-warning)`. At 0: "Code expired." with `var(--color-error)`.

6. **Verify button** — "Verify →", full width, primary. Disabled until all 6 digits are entered.

7. **Resend link** — "Didn't receive it? **Resend OTP**" — disabled and grayed out until timer expires. Becomes clickable (accent color) when timer hits 0.

---

### Page 3 — Loan Application (`/apply`)

**Layout:** Sidebar (240px) + main content area. Sidebar has: NexLoan logo, user name ("Welcome, MAYUR"), nav links ("My Dashboard", "Apply for Loan"), logout button at bottom.

**Sidebar design:**
- Background: `var(--surface-raised)`
- Right border: `1px solid var(--surface-border)`
- Nav links: `var(--text-secondary)`, `font-weight: 500`. Active: `var(--text-primary)`, background `rgba(124,58,237,0.10)`, left border `3px solid var(--accent-400)`, border radius `0 var(--radius-md) var(--radius-md) 0`.
- Logout button: `var(--text-tertiary)` with a subtle exit icon. On hover: `var(--color-error)`.

**Progress Header (inside main content):**
- Title: "Loan Application" in `var(--text-2xl)`, `font-weight: 700`
- Subtitle: "Secure & AI-Verified • [USER NAME]" in `var(--text-sm)`, `var(--text-secondary)`, uppercase, letter-spacing
- Step indicator: 4 steps. Current step: filled circle `var(--accent-500)`, white number. Completed: filled `var(--color-success)` with checkmark SVG. Future: outline circle `var(--surface-border)`, `var(--text-tertiary)` number.
- Connecting line: 1px, completed portions `var(--color-success)`, pending portions `var(--surface-border)`.
- Step labels: "Personal", "Loan Detail", "KYC", "Confirm" — `var(--text-xs)`, uppercase, letter-spacing.

**Step 1 — Personal Details:**
- Section heading: "Personal Details" in `var(--text-xl)`, `font-weight: 600`. A subtle rule below.
- 2-column grid for Name + Email, Mobile + DOB.
- Employment type: custom styled select, not browser default. Same styling as input.
- "Next Step →" button right-aligned.

**Step 2 — Loan Requirements:**

This is the most important step to get right visually.

- Loan amount slider:
  - Label: "HOW MUCH DO YOU NEED?" in caps label style
  - Amount displayed: Large, `var(--text-4xl)`, `var(--font-mono)`, `var(--text-primary)`. Update live.
  - Slider: custom CSS. Track: `var(--surface-sunken)`. Filled portion: `var(--accent-500)`. Thumb: 20px circle, `var(--accent-400)`, white border 2px, `var(--shadow-accent)`.
  - Range labels: "₹50,000" and "₹1 Cr" in `var(--text-xs)`, `var(--text-tertiary)`.

- Tenure slider: same styling. Display value: "36 MO" in badge style.

- **EMI Preview Card** — This is the standout element of this step.
  - Full-width card, background: subtle accent gradient `linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))`
  - Border: `1px solid rgba(124,58,237,0.30)`
  - Left side: "ESTIMATED MONTHLY EMI" label + the EMI amount in `var(--text-5xl)`, `var(--font-display)`, `font-weight: 700`, `var(--text-primary)`. Updates live as sliders change.
  - Right side: "Based on ~15% p.a. standard rate" in `var(--text-xs)`, `var(--text-tertiary)`.
  - When EMI changes: the number does a brief count-up animation.

- Monthly Income + Existing EMIs: 2-column input grid.
- Loan Purpose: custom dropdown.

**Step 3 — KYC (Identity Verification):**

- Intro text: "Our AI-vision system verifies your documents instantly." `var(--text-secondary)`, centered, `var(--text-sm)`.

- 2-column upload zones, side by side.
  - Each zone when empty:
    - Dashed border: `2px dashed var(--surface-border)`
    - Border radius: `var(--radius-xl)`
    - Padding: `var(--space-8)`, centered content
    - Upload icon: SVG cloud with arrow, `var(--text-tertiary)`, 32px
    - Title: "Upload PAN Card" / "Upload Aadhaar Card", `var(--text-base)`, `font-weight: 600`
    - Subtitle: "JPG or PNG · Max 5MB", `var(--text-xs)`, `var(--text-tertiary)`
    - Hidden file input, full area is clickable
    - On hover: border color shifts to `var(--accent-400)`, background `rgba(124,58,237,0.04)`

  - Each zone when filled:
    - Document preview image fills the zone (cover fit)
    - A dark overlay at bottom with the filename truncated
    - A small "×" remove button top-right, white circle background

- "Submit for AI Verification" button — primary, full width, large.
- Below the button: a subtle row of trust signals: "256-bit encrypted · RBI compliant · Documents not shared"

**Step 4 — Confirmation:**

- Centered layout. Large animated checkmark (CSS SVG path animation — the stroke draws itself).
- "Application Received!" in `var(--text-3xl)`, `var(--font-display)`.
- "Your documents are being verified by our AI engine." `var(--text-secondary)`.

- Result card (use Card component):
  - Three rows: Loan Reference (monospace, accent color) / Verification Status (badge) / AI Remarks (italic, tertiary).
  - Each row: label left, value right, separated by a subtle dotted rule.

- "Go to Dashboard →" primary button.

---

### Page 4 — Dashboard (`/dashboard`)

This is the most complex and most important page. It needs to feel like a command center.

**Layout:** Same sidebar. Main content is a grid.

**Top bar (inside main):**
- "Your Dashboard" in `var(--text-3xl)`, `font-weight: 700`, left-aligned.
- Right side: loan status badge + "Download PDF Report" as a ghost button with a download icon.

**Grid Layout (desktop):**
```
[ Loan Summary Card          ] [ Credit Score Card ]
[ Loan Summary Card (cont.)  ] [ DTI Card          ]
[ EMI Schedule Table — full width                  ]
[ Pre-closure Section — full width                 ]
```

**Loan Summary Card:**
- Header: "Loan Reference: NL-2026-XXXXX" in `var(--font-mono)`, `var(--text-lg)`.
- Below: "Created on DD/MM/YYYY" in `var(--text-xs)`, `var(--text-tertiary)`.
- Rule divider.
- 2×2 grid of data points:
  - Each point: label in `var(--text-xs)` uppercase caps style, value in `var(--text-2xl)`, `var(--font-display)`, `font-weight: 700`.
  - "Requested Amount" / "Approved Amount" (accent color) / "Tenure" / "Interest Rate" (accent color).
- Rule divider.
- Status-specific action area:
  - If `APPROVED`: accent gradient card with "Loan Ready for Disbursement" + "Review Key Fact Statement (KFS)" primary button.
  - If `ACTIVE`: "Next EMI Due" with date and amount.
  - If `CLOSED`: green success banner.

**Theoremlabs Credit Score Card:**
- Label: "THEOREMLABS CREDIT SCORE" — caps, `var(--text-xs)`, letter-spacing.
- SVG Arc Gauge:
  - Outer arc: track, `var(--surface-sunken)`, stroke-width 12, stroke-linecap round.
  - Inner arc: filled portion, color based on score:
    - 300–599: `var(--color-error)`
    - 600–649: `var(--color-warning)`
    - 650–699: `#EAB308` (yellow)
    - 700–749: `var(--color-success)`
    - 750–850: `var(--gold-400)`
  - The fill animates from 0 to the actual score on mount: CSS `stroke-dashoffset` animation, `1.2s ease-out`.
  - Center: score number in `var(--text-5xl)`, `var(--font-display)`, `font-weight: 800`. Below it: band label ("Excellent") in `var(--text-sm)`, matching the arc color.
  - Min/max labels: "300" and "850" at the arc endpoints.

**DTI Card:**
- Label: "DEBT-TO-INCOME RATIO"
- Large percentage in `var(--font-display)`, `var(--text-4xl)`. Color-coded (green if <30%, yellow if 30-45%, red if >45%).
- Subtitle: "of monthly income".
- Below: a thin horizontal bar showing the DTI ratio visually.

**Audit Trail:**
- Title: "AUDIT TRAIL"
- Vertical timeline. Each entry:
  - Left: a filled dot `8px`, `var(--accent-400)`. Connecting vertical line between dots: `1px solid var(--surface-border)`.
  - Right: event name in `var(--text-sm)`, `font-weight: 600`. Below: timestamp + actor ID in `var(--text-xs)`, `var(--text-tertiary)`, `var(--font-mono)`.

**EMI Schedule Table:**

The table must not look like a standard HTML table. It is a designed data display.

- Table header row: background `var(--surface-overlay)`, text `var(--text-xs)` uppercase, letter-spacing.
- Each data row: alternating background (even rows: `rgba(255,255,255,0.02)`). On hover: `rgba(124,58,237,0.06)`.
- Status column: badge component.
- Amount columns: `var(--font-mono)`.
- Paid rows: text `var(--text-tertiary)`.
- Overdue rows: left border `3px solid var(--color-error)`.
- "Pay" button for pending rows: small primary button. On click: loading state → success state (checkmark animation).

**Pre-Closure Section:**
- Collapsed by default. "Early Settlement" heading with a `>` chevron. Click to expand.
- Expanded: shows outstanding principal, 2% fee, total payable in a clean 3-column breakdown card.
- "Confirm Pre-closure" — destructive button (red).
- Confirmation modal before action.

---

### Page 5 — Admin Dashboard (`/admin`)

**Layout:** Same sidebar. Main content.

**Overview Metrics Row** — 4 cards in a row:
- Each card: "TOTAL LOANS" label (caps) + large number + subtle trend indicator.
- Use the Card component. Numbers in `var(--font-display)`, `var(--text-4xl)`.

**Status Breakdown Bar:**
- Full-width horizontal stacked bar chart.
- Each segment: labeled, color-coded (closed=green, rejected=red, kyc_verified=yellow, inquiry=purple, pre_closed=teal).
- Hover on segment: tooltip with count.
- No chart library — build with CSS `flexbox` and `width` percentages.

**KYC Queue Table:**
- Each row: applicant name, loan amount, loan number, AI verdict badge, document preview thumbnails (small 40×40px), Approve/Reject buttons.
- "All Clear" empty state: centered checkmark + message (styled, not plain text).

---

### Page 6 — Chatbot Widget

**Trigger Button (always visible):**
- Position: `fixed`, bottom-right, `bottom: 24px`, `right: 24px`.
- Shape: circle, 56×56px.
- Background: `var(--accent-500)`.
- Icon: a chat bubble SVG, white, 24px.
- Shadow: `var(--shadow-accent)`.
- On hover: `scale(1.08)`, brighter background.
- When chat is open: icon transitions to "×" (close). Smooth rotation animation.
- A subtle pulse animation rings the button every 8 seconds to draw attention (2px accent ring expands and fades).

**Chat Panel:**
- Position: `fixed`, `bottom: 96px`, `right: 24px`.
- Size: 360px wide, 520px tall (desktop). Full screen on mobile.
- Background: `var(--surface-raised)`.
- Border: `1px solid var(--surface-border)`.
- Border radius: `var(--radius-2xl)`.
- Shadow: `var(--shadow-lg)`.
- Animation: slides up from `bottom: 80px` with `opacity: 0` to final position. `400ms var(--transition-spring)`.

**Panel Header:**
- Background: accent gradient `linear-gradient(135deg, var(--accent-600), var(--accent-400))`.
- Border radius: top corners only.
- Left: bot avatar (purple circle with a simple robot face SVG, 36px) + "NexBot AI" bold + "ONLINE • POWERED BY GROQ" in `var(--text-xs)`, 70% opacity.
- Right: minimize icon + refresh/clear icon.

**Message area:**
- Scrollable, `var(--space-4)` padding.
- Bot messages: left-aligned, `var(--surface-overlay)` background, `var(--radius-lg)` with flat bottom-left corner, max-width 80%.
- User messages: right-aligned, `var(--accent-500)` background, `var(--radius-lg)` with flat bottom-right corner, max-width 80%.
- Timestamp below each message: `var(--text-xs)`, `var(--text-tertiary)`.
- Messages animate in from bottom with opacity.

**Typing Indicator:**
- Three dots, each bouncing with `0`, `150ms`, `300ms` delay. Color: `var(--text-tertiary)`.

**Login Prompt State (triggered by `REQUEST_LOGIN` action):**
- A special bubble appears: accent-bordered card inside the message area with a lock icon, "Verify your identity to check your loan status", and an inline input for mobile number.
- This should feel native to the chat, not like a modal break.

**Input Area:**
- Border top: `1px solid var(--surface-border)`.
- Text input: no border, transparent background, `var(--space-4)` padding.
- Send button: circle, `var(--accent-500)` background, arrow SVG icon, white. Disabled (gray) when input is empty.

---

## 6. Micro-interactions Master List

The agent must implement every one of these. These are what make the UI feel alive.

| Element | Interaction | Spec |
|---|---|---|
| Primary button | Hover | `translateY(-1px)` + accent shadow |
| Primary button | Click | `translateY(0)` + scale(0.98) for 100ms |
| Card (interactive) | Hover | `translateY(-2px)` + border brightens |
| Input field | Focus | Accent border + 3px glow ring |
| OTP box | Digit entered | `scale(1.04)` then back, 150ms |
| Credit score arc | Mount | Stroke animates from 0, 1.2s ease-out |
| EMI amount (slider) | Change | Number counts up/down |
| EMI row pay button | Click | Loading → checkmark draw animation |
| Chatbot button | Idle | Pulse ring every 8 seconds |
| Chat panel | Open | Slide up + fade, spring easing |
| Message | Received | Slide up from below + fade in |
| Page | Load | Cards stagger in, 60ms intervals |
| Toast | Appear | Slide up from bottom |
| Toast | Dismiss | Fade out + slide down |
| Theme toggle | Click | Smooth 300ms color transition on all tokens |
| Loan status badge | Mount | Subtle scale-in animation |

---

## 7. Responsive Breakpoints

```
Mobile:  < 640px
Tablet:  640px – 1024px
Desktop: > 1024px
```

**Mobile rules:**
- Sidebar collapses to a bottom navigation bar (4 icons: Dashboard, Apply, Chat, Logout)
- Cards stack to single column
- OTP input boxes reduce to 44×52px
- Chatbot panel becomes full-screen sheet from bottom
- Tables become card-per-row layout (each EMI row becomes a card)
- Font sizes scale down by one step on mobile (e.g., `--text-5xl` becomes `--text-4xl`)

**Tablet rules:**
- Sidebar collapses to icon-only (64px wide), labels appear on hover
- 2-column grid for cards

---

## 8. Dark / Light Mode Implementation

```typescript
// lib/theme.ts

export function initTheme() {
  const stored = localStorage.getItem('nexloan_theme')
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const theme = stored || (systemDark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('nexloan_theme', next)
  return next
}
```

Call `initTheme()` in `app/layout.tsx` inside a `<script>` tag (not React) to prevent flash of wrong theme.

All color transitions on mode switch: add to `body`:
```css
body {
  transition: background-color 300ms ease, color 300ms ease;
}
```

---

## 9. File Structure for UI

```
frontend/
├── styles/
│   ├── tokens.css          # All design tokens (Section 2)
│   ├── globals.css         # Base resets + body styles
│   └── animations.css      # All @keyframes
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Toast.tsx
│   │   └── ThemeToggle.tsx
│   ├── ChatbotWidget.tsx
│   ├── CreditScoreGauge.tsx
│   ├── EMIScheduleTable.tsx
│   ├── KYCUpload.tsx
│   ├── LoanSummaryCard.tsx
│   ├── OTPInput.tsx         # The 6-box OTP component
│   ├── LoanSlider.tsx       # Custom styled range slider
│   ├── AuditTrail.tsx
│   └── Sidebar.tsx
└── lib/
    └── theme.ts
```

---

## 10. Execution Order for the Agent

Execute in this exact order. Each step should be working before the next.

1. **Create `styles/tokens.css`** with the full token set from Section 2. Import in `globals.css`.
2. **Set up fonts** in `layout.tsx` using `next/font/google`.
3. **Build all `components/ui/`** components (Button, Input, Card, Badge, Skeleton, Toast, ThemeToggle). Test each in isolation.
4. **Build `lib/theme.ts`** and `ThemeToggle`. Verify light/dark switch works with zero flash.
5. **Build `Sidebar.tsx`** — used on apply, dashboard, admin pages.
6. **Rebuild Auth page** (`/`) using new component system.
7. **Rebuild OTP page** (`/verify`) — especially the 6-box input.
8. **Rebuild Apply page** (`/apply`) — all 4 steps.
9. **Rebuild Dashboard** (`/dashboard`) — score gauge, EMI table, audit trail.
10. **Rebuild Admin page** (`/admin`).
11. **Rebuild ChatbotWidget** — the trigger button + panel.
12. **Add all micro-interactions** from Section 6.
13. **Responsive pass** — test every page at 375px, 768px, 1280px.
14. **Final QA pass** — both light and dark mode, every page, every interactive state.

---

## 11. Quality Bar — What "Done" Looks Like

The redesign is complete when every item below is true:

- [ ] No hardcoded hex colors anywhere in component files. Everything references a CSS token.
- [ ] Light mode and dark mode look equally polished — not light mode as an afterthought.
- [ ] The credit score gauge animates correctly on mount in both modes.
- [ ] All 6 OTP boxes handle: digit input, backspace, paste, auto-advance.
- [ ] The EMI slider live-updates the estimated EMI amount with a count animation.
- [ ] Every button has visible hover, active, loading, and disabled states.
- [ ] Every data-fetching component has a skeleton loader that matches its content shape.
- [ ] Toast notifications appear and auto-dismiss on success and error events.
- [ ] The chatbot widget pulse animation is present and not distracting.
- [ ] The sidebar collapses to bottom nav on mobile without breaking layout.
- [ ] The admin status breakdown bar renders correctly with real data.
- [ ] No layout shift on theme toggle or page load.
- [ ] A designer who has never seen this project opens it and does not immediately identify it as AI-built.

---

## 12. What to Avoid — Anti-patterns

These are the exact things that made the current UI look AI-generated. Do not repeat them.

| Anti-pattern | What to do instead |
|---|---|
| Flat blue `#3B82F6` buttons everywhere | Use `var(--accent-500)` (indigo/violet). One accent, used sparingly. |
| Generic dark navy `#1e293b` background | Use the token `var(--surface-base)` which is near-black `#0A0909`. Richer, more premium. |
| All cards the same size and weight | Use the elevation system: base → raised → overlay. Different surfaces feel different. |
| Labels as plain gray text | Use the uppercase caps label style with letter-spacing. This alone elevates a UI dramatically. |
| Generic Inter everywhere | Use Sora for display/headings. Inter for body. JetBrains Mono for numbers. |
| Borders at full opacity | Always use `rgba()` borders at 8–16% opacity. Hard borders feel cheap. |
| Spinner on every loading state | Skeleton loaders that match content shape. Spinners only for actions (button loading). |
| Box shadows as decoration | Use shadows only to convey elevation. One level of shadow per surface level. |
| Default browser scrollbar | Custom scrollbar: `var(--surface-overlay)` track, `var(--neutral-600)` thumb, 4px width. |
| Status text in plain color | Always use the Badge component — pill shape, background at 12% opacity, border at 30%. |
