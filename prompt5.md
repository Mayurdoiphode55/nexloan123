# NexLoan — Revenue, Risk, Operations & Analytics Features
## prompt5.md — For Antigravity AI Coding Agent

---

> **READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE.**
>
> This prompt adds four major feature categories to NexLoan:
> - Category 1: Revenue & Business Features
> - Category 2: Risk & Compliance Features
> - Category 3: Operational Efficiency Features
> - Category 4: Analytics & Intelligence Features
>
> Infrastructure & Platform Features (Category 5) are deferred.
> Execute every section in the exact order given.
> Do not skip sections. Do not combine steps.
> Everything here builds on top of the existing NexLoan codebase.
> Do not modify existing working functionality — only extend it.

---

## CONTEXT

**Product:** NexLoan White-Label Personal Loan Platform
**Company:** Theoremlabs
**Existing stack:** FastAPI backend + Next.js 15 frontend + PostgreSQL + Redis + Cloudflare R2
**Existing features:** Full loan lifecycle, Triple-Layer AI KYC, RBAC, white-label config,
pre-closure, EMI pause, admin delegation, PDF statements, support tickets

---

# CATEGORY 1 — REVENUE & BUSINESS FEATURES

---

## 1.1 Dynamic Interest Rate Engine

### What It Is
Right now interest rates are fixed per credit score band (10.5% → 24%).
The Dynamic Rate Engine adds multiple additional pricing dimensions so the
lender can offer competitive rates on low-risk segments and protect margins
on high-risk ones.

### New DB Table: `rate_rules`

```python
class RateRule(Base):
    __tablename__ = "rate_rules"

    id                  = Column(UUID(as_uuid=True), primary_key=True,
                                 default=uuid.uuid4)
    name                = Column(String(200), nullable=False)
    # e.g. "Festival October Offer", "Medical Emergency Rate"
    is_active           = Column(Boolean, default=True)
    priority            = Column(Integer, default=0)
    # Higher priority rules are evaluated first. First matching rule wins.

    # Conditions (all must match for the rule to apply)
    condition_loan_purpose  = Column(String(100))
    # "Medical", "Education", "Wedding", "Home Renovation", "Other", or NULL (any)
    condition_score_min     = Column(Integer)
    # Minimum credit score for rule to apply (or NULL for no minimum)
    condition_score_max     = Column(Integer)
    # Maximum credit score (or NULL for no maximum)
    condition_amount_min    = Column(Float)
    condition_amount_max    = Column(Float)
    condition_channel       = Column(String(50))
    # "app", "agent", "branch", "api", or NULL (any channel)
    condition_valid_from    = Column(DateTime)
    # Rule only applies after this date (for campaigns)
    condition_valid_until   = Column(DateTime)
    # Rule expires after this date

    # Rate Adjustment
    rate_override           = Column(Float)
    # If set: use this exact rate instead of the band rate
    # e.g. 11.5 → 11.5% p.a.
    rate_adjustment         = Column(Float)
    # If set: add/subtract from the band rate
    # e.g. -0.5 → subtract 0.5% from the standard rate
    # e.g. +2.0 → add 2% (for higher-risk segments)

    # Metadata
    description             = Column(Text)
    created_by              = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow,
                                     onupdate=datetime.utcnow)
```

### Rate Engine Logic

In `backend/app/services/credit_score.py`, add after the base rate is calculated:

```python
async def apply_rate_rules(
    base_rate: float,
    credit_score: int,
    loan_amount: float,
    loan_purpose: str,
    channel: str,
    db: AsyncSession,
) -> dict:
    """
    Applies dynamic rate rules on top of the base credit score band rate.
    Returns the final rate and the rule that was applied (if any).
    """
    now = datetime.utcnow()

    # Fetch all active rules ordered by priority (highest first)
    result = await db.execute(
        select(RateRule)
        .where(
            RateRule.is_active == True,
            or_(RateRule.condition_valid_from == None,
                RateRule.condition_valid_from <= now),
            or_(RateRule.condition_valid_until == None,
                RateRule.condition_valid_until >= now),
        )
        .order_by(RateRule.priority.desc())
    )
    rules = result.scalars().all()

    for rule in rules:
        # Check all conditions
        if rule.condition_loan_purpose and rule.condition_loan_purpose != loan_purpose:
            continue
        if rule.condition_score_min and credit_score < rule.condition_score_min:
            continue
        if rule.condition_score_max and credit_score > rule.condition_score_max:
            continue
        if rule.condition_amount_min and loan_amount < rule.condition_amount_min:
            continue
        if rule.condition_amount_max and loan_amount > rule.condition_amount_max:
            continue
        if rule.condition_channel and rule.condition_channel != channel:
            continue

        # Rule matches — apply it
        if rule.rate_override is not None:
            final_rate = rule.rate_override
        elif rule.rate_adjustment is not None:
            final_rate = round(base_rate + rule.rate_adjustment, 2)
        else:
            final_rate = base_rate

        # Clamp rate: never below 8% or above 36%
        final_rate = max(8.0, min(36.0, final_rate))

        return {
            "final_rate": final_rate,
            "rule_applied": rule.name,
            "rule_id": str(rule.id),
            "base_rate": base_rate,
            "adjustment": round(final_rate - base_rate, 2),
        }

    # No rule matched — use base rate
    return {
        "final_rate": base_rate,
        "rule_applied": None,
        "rule_id": None,
        "base_rate": base_rate,
        "adjustment": 0.0,
    }
```

### New API Endpoints

Add to `backend/app/routers/admin.py`:

```
GET  /api/admin/rate-rules
     — List all rate rules (admin only)
     — Returns rules ordered by priority

POST /api/admin/rate-rules/create
     — Create a new rate rule
     — Body: all RateRule fields

PUT  /api/admin/rate-rules/{rule_id}
     — Update a rule (name, conditions, rate adjustment, active toggle)

DELETE /api/admin/rate-rules/{rule_id}
     — Soft delete (set is_active = False)

POST /api/admin/rate-rules/{rule_id}/toggle
     — Toggle active/inactive without deleting
```

### Admin UI: Rate Rules Page

**File:** `frontend/app/admin/rate-rules/page.tsx`

Layout: Full-width table of existing rules + "New Rule" button top-right.

**Rule table columns:**
- Priority (drag handle to reorder)
- Rule Name
- Conditions (summarized: "Medical loans | Score 700+ | Oct 1–31")
- Rate Effect (badge: "-0.5%" in green, "+2.0%" in red, "Fixed 11%" in blue)
- Status (Active/Inactive toggle)
- Actions (Edit, Delete)

**New/Edit Rule Modal:**
- Name input
- Priority number
- Conditions section:
  - Loan Purpose dropdown (optional)
  - Score range (min/max number inputs, optional)
  - Amount range (min/max, optional)
  - Channel (optional)
  - Valid From/Until date pickers (optional)
- Rate Effect section:
  - Radio: "Override rate" vs "Adjust base rate"
  - If override: number input for exact rate
  - If adjust: number input with +/- toggle
- Description textarea
- Preview: "This rule will set the rate to X% for matching loans"
- Save button

---

## 1.2 Cross-Sell & Upsell Engine

### What It Is
When a borrower meets certain conditions, show them a contextually relevant
offer on their dashboard. Not spam — triggered only when the data supports it.

### New DB Table: `offers`

```python
class Offer(Base):
    __tablename__ = "offers"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"),
                             nullable=True)
    offer_type      = Column(String(50))
    # "TOP_UP", "RATE_REDUCTION", "LOAN_RENEWAL", "LIMIT_INCREASE"
    title           = Column(String(200))
    description     = Column(Text)
    offered_amount  = Column(Float, nullable=True)
    offered_rate    = Column(Float, nullable=True)
    valid_until     = Column(DateTime)
    status          = Column(String(20), default="PENDING")
    # PENDING, ACCEPTED, DECLINED, EXPIRED
    triggered_by    = Column(String(100))
    # e.g. "6_ONTIME_PAYMENTS", "SCORE_IMPROVED", "LOAN_RENEWAL"
    created_at      = Column(DateTime, default=datetime.utcnow)
    responded_at    = Column(DateTime, nullable=True)
```

### Offer Generation Rules

Add to `backend/app/services/offer_engine.py`:

```python
async def evaluate_and_generate_offers(
    user_id: str,
    loan: Loan,
    db: AsyncSession,
) -> list[Offer]:
    """
    Runs after every EMI payment. Checks conditions and creates offers.
    """
    generated = []
    now = datetime.utcnow()

    # Count paid and on-time payments
    paid_emis = [e for e in loan.emi_schedule if e.status == "PAID"]
    on_time = [e for e in paid_emis if e.paid_at and e.paid_at <= e.due_date]
    pending_emis = [e for e in loan.emi_schedule if e.status == "PENDING"]

    # Rule 1: Top-up offer after 6 on-time payments
    if len(on_time) == 6:
        top_up_amount = loan.approved_amount * 0.5
        # Offer 50% of original loan as top-up
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="TOP_UP",
            title="You're eligible for a Top-Up Loan!",
            description=f"Based on your excellent repayment track record, "
                        f"you're pre-approved for an additional ₹{top_up_amount:,.0f}.",
            offered_amount=top_up_amount,
            offered_rate=loan.interest_rate - 0.5,  # 0.5% loyalty discount
            valid_until=now + timedelta(days=30),
            triggered_by="6_ONTIME_PAYMENTS",
        )
        generated.append(offer)

    # Rule 2: Rate reduction after 12 on-time payments
    if len(on_time) == 12 and loan.interest_rate > 12.0:
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="RATE_REDUCTION",
            title="Congratulations! You've earned a rate reduction.",
            description=f"Your interest rate has been reduced from "
                        f"{loan.interest_rate}% to {loan.interest_rate - 1.0}% p.a. "
                        f"Your future EMIs will be recalculated.",
            offered_rate=loan.interest_rate - 1.0,
            valid_until=now + timedelta(days=15),
            triggered_by="12_ONTIME_PAYMENTS",
        )
        generated.append(offer)

    # Rule 3: Renewal offer when 3 EMIs remain
    if len(pending_emis) == 3:
        renewal_amount = loan.approved_amount * 1.25  # 25% more than original
        offer = Offer(
            user_id=user_id,
            loan_id=loan.id,
            offer_type="LOAN_RENEWAL",
            title="Your loan is almost complete. Ready for more?",
            description=f"You're pre-approved for ₹{renewal_amount:,.0f} at "
                        f"{max(loan.interest_rate - 0.5, 10.5)}% p.a. — "
                        f"your loyalty rate.",
            offered_amount=renewal_amount,
            offered_rate=max(loan.interest_rate - 0.5, 10.5),
            valid_until=now + timedelta(days=45),
            triggered_by="3_EMIS_REMAINING",
        )
        generated.append(offer)

    # Save all generated offers to DB
    for offer in generated:
        # Check if this offer type already exists and is pending for this loan
        existing = await db.execute(
            select(Offer).where(
                Offer.loan_id == loan.id,
                Offer.offer_type == offer.offer_type,
                Offer.status == "PENDING",
            )
        )
        if not existing.scalar_one_or_none():
            db.add(offer)

    return generated
```

### New API Endpoints

```
GET  /api/offers/my-offers
     — Returns all PENDING offers for the authenticated user

POST /api/offers/{offer_id}/accept
     — Accept an offer
     — For TOP_UP: creates a new loan inquiry pre-filled with offer details
     — For RATE_REDUCTION: updates loan.interest_rate, recalculates future EMIs
     — For LOAN_RENEWAL: creates a new loan inquiry

POST /api/offers/{offer_id}/decline
     — Mark offer as DECLINED

Background job (APScheduler — daily):
     — Set status = EXPIRED for all offers where valid_until < now
```

### UI: Offer Cards on Dashboard

**File:** `frontend/components/dashboard/OfferCards.tsx`

Show only if user has PENDING offers.
Each offer is a card with a gold/amber left border:

```
┌─────────────────────────────────────────────────────┐
│ ⭐ You're eligible for a Top-Up Loan!               │
│                                                     │
│ Pre-approved ₹1,50,000 at 10.5% p.a.               │
│ Valid until: 15 May 2026                            │
│                                                     │
│ [Accept Offer →]        [Not now]                   │
└─────────────────────────────────────────────────────┘
```

If multiple offers: show as a horizontal carousel or stacked cards.

---

## 1.3 Loan Top-Up Module

### What It Is
An existing active borrower applies for additional funds on top of their
running loan. The outstanding principal + new amount = new loan. Fresh tenure.
Fresh EMI schedule. Much easier to approve (borrower already proven).

### New Fields on `loans` Table

```python
is_topup            = Column(Boolean, default=False)
parent_loan_id      = Column(UUID(as_uuid=True), ForeignKey("loans.id"),
                             nullable=True)
# Reference to the original loan this top-up was created from
topup_previous_outstanding = Column(Float)
# Outstanding principal at the time of top-up (rolled into new loan)
```

### Top-Up Business Logic

```python
def calculate_topup(
    original_loan: Loan,
    additional_amount: float,
    new_tenure_months: int,
    interest_rate: float,
) -> dict:
    """
    Calculates a top-up loan.
    Outstanding principal from original loan + additional amount = new principal.
    """
    # Get outstanding principal from last pending EMI
    last_pending = sorted(
        [e for e in original_loan.emi_schedule if e.status == "PENDING"],
        key=lambda x: x.installment_no
    )
    outstanding = last_pending[0].outstanding_balance if last_pending else 0

    new_principal = outstanding + additional_amount
    new_emi = calculate_emi(new_principal, interest_rate, new_tenure_months)

    return {
        "outstanding_from_original": outstanding,
        "additional_amount": additional_amount,
        "new_principal": new_principal,
        "new_tenure_months": new_tenure_months,
        "new_emi": new_emi,
        "interest_rate": interest_rate,
        "original_loan_will_close": True,
        # The original loan is closed immediately when top-up is disbursed
    }
```

### New API Endpoints

```
GET  /api/topup/{loan_id}/eligibility
     — Check if loan is eligible for top-up
     — Rules: loan must be ACTIVE, min 6 on-time payments,
       no existing active top-up
     — Returns: eligibility status + max top-up amount

POST /api/topup/{loan_id}/apply
     — Body: {additional_amount, new_tenure_months}
     — Creates a new loan record with is_topup=True
     — Links to parent_loan_id
     — Runs standard underwriting on the combined amount
     — On approval: closes original loan, creates new EMI schedule

GET  /api/topup/{loan_id}/quote
     — Returns top-up calculation before applying
```

### UI: Top-Up Section on Dashboard

Show only for ACTIVE loans with 6+ on-time payments.

```
┌──────────────────────────────────────────────────────┐
│  LOAN TOP-UP AVAILABLE                               │
│                                                      │
│  Additional amount you can borrow: ₹2,00,000         │
│                                                      │
│  How it works:                                       │
│  Your outstanding ₹75,000 + new ₹2,00,000           │
│  = New loan of ₹2,75,000                            │
│                                                      │
│  Estimated new EMI: ₹8,900/month (36 months)        │
│                                                      │
│  [Apply for Top-Up]                                  │
└──────────────────────────────────────────────────────┘
```

Top-up goes through the same application flow (Steps 2–4 of the apply page)
with the parent loan details pre-filled and the outstanding amount shown.

---

## 1.4 Referral Engine

### New DB Tables

```python
class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             unique=True)
    code            = Column(String(20), unique=True, nullable=False)
    # e.g. "MAYUR2026" — generated on user registration
    total_referrals = Column(Integer, default=0)
    successful_referrals = Column(Integer, default=0)
    # Count of referrals where friend completed 3 EMIs
    total_reward_earned  = Column(Float, default=0.0)
    # In rupees (stored as reward credits)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    referrer_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    referred_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    referral_code   = Column(String(20))
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"),
                             nullable=True)
    # The loan the referred user took
    status          = Column(String(30), default="REGISTERED")
    # REGISTERED → LOAN_TAKEN → 3_EMIS_PAID → REWARDED
    reward_amount   = Column(Float, default=500.0)
    # Configurable per tenant in tenant_config
    rewarded_at     = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Referral Code Generation

On user registration (in `auth.py`), generate a referral code:
```python
def generate_referral_code(name: str, user_id: str) -> str:
    """Generate a unique, human-readable referral code."""
    name_part = name.split()[0].upper()[:6]  # First 6 chars of first name
    id_part = str(user_id)[:4].upper()
    return f"{name_part}{id_part}"
    # e.g. "MAYUR379E"
```

### Referral Tracking Flow

```
1. User shares their referral code (WhatsApp, copy link, etc.)
2. Friend registers using referral link:
   https://[client-domain]/auth?ref=MAYUR379E
3. Frontend stores referral code in localStorage on landing
4. On registration, sends referral_code in the request body
5. Backend creates a Referral record (status=REGISTERED)
6. Friend takes a loan → Referral.loan_id set, status=LOAN_TAKEN
7. Friend pays 3rd EMI → APScheduler detects this
8. Status → 3_EMIS_PAID, reward_amount credited to referrer's account
9. Brevo email to referrer: "You earned ₹500! Your friend just made their 3rd payment."
10. Status → REWARDED
```

### Reward Redemption

For the prototype, rewards are stored as a credit balance. The borrower can
redeem them on their next loan application as a rate reduction:
- Every ₹500 credit = 0.1% interest rate reduction on next loan
- Maximum redemption: 1% reduction (₹5,000 in credits)

Add `reward_balance` (Float, default=0.0) to the `users` table.

### New API Endpoints

```
GET  /api/referral/my-code
     — Returns user's referral code + share link + stats

GET  /api/referral/my-referrals
     — Returns list of all referrals made by the user
     — Shows each referral's current status

GET  /api/referral/my-rewards
     — Returns total earned, pending, and redeemed reward balance

POST /api/referral/redeem
     — Apply reward balance to next loan application
     — Body: {loan_id, amount_to_redeem}
```

### UI: Referral Section on Dashboard

```
┌──────────────────────────────────────────────────────┐
│  REFER & EARN                                        │
│                                                      │
│  Your code: MAYUR379E                    [Copy]      │
│                                                      │
│  Share: [WhatsApp] [Copy Link]                       │
│                                                      │
│  ──────────────────────────────────────────────────  │
│  Priya Sharma        Loan taken       ₹500 pending   │
│  Rahul Mehta         3 EMIs paid      ₹500 earned ✅ │
│                                                      │
│  Total earned: ₹500  |  Balance: ₹500               │
└──────────────────────────────────────────────────────┘
```

Add `referral_reward_amount` (Float, default=500.0) to `tenant_config`
so each client can configure the reward amount.

---

---

# CATEGORY 2 — RISK & COMPLIANCE FEATURES

---

## 2.1 Bureau Integration Ready Layer

### What It Is
Not a live bureau API call (those are paid and require commercial agreements).
A structured abstraction layer that can accept bureau data from any provider
(CIBIL, Experian, CRIF Highmark) and blend it with the Theoremlabs score.
When the lender is ready, they plug in their bureau credentials and the
architecture is already waiting.

### New DB Table: `bureau_scores`

```python
class BureauScore(Base):
    __tablename__ = "bureau_scores"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"))
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    bureau_name     = Column(String(50))
    # "CIBIL", "EXPERIAN", "CRIF", "SIMULATED"
    bureau_score    = Column(Integer)
    # Raw score from the bureau (300-900 typically)
    bureau_report   = Column(JSON)
    # Full bureau response stored as JSON (masked PII)
    fetched_at      = Column(DateTime, default=datetime.utcnow)
    is_simulated    = Column(Boolean, default=True)
    # True = simulated for prototype. False = real bureau call.
```

### Bureau Service

**File:** `backend/app/services/bureau_service.py`

```python
class BureauService:
    """
    Abstraction layer for credit bureau integration.
    Currently in SIMULATION mode.
    When a real bureau API is integrated, only this file needs to change.
    """

    async def fetch_score(
        self,
        pan_number: str,
        dob: str,
        name: str,
        loan_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Fetches bureau score. Currently simulates based on PAN number.
        In production: replace this with actual CIBIL/Experian API call.
        """
        if settings.BUREAU_MODE == "simulated":
            return await self._simulate_bureau_score(
                pan_number, loan_id, db
            )
        elif settings.BUREAU_MODE == "cibil":
            return await self._fetch_cibil(pan_number, dob, name)
        elif settings.BUREAU_MODE == "experian":
            return await self._fetch_experian(pan_number, dob, name)
        else:
            raise ValueError(f"Unknown bureau mode: {settings.BUREAU_MODE}")

    async def _simulate_bureau_score(
        self, pan_number: str, loan_id: str, db: AsyncSession
    ) -> dict:
        """
        Deterministic simulation: same PAN always gets same score.
        Uses PAN character sum to generate a consistent score.
        """
        # Sum ASCII values of PAN characters for determinism
        char_sum = sum(ord(c) for c in pan_number)
        simulated_score = 550 + (char_sum % 300)
        # Results in scores between 550-849

        bureau_record = BureauScore(
            loan_id=loan_id,
            bureau_name="SIMULATED",
            bureau_score=simulated_score,
            bureau_report={"simulated": True, "pan_hash": hash(pan_number)},
            is_simulated=True,
        )
        db.add(bureau_record)
        return {"score": simulated_score, "bureau": "SIMULATED", "is_simulated": True}

    async def _fetch_cibil(self, pan: str, dob: str, name: str) -> dict:
        """
        Placeholder for CIBIL TransUnion API integration.
        Replace with actual API call when commercial agreement is in place.
        """
        raise NotImplementedError(
            "CIBIL integration requires a commercial agreement. "
            "Contact Theoremlabs for production setup."
        )

    def blend_scores(
        self,
        theoremlabs_score: int,
        bureau_score: int,
        bureau_weight: float = 0.4,
    ) -> int:
        """
        Blends Theoremlabs score with bureau score.
        Default: 60% Theoremlabs + 40% Bureau.
        Weight is configurable per tenant in tenant_config.
        """
        # Normalize bureau score to 300-850 range
        bureau_normalized = int(
            300 + (bureau_score - 300) * (550 / 600)
        )
        blended = int(
            theoremlabs_score * (1 - bureau_weight) +
            bureau_normalized * bureau_weight
        )
        return max(300, min(850, blended))
```

### New Config Fields in `tenant_config`

```python
bureau_mode             = Column(String(20), default="simulated")
# "simulated", "cibil", "experian", "crif"
bureau_weight           = Column(Float, default=0.4)
# How much weight to give bureau score vs Theoremlabs score
bureau_api_key          = Column(String(500))
# Encrypted API key for the bureau (stored encrypted, never in logs)
bureau_enabled          = Column(Boolean, default=False)
# When False: only Theoremlabs score used
```

### Underwriting Integration

In `backend/app/routers/underwriting.py`, after calculating Theoremlabs score:

```python
# Fetch bureau score if enabled
if tenant.bureau_enabled and kyc.pan_number:
    bureau_result = await bureau_service.fetch_score(
        pan_number=kyc.pan_number,
        dob=loan.date_of_birth,
        name=user.full_name,
        loan_id=loan.id,
        db=db,
    )
    if bureau_result:
        final_score = bureau_service.blend_scores(
            theoremlabs_score=scoring["credit_score"],
            bureau_score=bureau_result["score"],
            bureau_weight=tenant.bureau_weight,
        )
    else:
        final_score = scoring["credit_score"]
else:
    final_score = scoring["credit_score"]
    bureau_result = None
```

Show bureau score (if fetched) in the underwriting result and officer dashboard.

---

## 2.2 Fraud Pattern Detection

### What It Is
Cross-application fraud detection. Detects when multiple applications
from different identities share suspicious patterns: same device, same bank
account, same phone, velocity attacks.

### New DB Table: `fraud_flags`

```python
class FraudFlag(Base):
    __tablename__ = "fraud_flags"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"))
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    flag_type       = Column(String(100), nullable=False)
    # "VELOCITY_MOBILE", "VELOCITY_DEVICE", "SHARED_BANK_ACCOUNT",
    # "GEO_MISMATCH", "SHARED_PAN", "MULTIPLE_IDENTITY"
    severity        = Column(String(20), default="MEDIUM")
    # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    description     = Column(Text, nullable=False)
    # Human-readable explanation
    related_loan_id = Column(UUID(as_uuid=True), ForeignKey("loans.id"),
                             nullable=True)
    # If triggered by another loan, reference it
    is_resolved     = Column(Boolean, default=False)
    resolved_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             nullable=True)
    resolution_note = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Fraud Detection Service

**File:** `backend/app/services/fraud_detector.py`

```python
async def run_fraud_checks(
    loan: Loan,
    user: User,
    kyc: KYCDocument,
    request_ip: str,
    db: AsyncSession,
) -> list[FraudFlag]:
    """
    Runs all fraud checks after KYC upload.
    Returns list of FraudFlag objects to be saved.
    """
    flags = []
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # ── Check 1: Mobile velocity ──────────────────────────────────
    # Same mobile number used in 3+ applications in 30 days
    mobile_count = await db.scalar(
        select(func.count(Loan.id))
        .join(User, User.id == Loan.user_id)
        .where(
            User.mobile == user.mobile,
            Loan.created_at >= thirty_days_ago,
        )
    )
    if mobile_count >= 3:
        flags.append(FraudFlag(
            loan_id=loan.id,
            user_id=user.id,
            flag_type="VELOCITY_MOBILE",
            severity="HIGH",
            description=f"Mobile {user.mobile} has been used in "
                        f"{mobile_count} loan applications in the last 30 days.",
        ))

    # ── Check 2: PAN already used by different user ───────────────
    if kyc.pan_number:
        other_kyc = await db.execute(
            select(KYCDocument)
            .join(Loan, Loan.id == KYCDocument.loan_id)
            .where(
                KYCDocument.pan_number == kyc.pan_number,
                Loan.user_id != loan.user_id,
            )
        )
        existing_pan = other_kyc.scalars().first()
        if existing_pan:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="SHARED_PAN",
                severity="CRITICAL",
                description=f"PAN {kyc.pan_number} has already been "
                            f"used with a different user account.",
                related_loan_id=existing_pan.loan_id,
            ))

    # ── Check 3: Bank account shared across users ─────────────────
    if loan.account_number:
        other_loan = await db.execute(
            select(Loan).where(
                Loan.account_number == loan.account_number,
                Loan.user_id != loan.user_id,
                Loan.status.in_(["ACTIVE", "DISBURSED", "APPROVED"]),
            )
        )
        existing_acct = other_loan.scalars().first()
        if existing_acct:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="SHARED_BANK_ACCOUNT",
                severity="HIGH",
                description=f"Bank account is already linked to a "
                            f"different active loan.",
                related_loan_id=existing_acct.id,
            ))

    # ── Check 4: IP-based velocity ────────────────────────────────
    # More than 5 applications from same IP in 24 hours
    if request_ip:
        # Store IP in loan metadata when application is created
        ip_count = await db.scalar(
            select(func.count(Loan.id))
            .where(
                cast(Loan.metadata["request_ip"], String) == request_ip,
                Loan.created_at >= now - timedelta(hours=24),
            )
        )
        if ip_count >= 5:
            flags.append(FraudFlag(
                loan_id=loan.id,
                user_id=user.id,
                flag_type="VELOCITY_DEVICE",
                severity="HIGH",
                description=f"IP address {request_ip} has submitted "
                            f"{ip_count} applications in the last 24 hours.",
            ))

    # Save all flags
    for flag in flags:
        db.add(flag)

    return flags
```

### Impact on Loan Flow

After KYC upload, run fraud checks. If any CRITICAL flags exist:
- Loan status set to `KYC_PENDING` (not auto-verified)
- Officer sees `🚩 CRITICAL FRAUD FLAGS` banner in officer dashboard
- Officer must manually resolve or dismiss each flag before proceeding

If only MEDIUM/HIGH flags:
- Loan proceeds to KYC_VERIFIED but flags are visible to officer
- Officer can still override

### New API Endpoints

```
GET  /api/admin/fraud-flags
     — List all unresolved fraud flags (admin + loan officer)
     — Filterable by severity, flag type, date

GET  /api/admin/fraud-flags/{loan_id}
     — All fraud flags for a specific loan

POST /api/admin/fraud-flags/{flag_id}/resolve
     — Body: {resolution_note}
     — Marks flag as resolved, stores resolver and note

GET  /api/admin/fraud-stats
     — Summary: flags by type, flags by severity, monthly trend
```

### Blacklist / Watchlist

Add new DB table `blacklist`:

```python
class Blacklist(Base):
    __tablename__ = "blacklist"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    identifier_type = Column(String(30))
    # "PAN", "AADHAAR", "MOBILE", "EMAIL", "BANK_ACCOUNT"
    identifier_value = Column(String(200), nullable=False)
    reason          = Column(Text, nullable=False)
    added_by        = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

Check blacklist during KYC upload. If a match is found:
- Set loan status to `REJECTED` immediately
- Flag: "Applicant is on the institution's blacklist"
- No KYC processing performed

Admin endpoints:
```
GET  /api/admin/blacklist
POST /api/admin/blacklist/add
DELETE /api/admin/blacklist/{id}
```

---

## 2.3 Collections Module

### What It Is
When a borrower misses EMI payments, the loan enters a collections workflow
with escalating automated outreach, officer assignment, settlement offers,
and legal notice flagging.

### New DB Table: `collections_cases`

```python
class CollectionsCase(Base):
    __tablename__ = "collections_cases"

    id                  = Column(UUID(as_uuid=True), primary_key=True,
                                 default=uuid.uuid4)
    loan_id             = Column(UUID(as_uuid=True), ForeignKey("loans.id"),
                                 unique=True)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_officer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                                 nullable=True)

    # Delinquency tracking
    days_past_due       = Column(Integer, default=0)
    overdue_amount      = Column(Float, default=0.0)
    overdue_installments = Column(Integer, default=0)
    dpd_bucket          = Column(String(20), default="CURRENT")
    # "CURRENT", "1-30", "31-60", "61-90", "90+"
    # DPD = Days Past Due

    # Collections status
    status              = Column(String(30), default="OPEN")
    # "OPEN", "IN_PROGRESS", "SETTLEMENT_OFFERED", "SETTLED",
    # "LEGAL_NOTICE_SENT", "WRITTEN_OFF", "RESOLVED"

    # Settlement
    settlement_offered  = Column(Boolean, default=False)
    settlement_amount   = Column(Float, nullable=True)
    # Reduced amount accepted as full settlement
    settlement_discount_pct = Column(Float, nullable=True)
    settlement_valid_until = Column(DateTime, nullable=True)
    settlement_accepted = Column(Boolean, nullable=True)

    # Legal
    legal_notice_sent   = Column(Boolean, default=False)
    legal_notice_date   = Column(DateTime, nullable=True)

    opened_at           = Column(DateTime, default=datetime.utcnow)
    last_contact_at     = Column(DateTime, nullable=True)
    resolved_at         = Column(DateTime, nullable=True)
    notes               = Column(Text)


class CollectionsActivity(Base):
    __tablename__ = "collections_activity"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    case_id         = Column(UUID(as_uuid=True),
                             ForeignKey("collections_cases.id"))
    activity_type   = Column(String(50))
    # "EMAIL_SENT", "SMS_SENT", "CALL_LOGGED", "SETTLEMENT_OFFERED",
    # "NOTE_ADDED", "STATUS_CHANGED", "LEGAL_NOTICE"
    description     = Column(Text)
    performed_by    = Column(String(100))
    # "system" or officer user_id
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Collections Trigger Logic

APScheduler job — runs daily at 6 AM:

```python
async def run_collections_engine():
    """
    Daily job: identifies overdue loans and triggers collections workflow.
    """
    today = datetime.utcnow().date()
    active_loans = await get_all_active_loans()

    for loan in active_loans:
        overdue = [
            e for e in loan.emi_schedule
            if e.status == "PENDING" and e.due_date.date() < today
        ]
        if not overdue:
            continue

        days_past_due = (today - overdue[0].due_date.date()).days
        overdue_amount = sum(e.emi_amount for e in overdue)
        dpd_bucket = get_dpd_bucket(days_past_due)

        # Open or update collections case
        case = await get_or_create_collections_case(loan, overdue_amount,
                                                     days_past_due, dpd_bucket)

        # Trigger appropriate action based on DPD
        await trigger_collections_action(case, days_past_due, loan)


async def trigger_collections_action(case, days_past_due, loan):
    if days_past_due == 1:
        # Day 1: Gentle reminder email
        await send_soft_reminder(loan)
        await log_activity(case, "EMAIL_SENT", "Day 1 soft reminder sent")

    elif days_past_due == 3:
        # Day 3: Urgent reminder
        await send_urgent_reminder(loan)

    elif days_past_due == 7:
        # Day 7: Assign to collections officer
        officer = await get_available_collections_officer()
        if officer:
            case.assigned_officer_id = officer.id
            await notify_officer_assignment(officer, case)
        await log_activity(case, "OFFICER_ASSIGNED", f"Assigned to {officer.full_name}")

    elif days_past_due == 15:
        # Day 15: Settlement offer (10% discount)
        outstanding = await calculate_outstanding_principal(loan)
        settlement_amount = outstanding * 0.90  # 10% discount
        case.settlement_offered = True
        case.settlement_amount = settlement_amount
        case.settlement_discount_pct = 10.0
        case.settlement_valid_until = datetime.utcnow() + timedelta(days=15)
        case.status = "SETTLEMENT_OFFERED"
        await send_settlement_offer_email(loan, settlement_amount)

    elif days_past_due == 30:
        # Day 30: Legal notice flag
        case.legal_notice_sent = True
        case.legal_notice_date = datetime.utcnow()
        case.status = "LEGAL_NOTICE_SENT"
        await generate_legal_notice_pdf(loan, case)
        # Sends as email attachment via Brevo


def get_dpd_bucket(days: int) -> str:
    if days <= 0:    return "CURRENT"
    if days <= 30:   return "1-30"
    if days <= 60:   return "31-60"
    if days <= 90:   return "61-90"
    return "90+"
```

### New API Endpoints

```
GET  /api/admin/collections/cases
     — List all collections cases (filterable by DPD bucket, status, officer)

GET  /api/admin/collections/cases/{case_id}
     — Case detail: loan info, activity log, overdue amounts

PUT  /api/admin/collections/cases/{case_id}/assign
     — Assign to a collections officer

POST /api/admin/collections/cases/{case_id}/settlement
     — Body: {discount_pct, valid_days}
     — Creates a settlement offer and sends email

POST /api/admin/collections/cases/{case_id}/note
     — Add an internal note to the case activity log

POST /api/admin/collections/cases/{case_id}/legal-notice
     — Flag for legal notice, generate PDF

POST /api/admin/collections/cases/{case_id}/resolve
     — Mark case as resolved (after full payment or settlement)

GET  /api/admin/collections/stats
     — Total overdue, by DPD bucket, recovery rate, officer performance
```

### Collections Officer Dashboard

**File:** `frontend/app/admin/collections/page.tsx`

Two-panel layout (same pattern as officer dashboard):

**Left panel — Collections Queue:**
```
DPD BUCKET          COUNT    AMOUNT
1-30 days           12       ₹4,82,000
31-60 days          5        ₹3,15,000
61-90 days          2        ₹1,90,000
90+ days            1        ₹95,000

My Assigned Cases: 8
```

**Right panel — Case Detail:**
- Borrower profile, loan summary, overdue amount
- DPD badge (color-coded: amber = 1-30, orange = 31-60, red = 61+, dark red = 90+)
- Contact history (last contact date, all activity log entries)
- Settlement offer section: configure discount %, valid days, send button
- Internal notes
- Action buttons: Call Logged, Settlement Offered, Legal Notice, Resolve

---

## 2.4 Portfolio Risk Dashboard

### What It Is
The management-level view. Not per-loan operational data — aggregate risk
metrics that the CFO, Risk Head, and Board look at weekly.

### New API Endpoints

```
GET  /api/admin/portfolio/summary
     — {total_aum, active_loans, npa_amount, npa_rate,
        avg_credit_score, avg_dti, disbursement_mtd,
        collection_efficiency, portfolio_at_risk}

GET  /api/admin/portfolio/dpd-distribution
     — Loan counts and amounts by DPD bucket

GET  /api/admin/portfolio/vintage-analysis
     — For each disbursement month cohort:
        {month, disbursed_count, disbursed_amount,
         still_active, closed, npa_count, npa_rate}

GET  /api/admin/portfolio/geographic-distribution
     — Loans by state (from borrower address in profile)
     — {state, count, amount, npa_rate}

GET  /api/admin/portfolio/product-mix
     — Breakdown by loan purpose, amount band, tenure band

GET  /api/admin/portfolio/recovery-analysis
     — Collections performance: {cases_opened, settled, recovered_amount,
        avg_recovery_rate, legal_notices_sent}
```

### Portfolio Risk UI

**File:** `frontend/app/admin/portfolio/page.tsx`

**Top metrics strip (4 cards):**
- Total AUM (Assets Under Management) — total outstanding across all active loans
- NPA Rate — Non-Performing Assets as % of total AUM
- Collection Efficiency — % of EMIs collected on time this month
- Portfolio at Risk (PAR) — % of portfolio where borrower is 30+ DPD

**DPD Distribution Bar Chart:**
Pure CSS stacked horizontal bar — no chart library.
Segments: Current (green), 1-30 (yellow), 31-60 (orange), 61-90 (red), 90+ (dark red).

**Vintage Analysis Table:**
Each row = a disbursement month cohort.
Columns: Month, Disbursed (₹), Count, Active, Closed, NPA Count, NPA Rate.
Color-code NPA Rate: green (<1%), yellow (1-3%), red (>3%).

**Geographic Heat Map (text-based):**
Simple table sorted by NPA rate descending.
Top 5 states by exposure, top 5 states by NPA rate.

---

---

# CATEGORY 3 — OPERATIONAL EFFICIENCY FEATURES

---

## 3.1 Agent / DSA Module

### What It Is
Direct Selling Agents (DSAs) are intermediaries who source loan applications
on behalf of the institution. They get a commission per successfully disbursed
loan. This module gives them their own portal.

### New DB Table: `agents`

```python
class Agent(Base):
    __tablename__ = "agents"

    id                  = Column(UUID(as_uuid=True), primary_key=True,
                                 default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                                 unique=True)
    agent_code          = Column(String(20), unique=True, nullable=False)
    # e.g. "DSA-2026-0042"
    agency_name         = Column(String(200))
    # If agent works for an agency, not solo
    commission_rate_pct = Column(Float, default=1.0)
    # % of disbursed amount paid as commission
    # Configurable per agent by admin
    total_applications  = Column(Integer, default=0)
    total_disbursed     = Column(Integer, default=0)
    total_commission_earned = Column(Float, default=0.0)
    total_commission_paid   = Column(Float, default=0.0)
    kyc_verified        = Column(Boolean, default=False)
    # Agent's own KYC must be verified before they can submit applications
    is_active           = Column(Boolean, default=True)
    registered_at       = Column(DateTime, default=datetime.utcnow)


class AgentCommission(Base):
    __tablename__ = "agent_commissions"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    agent_id        = Column(UUID(as_uuid=True), ForeignKey("agents.id"))
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"))
    disbursed_amount = Column(Float)
    commission_rate = Column(Float)
    commission_amount = Column(Float)
    status          = Column(String(20), default="PENDING")
    # PENDING, APPROVED, PAID
    approved_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             nullable=True)
    paid_at         = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Add to `loans` table

```python
sourced_by_agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"),
                              nullable=True)
# Which agent sourced this application
```

### Agent Registration Flow

1. Agent self-registers at `/agent/register`
2. Admin reviews and approves the agent (verifies their identity)
3. Agent code generated: `DSA-{year}-{sequence}`
4. Agent receives their unique application link:
   `https://[client-domain]/apply?agent=DSA-2026-0042`
5. When a borrower applies via this link, `sourced_by_agent_id` is set on the loan

### Agent Portal

**File:** `frontend/app/agent/page.tsx`

Separate login path for agents. After login, they see the Agent Dashboard:

**Left sidebar:**
- Agent name + code
- KYC status badge
- Nav: Dashboard, My Applications, Commissions, Share Link

**Dashboard content:**
```
┌─────────────────────────────────────────────────────┐
│  MY PERFORMANCE                                     │
│  Applications: 24  |  Approved: 18  |  Rate: 75%   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  MY SHARE LINK                                      │
│  nexloan.in/apply?agent=DSA-2026-0042               │
│  [Copy]  [Share WhatsApp]  [QR Code]               │
└─────────────────────────────────────────────────────┘

MY APPLICATIONS
Name              Amount     Status          Commission
Priya Sharma      ₹3,00,000  Disbursed       ₹3,000 ✅
Rahul Mehta       ₹1,50,000  Under Review    Pending
Anjali Kumar      ₹5,00,000  KYC Pending     Pending
```

### New API Endpoints

```
POST /api/agent/register
     — Body: {full_name, email, mobile, agency_name (optional)}
     — Creates user with role=AGENT and an agents record

GET  /api/agent/dashboard
     — Performance stats + recent applications

GET  /api/agent/applications
     — All loans sourced by this agent

GET  /api/agent/commissions
     — Commission records: pending, approved, paid

POST /api/admin/agents/approve/{agent_id}
     — Admin approves agent

PUT  /api/admin/agents/{agent_id}/commission-rate
     — Set custom commission rate for agent

GET  /api/admin/agents
     — List all agents with performance stats

POST /api/admin/commissions/{commission_id}/approve
     — Approve commission for payment

GET  /api/admin/commissions/summary
     — Total pending commissions, total paid, top agents by volume
```

---

## 3.2 WhatsApp Channel

### What It Is
Loan inquiry and status check via WhatsApp Business Cloud API.
Meta gives 1,000 free conversations/month. Opens the tier-2/3 market.

### Scope (for prototype)

Full end-to-end loan application on WhatsApp is complex. Build:
1. Lead capture (inquiry) via WhatsApp
2. Application status check via WhatsApp
3. EMI reminder delivery via WhatsApp

Full KYC and document upload still happens on web. WhatsApp is the entry
point and notification channel.

### WhatsApp Webhook Setup

**File:** `backend/app/routers/whatsapp.py`

```python
@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode"),
    hub_challenge: str = Query(alias="hub.challenge"),
    hub_verify_token: str = Query(alias="hub.verify_token"),
):
    """Meta webhook verification."""
    if hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge)
    raise HTTPException(403, "Invalid verify token")


@router.post("/webhook")
async def handle_message(payload: dict, db: AsyncSession = Depends(get_db)):
    """Handles incoming WhatsApp messages."""
    # Extract message from Meta webhook payload
    try:
        message = payload["entry"][0]["changes"][0]["value"]["messages"][0]
        from_number = message["from"]
        body = message.get("text", {}).get("body", "").strip().lower()

        await process_whatsapp_message(from_number, body, db)
    except (KeyError, IndexError):
        pass  # Not a message event — could be status update

    return {"status": "ok"}  # Always return 200 to Meta
```

### Message Processing Flow

```python
async def process_whatsapp_message(phone: str, message: str, db):
    """State machine for WhatsApp conversation."""

    # Check for existing session in Redis
    session = await get_whatsapp_session(phone)

    if not session:
        # New conversation
        if any(keyword in message for keyword in
               ["loan", "apply", "help", "hi", "hello", "start"]):
            await start_inquiry_flow(phone)
        else:
            await send_whatsapp_message(phone,
                "Hi! I'm NexBot 👋\n\n"
                "Type *LOAN* to apply for a personal loan\n"
                "Type *STATUS* to check your loan status\n"
                "Type *EMI* to check your next EMI"
            )

    elif session["state"] == "AWAITING_NAME":
        session["name"] = message.title()
        session["state"] = "AWAITING_INCOME"
        await set_whatsapp_session(phone, session)
        await send_whatsapp_message(phone,
            f"Nice to meet you, {session['name']}! 😊\n\n"
            "What is your approximate monthly income? (in ₹)"
        )

    elif session["state"] == "AWAITING_INCOME":
        try:
            income = float(message.replace(",", "").replace("₹", ""))
            session["income"] = income
            session["state"] = "AWAITING_AMOUNT"
            await set_whatsapp_session(phone, session)
            await send_whatsapp_message(phone,
                "How much do you need? (in ₹)\n"
                "We offer ₹50,000 to ₹25,00,000"
            )
        except ValueError:
            await send_whatsapp_message(phone,
                "Please enter a number (e.g. 50000)"
            )

    elif session["state"] == "AWAITING_AMOUNT":
        # ... collect amount, calculate readiness, create inquiry
        # Send deep link to complete application on web
        apply_link = f"{settings.FRONTEND_URL}/apply?wa_ref={phone}"
        await send_whatsapp_message(phone,
            f"Great! Based on your profile, you may be eligible for "
            f"a loan of up to ₹{estimated_amount:,.0f} 🎉\n\n"
            f"Click here to complete your application in 5 minutes:\n"
            f"{apply_link}\n\n"
            "Your information has been saved — just continue from where you left off!"
        )
        await create_whatsapp_lead(session, phone, db)
        await clear_whatsapp_session(phone)

    elif message == "status":
        # Check loan status
        user = await find_user_by_phone(phone, db)
        if not user:
            await send_whatsapp_message(phone,
                "No account found with this number.\n"
                "Type LOAN to start a new application."
            )
        else:
            loan = await get_latest_loan(user.id, db)
            if loan:
                await send_whatsapp_message(phone,
                    f"📋 *Loan Status Update*\n\n"
                    f"Loan: {loan.loan_number}\n"
                    f"Status: {loan.status}\n"
                    f"Amount: ₹{loan.approved_amount or loan.loan_amount:,.0f}\n\n"
                    f"View full details: {settings.FRONTEND_URL}/dashboard"
                )

    elif message == "emi":
        # EMI due check
        # ... find next pending EMI, send details
```

### Helper Functions

```python
async def send_whatsapp_message(to: str, message: str):
    """Send a WhatsApp message via Meta Cloud API."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://graph.facebook.com/v18.0/{settings.WHATSAPP_PHONE_ID}/messages",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": message}
            }
        )
```

### New Env Variables

```env
WHATSAPP_TOKEN=your-meta-cloud-api-token
WHATSAPP_PHONE_ID=your-phone-number-id
WHATSAPP_VERIFY_TOKEN=your-custom-verify-token
```

### EMI Reminders via WhatsApp

Modify the existing APScheduler EMI reminder job to also send via WhatsApp
(in addition to Brevo email) if the user's phone is registered:

```python
async def send_emi_reminders():
    # ... existing email logic ...
    # Add WhatsApp:
    if user.mobile:
        await send_whatsapp_message(
            to=f"91{user.mobile}",  # India country code
            message=f"⏰ *EMI Reminder*\n\n"
                    f"Your EMI of ₹{emi.emi_amount:,.0f} is due on "
                    f"{emi.due_date.strftime('%d %b %Y')}.\n\n"
                    f"Pay now: {settings.FRONTEND_URL}/dashboard"
        )
```

---

## 3.3 Bulk Loan Processing

### What It Is
Upload a CSV of borrower profiles, run eligibility checks in batch,
review results, and approve/disburse in bulk. Useful for group lending,
microfinance JLG (Joint Liability Groups), and MSME cohorts.

### New DB Table: `bulk_upload_jobs`

```python
class BulkUploadJob(Base):
    __tablename__ = "bulk_upload_jobs"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    uploaded_by     = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    filename        = Column(String(300))
    total_rows      = Column(Integer, default=0)
    processed_rows  = Column(Integer, default=0)
    eligible_count  = Column(Integer, default=0)
    ineligible_count = Column(Integer, default=0)
    status          = Column(String(30), default="PROCESSING")
    # "PROCESSING", "COMPLETED", "FAILED"
    result_file_url = Column(String(500))
    # R2 URL to the result CSV with eligibility verdicts
    error_message   = Column(Text, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    completed_at    = Column(DateTime, nullable=True)
```

### CSV Format Expected

```
full_name,email,mobile,monthly_income,employment_type,
existing_emi,loan_amount,tenure_months,loan_purpose
Priya Sharma,priya@example.com,9876543210,75000,SALARIED,
5000,300000,36,Medical
Rahul Mehta,rahul@example.com,9876543211,45000,BUSINESS,
8000,200000,24,Education
```

### Bulk Processing Logic

```python
@router.post("/admin/bulk-upload/process")
async def process_bulk_upload(
    file: UploadFile = File(...),
    current_user = Depends(require_role("ADMIN", "LOAN_OFFICER")),
    db: AsyncSession = Depends(get_db),
):
    """Process CSV of borrowers, run eligibility on each, return results."""
    import csv
    import io

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))

    job = BulkUploadJob(
        uploaded_by=current_user["sub"],
        filename=file.filename,
    )
    db.add(job)
    await db.flush()

    results = []
    for i, row in enumerate(reader):
        job.total_rows = i + 1

        try:
            # Run eligibility check
            scoring = calculate_credit_score(
                monthly_income=float(row["monthly_income"]),
                existing_emi=float(row["existing_emi"]),
                loan_amount=float(row["loan_amount"]),
                tenure_months=int(row["tenure_months"]),
                employment_type=row["employment_type"],
                age=30,  # Default if not provided
            )

            results.append({
                **row,
                "eligible": scoring["is_eligible"],
                "credit_score": scoring["credit_score"],
                "interest_rate": scoring["interest_rate"],
                "emi_amount": scoring["proposed_emi"],
                "rejection_reason": scoring.get("rejection_reason", ""),
                "verdict": "ELIGIBLE" if scoring["is_eligible"] else "INELIGIBLE",
            })

            if scoring["is_eligible"]:
                job.eligible_count += 1
            else:
                job.ineligible_count += 1

        except Exception as e:
            results.append({**row, "verdict": "ERROR", "error": str(e)})

        job.processed_rows = i + 1

    # Generate result CSV and upload to R2
    output = io.StringIO()
    if results:
        writer = csv.DictWriter(output, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)

    result_bytes = output.getvalue().encode("utf-8")
    result_url = await upload_to_r2(
        result_bytes,
        f"bulk-results/job-{job.id}.csv",
        "text/csv",
    )

    job.result_file_url = result_url
    job.status = "COMPLETED"
    job.completed_at = datetime.utcnow()

    return {
        "job_id": str(job.id),
        "total": job.total_rows,
        "eligible": job.eligible_count,
        "ineligible": job.ineligible_count,
        "result_file_url": result_url,
    }
```

### UI: Bulk Upload Page

**File:** `frontend/app/admin/bulk-upload/page.tsx`

```
┌──────────────────────────────────────────────────────┐
│  BULK LOAN PROCESSING                                │
│                                                      │
│  [Download CSV Template]                             │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Drag & drop your CSV file here             │    │
│  │  or click to browse                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Process File]                                      │
└──────────────────────────────────────────────────────┘

RESULTS (after processing):
Total: 50  |  Eligible: 38  |  Ineligible: 12

[Download Full Results CSV]

ELIGIBLE BORROWERS (38):
Name          Amount      Score    Rate    EMI
Priya Sharma  ₹3,00,000   742      12.5%  ₹10,065
Rahul Mehta   ₹2,00,000   695      15.0%  ₹6,933
...

[Approve All Eligible]  [Review Individually]
```

---

## 3.4 API-First Mode (Embedded Lending)

### What It Is
Expose NexLoan's underwriting and KYC engine as a clean API so
third-party platforms (hospitals, e-commerce, travel agencies) can embed
loan financing directly in their product flow.

### New DB Table: `api_clients`

```python
class APIClient(Base):
    __tablename__ = "api_clients"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    client_name     = Column(String(200), nullable=False)
    api_key         = Column(String(100), unique=True, nullable=False)
    # Generated on creation: "nxl_live_xxxxxxxxxx" or "nxl_test_xxxxxxxxxx"
    webhook_url     = Column(String(500))
    # Where to send event notifications
    allowed_origins = Column(JSON, default=[])
    # CORS origins allowed to call the embedded API
    is_active       = Column(Boolean, default=True)
    monthly_request_limit = Column(Integer, default=1000)
    requests_this_month   = Column(Integer, default=0)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Embedded Lending API Endpoints

Prefix: `/api/v1/embed/` — separate from the main API. Auth via API key header.

```
POST /api/v1/embed/eligibility-check
     Header: X-NexLoan-Key: nxl_live_xxxxxxxxxx
     Body: {name, mobile, income, employment_type, existing_emi,
            loan_amount, tenure_months, purpose}
     Returns: {eligible, credit_score, offered_rate, emi_amount,
               apply_url}  ← deep link to complete application

POST /api/v1/embed/create-application
     Header: X-NexLoan-Key: nxl_live_xxxxxxxxxx
     Body: {borrower details + loan requirements}
     Returns: {loan_id, loan_number, apply_url}
     — Creates a pre-filled application. Borrower completes KYC on web.

GET  /api/v1/embed/loan-status/{loan_id}
     Header: X-NexLoan-Key: nxl_live_xxxxxxxxxx
     Returns: {status, disbursed_amount, emi_amount, next_due_date}
```

### Webhook System for Embedded Partners

When significant events happen, fire a webhook to the partner's registered URL:

```python
async def fire_webhook(api_client: APIClient, event_type: str, data: dict):
    """Send webhook notification to partner platform."""
    if not api_client.webhook_url:
        return

    payload = {
        "event": event_type,
        # "loan.approved", "loan.disbursed", "loan.rejected",
        # "emi.paid", "loan.closed"
        "timestamp": datetime.utcnow().isoformat(),
        "data": data,
    }

    # Sign the payload with HMAC
    signature = hmac.new(
        api_client.api_key.encode(),
        json.dumps(payload).encode(),
        hashlib.sha256,
    ).hexdigest()

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            await client.post(
                api_client.webhook_url,
                json=payload,
                headers={
                    "X-NexLoan-Signature": signature,
                    "Content-Type": "application/json",
                }
            )
        except Exception as e:
            print(f"Webhook delivery failed for {api_client.client_name}: {e}")
```

### Admin UI: API Clients Page

**File:** `frontend/app/admin/api-clients/page.tsx`

- List of API clients with name, key (masked), status, requests this month
- "Create New Client" button → modal with name, webhook URL, allowed origins
- Per client: view API key, regenerate key, set rate limit, deactivate

---

---

# CATEGORY 4 — ANALYTICS & INTELLIGENCE FEATURES

---

## 4.1 Cohort Analytics

### What It Is
Group borrowers by acquisition month, credit score band, loan purpose, or
geography and track how each cohort performs over time.

### New API Endpoints

```
GET  /api/admin/analytics/cohorts
     Query params: group_by=acquisition_month|score_band|purpose|state
     Returns array of cohort objects:
     {
       cohort_label: "Apr 2026",
       total_loans: 45,
       total_disbursed: 8750000,
       avg_credit_score: 714,
       avg_dti: 0.28,
       on_time_rate: 0.89,       # % of EMIs paid on time
       npa_count: 2,
       npa_rate: 0.044,
       avg_tenure_months: 34,
       closed_count: 12,
       active_count: 31,
     }

GET  /api/admin/analytics/cohort-performance/{cohort_id}
     — Detailed month-by-month performance for a specific cohort
     — Shows how on-time rate evolves over time
```

### Cohort Analytics UI

**File:** `frontend/app/admin/analytics/page.tsx`

Tab 1 — Cohorts:
- Dropdown: "Group by" (Month / Score Band / Purpose / State)
- Table showing all cohorts with the metrics above
- Highlight rows where NPA rate > 3% in red
- Click a cohort → drill down to individual loans in that cohort

Tab 2 — Trends:
- Line chart (pure CSS, no library) showing monthly:
  - New loans disbursed
  - Total EMIs collected
  - New NPA cases opened
  - Collections resolved

Tab 3 — Top / Bottom Performers:
- Top 10 borrowers by on-time payment rate
- Bottom 10 by DPD
- Top 5 agents by approval rate
- Top 5 loan purposes by repayment performance

---

## 4.2 Automated Credit Policy Testing (A/B Testing)

### What It Is
The admin defines two credit policies and splits incoming applications
between them. After 90 days, compare default rates to find the optimal policy.

### New DB Tables

```python
class CreditPolicyExperiment(Base):
    __tablename__ = "credit_policy_experiments"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    name            = Column(String(200))
    description     = Column(Text)
    status          = Column(String(20), default="ACTIVE")
    # "ACTIVE", "PAUSED", "CONCLUDED"
    start_date      = Column(DateTime, default=datetime.utcnow)
    end_date        = Column(DateTime, nullable=True)
    traffic_split   = Column(Float, default=0.5)
    # 0.5 = 50/50 split. 0.3 = 30% Policy B, 70% Policy A.
    created_by      = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Policy A (Control — current policy)
    policy_a_min_score          = Column(Integer, default=600)
    policy_a_max_dti            = Column(Float, default=0.50)

    # Policy B (Challenger)
    policy_b_min_score          = Column(Integer)
    policy_b_max_dti            = Column(Float)

    # Results (populated after experiment concludes)
    policy_a_approval_rate      = Column(Float)
    policy_a_npa_rate           = Column(Float)
    policy_b_approval_rate      = Column(Float)
    policy_b_npa_rate           = Column(Float)
    winner                      = Column(String(10))
    # "A", "B", or "INCONCLUSIVE"


class ExperimentAssignment(Base):
    __tablename__ = "experiment_assignments"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    experiment_id   = Column(UUID(as_uuid=True),
                             ForeignKey("credit_policy_experiments.id"))
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"))
    policy_group    = Column(String(1))  # "A" or "B"
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### A/B Logic in Underwriting

```python
async def get_policy_for_loan(loan_id: str, db: AsyncSession) -> dict:
    """
    Checks if an active experiment exists.
    If yes: assigns loan to a policy group and returns that policy's parameters.
    If no: returns default policy from tenant_config.
    """
    # Check for active experiment
    experiment = await get_active_experiment(db)

    if not experiment:
        tenant = await get_tenant_config(db)
        return {
            "min_score": 600,
            "max_dti": 0.50,
            "policy_group": None,
            "experiment_id": None,
        }

    # Assign to group based on loan_id hash (deterministic)
    loan_hash = int(loan_id.replace("-", "")[:8], 16)
    is_policy_b = (loan_hash % 100) < (experiment.traffic_split * 100)
    policy_group = "B" if is_policy_b else "A"

    # Save assignment
    assignment = ExperimentAssignment(
        experiment_id=experiment.id,
        loan_id=loan_id,
        policy_group=policy_group,
    )
    db.add(assignment)

    if policy_group == "B":
        return {
            "min_score": experiment.policy_b_min_score,
            "max_dti": experiment.policy_b_max_dti,
            "policy_group": "B",
            "experiment_id": str(experiment.id),
        }
    else:
        return {
            "min_score": experiment.policy_a_min_score,
            "max_dti": experiment.policy_a_max_dti,
            "policy_group": "A",
            "experiment_id": str(experiment.id),
        }
```

### A/B Admin UI

**File:** `frontend/app/admin/experiments/page.tsx`

- List of experiments with status
- "New Experiment" form: name, policy A params, policy B params, traffic split %
- Active experiment dashboard:
  ```
  EXPERIMENT: "Test stricter DTI limit"
  Running since: 1 Apr 2026 (28 days)

  Policy A (Control):    Policy B (Challenger):
  Min Score: 600         Min Score: 600
  Max DTI: 50%           Max DTI: 45%

  Applications: 156      Applications: 72
  Approved: 112 (72%)    Approved: 48 (67%)
  NPA so far: 2 (1.8%)   NPA so far: 0 (0%)

  [Pause Experiment]  [Conclude & Pick Winner]
  ```

---

## 4.3 Predictive Early Warning System

### What It Is
Flag borrowers likely to default in the next 30 days — before they miss
a payment. Uses repayment pattern analysis via Groq.

### New DB Table: `early_warning_flags`

```python
class EarlyWarningFlag(Base):
    __tablename__ = "early_warning_flags"

    id              = Column(UUID(as_uuid=True), primary_key=True,
                             default=uuid.uuid4)
    loan_id         = Column(UUID(as_uuid=True), ForeignKey("loans.id"))
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    risk_score      = Column(Float)
    # 0.0 (no risk) to 1.0 (high risk)
    risk_label      = Column(String(20))
    # "LOW", "MEDIUM", "HIGH"
    prediction_basis = Column(JSON)
    # {late_payments: 1, avg_days_late: 3, payment_trend: "deteriorating"}
    ai_analysis     = Column(Text)
    # Groq-generated plain English explanation
    action_taken    = Column(String(100))
    # "PROACTIVE_EMAIL_SENT", "OFFICER_NOTIFIED", "NONE"
    is_resolved     = Column(Boolean, default=False)
    created_at      = Column(DateTime, default=datetime.utcnow)
```

### Early Warning APScheduler Job

Runs weekly (every Monday at 7 AM):

```python
async def run_early_warning_system():
    """
    Analyzes repayment patterns for all active loans.
    Flags borrowers showing signs of future default.
    """
    active_loans = await get_all_active_loans()

    for loan in active_loans:
        risk_data = analyze_repayment_pattern(loan)

        if risk_data["risk_score"] >= 0.5:
            # Generate AI explanation
            ai_analysis = await generate_early_warning_analysis(
                loan, risk_data
            )

            flag = EarlyWarningFlag(
                loan_id=loan.id,
                user_id=loan.user_id,
                risk_score=risk_data["risk_score"],
                risk_label=risk_data["risk_label"],
                prediction_basis=risk_data,
                ai_analysis=ai_analysis,
            )
            db.add(flag)

            # Take action based on risk level
            if risk_data["risk_label"] == "HIGH":
                await send_proactive_email(loan)
                flag.action_taken = "PROACTIVE_EMAIL_SENT"
            elif risk_data["risk_label"] == "MEDIUM":
                flag.action_taken = "OFFICER_NOTIFIED"
                await notify_loan_officer(loan, flag)


def analyze_repayment_pattern(loan: Loan) -> dict:
    """Rule-based repayment pattern analysis."""
    paid = [e for e in loan.emi_schedule if e.status == "PAID"]
    pending = [e for e in loan.emi_schedule if e.status == "PENDING"]

    if len(paid) < 2:
        return {"risk_score": 0.1, "risk_label": "LOW"}

    # Calculate average days late for paid EMIs
    days_late_list = []
    for emi in paid:
        if emi.paid_at and emi.due_date:
            days_late = (emi.paid_at - emi.due_date).days
            days_late_list.append(days_late)

    avg_days_late = sum(days_late_list) / len(days_late_list)
    late_count = sum(1 for d in days_late_list if d > 0)
    late_rate = late_count / len(paid)

    # Check if payment trend is deteriorating
    recent_3 = days_late_list[-3:] if len(days_late_list) >= 3 else days_late_list
    trend = "improving" if recent_3[-1] < recent_3[0] else "deteriorating"

    # Calculate risk score
    risk_score = 0.0
    risk_score += min(avg_days_late / 30, 0.4)  # Up to 0.4 for lateness
    risk_score += late_rate * 0.3               # Up to 0.3 for late rate
    risk_score += 0.3 if trend == "deteriorating" else 0.0

    risk_label = (
        "HIGH" if risk_score >= 0.7 else
        "MEDIUM" if risk_score >= 0.4 else
        "LOW"
    )

    return {
        "risk_score": round(risk_score, 3),
        "risk_label": risk_label,
        "avg_days_late": round(avg_days_late, 1),
        "late_payments": late_count,
        "total_paid": len(paid),
        "late_rate": round(late_rate, 3),
        "payment_trend": trend,
    }


async def generate_early_warning_analysis(loan, risk_data) -> str:
    """Use Groq to generate plain-English risk explanation."""
    prompt = f"""
    A borrower has the following repayment pattern for their active loan:
    - Average days late per payment: {risk_data['avg_days_late']} days
    - Late payments: {risk_data['late_payments']} out of {risk_data['total_paid']} total
    - Payment trend: {risk_data['payment_trend']}
    - Risk score: {risk_data['risk_score']:.0%}

    Write a 2-sentence plain English explanation of the default risk for
    a loan officer. Be specific and actionable. Do not use technical jargon.
    """
    # Call Groq llama3-70b-8192 with this prompt
    # Return the response text
```

### Early Warning UI

**File:** `frontend/app/admin/early-warning/page.tsx`

```
EARLY WARNING SYSTEM                    Weekly scan: 28 Apr 2026

HIGH RISK (2 loans)
  NL-2026-00034  ANJALI KUMAR    Score: 0.78  Avg 8 days late, deteriorating
  [Review]  [Send Email]  [Assign Officer]

MEDIUM RISK (7 loans)
  NL-2026-00028  PRIYA SHARMA    Score: 0.52  3 of 6 payments late
  ...
  [Review]  [Send Email]
```

Each row expands to show the AI narrative analysis.

---

## 4.4 Benchmark Reports

### What It Is
Monthly automated report emailed to the lender's management showing
platform performance vs industry benchmarks.

### New Config Fields in `tenant_config`

```python
benchmark_report_email      = Column(String(200))
# Who receives the monthly benchmark email
benchmark_report_enabled    = Column(Boolean, default=True)
benchmark_report_day        = Column(Integer, default=1)
# Which day of the month to send (default: 1st)
```

### Monthly Benchmark Report (APScheduler)

Runs on the configured day each month at 8 AM:

```python
async def send_monthly_benchmark_report():
    """
    Generates and emails a benchmark report to the lender's management.
    """
    tenant = await get_tenant_config()
    if not tenant.benchmark_report_enabled:
        return

    # Calculate this month's metrics
    metrics = await calculate_monthly_metrics()

    # Industry benchmarks (hardcoded for prototype — in production,
    # these would come from a benchmarking database)
    benchmarks = {
        "approval_rate":        0.58,   # 58% industry average
        "npa_rate":             0.021,  # 2.1% industry average
        "avg_processing_days":  2.3,    # 2.3 days industry average
        "collection_efficiency": 0.92,  # 92% industry average
    }

    # Generate HTML report
    html_report = generate_benchmark_html(metrics, benchmarks, tenant)

    # Send via Brevo
    await send_email(
        to_email=tenant.benchmark_report_email,
        subject=f"NexLoan Monthly Performance Report — {current_month}",
        html_content=html_report,
    )


def generate_benchmark_html(metrics, benchmarks, tenant) -> str:
    """
    Generates an HTML email showing client metrics vs industry benchmarks.
    Color-coded: green = beating benchmark, red = below benchmark.
    """
    # Returns a styled HTML string with:
    # - Header: client logo + report title + month
    # - 4 comparison cards: approval rate, NPA rate, processing time, collection efficiency
    # - Each card shows: client metric vs industry benchmark + delta
    # - Trend section: month-over-month change for key metrics
    # - Recommendations: 2-3 Groq-generated action items based on performance
    # - Footer: Theoremlabs branding
```

### On-Demand Benchmark Report

```
GET  /api/admin/reports/benchmark?month=2026-04
     — Generate benchmark report for any past month on demand
     — Returns HTML content that can be previewed in browser

POST /api/admin/reports/benchmark/email
     — Body: {month, email}
     — Sends benchmark report to specified email immediately
```

---

## PART 5 — NEW DATABASE MIGRATIONS

After implementing all new tables, create Alembic migration:

```bash
cd backend
alembic revision --autogenerate -m "revenue_risk_ops_analytics_features"
alembic upgrade head
```

New tables created by this migration:
- `rate_rules`
- `offers`
- `bureau_scores`
- `fraud_flags`
- `blacklist`
- `collections_cases`
- `collections_activity`
- `agents`
- `agent_commissions`
- `referral_codes`
- `referrals`
- `bulk_upload_jobs`
- `api_clients`
- `credit_policy_experiments`
- `experiment_assignments`
- `early_warning_flags`

New columns added to existing tables:
- `loans`: `sourced_by_agent_id`, `is_topup`, `parent_loan_id`,
           `topup_previous_outstanding`
- `users`: `reward_balance`
- `tenant_config`: `bureau_mode`, `bureau_weight`, `bureau_api_key`,
                   `bureau_enabled`, `referral_reward_amount`,
                   `benchmark_report_email`, `benchmark_report_enabled`,
                   `benchmark_report_day`

---

## PART 6 — REQUIREMENTS.TXT ADDITIONS

Add to `backend/requirements.txt`:
```
fuzzywuzzy==0.18.0               # (if not already present)
python-Levenshtein==0.25.0       # (if not already present)
httpx==0.27.0                    # (if not already present)
```

---

## PART 7 — NEW ENV VARIABLES

Add to `backend/.env`:
```env
# WhatsApp Business Cloud API
WHATSAPP_TOKEN=your-meta-cloud-api-bearer-token
WHATSAPP_PHONE_ID=your-whatsapp-phone-number-id
WHATSAPP_VERIFY_TOKEN=your-custom-webhook-verify-token

# Bureau Integration
BUREAU_MODE=simulated
# Options: simulated | cibil | experian | crif
# Keep as "simulated" until commercial agreement in place
```

---

## PART 8 — NEW FRONTEND ROUTES SUMMARY

```
/agent                      Agent portal dashboard
/agent/register             Agent self-registration

/admin/rate-rules           Dynamic interest rate engine
/admin/collections          Collections officer dashboard
/admin/bulk-upload          Bulk loan processing
/admin/api-clients          API/embedded lending management
/admin/agents               Agent management
/admin/fraud-flags          Fraud flag review
/admin/blacklist            Blacklist management
/admin/portfolio            Portfolio risk dashboard
/admin/analytics            Cohort analytics + trends
/admin/experiments          A/B credit policy testing
/admin/early-warning        Predictive early warning system
/admin/reports              Benchmark reports
```

---

## PART 9 — EXECUTION ORDER

Execute in this exact sequence:

```
Phase 1:  Add new DB columns to existing tables (migration prep)
Phase 2:  Create all new DB tables (migration)
Phase 3:  Run Alembic migration
Phase 4:  Dynamic rate engine (service + API + admin UI)
Phase 5:  Cross-sell offer engine (service + API + dashboard cards)
Phase 6:  Loan top-up module (calculation + API + dashboard UI)
Phase 7:  Referral engine (codes + tracking + dashboard section)
Phase 8:  Bureau integration layer (service + config + underwriting hook)
Phase 9:  Fraud pattern detection (service + flags + officer dashboard)
Phase 10: Blacklist / watchlist (table + API + admin UI)
Phase 11: Collections module (engine + APScheduler + officer dashboard)
Phase 12: Portfolio risk dashboard (API + admin UI)
Phase 13: Agent / DSA module (tables + portal + commission tracking)
Phase 14: WhatsApp channel (webhook + message flow + EMI reminders)
Phase 15: Bulk loan processing (CSV upload + eligibility check + results)
Phase 16: API-first mode (endpoints + webhook + admin UI)
Phase 17: Cohort analytics (API + analytics UI)
Phase 18: A/B credit policy testing (experiment tables + underwriting hook + UI)
Phase 19: Early warning system (APScheduler job + flagging + UI)
Phase 20: Benchmark reports (monthly job + on-demand + email template)
Phase 21: Full end-to-end verification (checklist below)
```

---

## PART 10 — FINAL VERIFICATION CHECKLIST

**Category 1 — Revenue:**
- [ ] Rate rule created in admin UI applies correctly to next loan underwriting
- [ ] Campaign rate rule with valid_from/valid_until activates and deactivates automatically
- [ ] Offer card appears on dashboard after 6 on-time payments
- [ ] Rate reduction offer updates loan.interest_rate and recalculates future EMIs
- [ ] Top-up eligibility check returns correct max amount
- [ ] Top-up closes original loan and creates new EMI schedule
- [ ] Referral code generated on registration
- [ ] Referral tracked when friend registers via referral link
- [ ] Reward credited after friend pays 3rd EMI
- [ ] Reward balance shows on dashboard referral section

**Category 2 — Risk:**
- [ ] Bureau score simulated deterministically (same PAN = same score)
- [ ] Blended score = 60% Theoremlabs + 40% bureau (configurable)
- [ ] Shared PAN fraud flag triggers on KYC upload
- [ ] Mobile velocity flag triggers after 3 applications in 30 days
- [ ] CRITICAL fraud flag blocks KYC auto-verification
- [ ] Blacklisted PAN immediately rejects loan application
- [ ] Collections case auto-created on EMI 1 day past due
- [ ] Day 7: collections case assigned to officer
- [ ] Day 15: settlement offer email sent with correct discount amount
- [ ] Portfolio dashboard shows correct NPA rate and DPD distribution

**Category 3 — Operations:**
- [ ] Agent registration flow works end-to-end
- [ ] Loan sourced via agent link sets sourced_by_agent_id
- [ ] Commission record created on disbursement
- [ ] WhatsApp webhook verifies correctly with Meta
- [ ] Incoming "LOAN" message triggers inquiry flow
- [ ] Inquiry flow collects name, income, amount, sends apply link
- [ ] "STATUS" message returns correct loan status
- [ ] EMI reminders sent via WhatsApp in addition to email
- [ ] CSV bulk upload processes all rows and returns result file
- [ ] Bulk result CSV shows correct eligible/ineligible verdicts
- [ ] API key authentication works on embedded endpoints
- [ ] Webhook fires correctly on loan.approved event

**Category 4 — Analytics:**
- [ ] Cohort analytics groups correctly by month/score band/purpose
- [ ] NPA rate calculated correctly per cohort
- [ ] A/B experiment assigns loans deterministically (same loan_id = same group)
- [ ] Experiment dashboard shows approval rate and NPA rate per group
- [ ] Early warning job runs and flags high-risk borrowers
- [ ] Groq generates early warning AI analysis (not empty)
- [ ] Proactive email sent to HIGH risk borrowers
- [ ] Benchmark report email sends with correct metrics vs benchmarks
- [ ] On-demand benchmark report generates for any past month

---

*NexLoan — Revenue, Risk, Operations & Analytics Edition*
*prompt5.md — Powered by Theoremlabs*