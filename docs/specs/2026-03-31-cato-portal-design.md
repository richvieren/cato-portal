# Cato Portal — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** A client portal at `app.catovermeulen.com` where Cato's clients log in once and access whatever products they've paid for — starting with the Blueprint, then the course, then the mini reading.

**Architecture:** Static site on GitHub Pages. Supabase for auth (magic link), access control, and client profiles. Stripe for payment with a Supabase Edge Function webhook to grant access automatically.

**Tech Stack:** Vanilla HTML/JS/CSS, Supabase JS v2, Stripe Checkout + webhooks, GitHub Pages, Resend for transactional email.

---

## Brand

Colors (from Cato Vermeulen Final Branding Direction):
- `--stone: #BAAFA3`
- `--linen: #D8CFB9`
- `--smoke: #242324`
- `--mist: #F2F0E5`
- `--golden: #9F8261`

Typography:
- Headers: Cormorant Garamond (Google Fonts) — matches course HTML, closest available to Ethic Serif
- Body: Jost (Google Fonts) — matches course HTML, closest available to Optitomaso Extd
- Weight: light/300 body, 400 headings. No bold headings.

Visual mood: luxury, editorial, elevated. Minimal. No gradients, no decorative shadows. Warm neutrals on dark smoke backgrounds.

---

## Build Order

Phase 1 (this spec): Portal shell + Blueprint paywall + intake form.
Full flow: Stripe payment → access grant → magic link → dashboard → intake form → 24h wait → reading.
Phase 2 (later): Course portal, progress tracking.
Phase 3 (later): Mini reading.

---

## Database Schema (Phase 1)

### `access_grants`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| email | text | lowercase always |
| product | text | `blueprint`, `course`, `mini_reading` |
| granted_at | timestamptz | set on Stripe webhook |
| stripe_session_id | text UNIQUE | deduplication — UNIQUE constraint required |
| available_at | timestamptz | NULL on grant. Set to NOW()+24h when intake form is submitted |
| revoked_at | timestamptz | NULL = active |

RLS: `lower(email) = lower(auth.jwt() ->> 'email')`

### `profiles`
| column | type | notes |
|---|---|---|
| id | uuid PK = auth.uid() | |
| email | text | |
| full_name | text | |
| dob | date | |
| tob | time | |
| city | text | |
| country | text | |
| submitted_at | timestamptz | set when intake form is submitted |
| created_at | timestamptz | |

RLS: user can only read/write their own row.

`progress` table is Phase 2 — do NOT create it in Phase 1.

---

## Auth Flow

1. User arrives at `app.catovermeulen.com` — not logged in → sees login screen
2. Enters email → Supabase sends magic link via Resend SMTP
3. Clicks magic link → redirected back to portal, session established
4. Dashboard loads → checks `access_grants` for their email → shows product card states

### Supabase Auth URL Configuration (critical — must be set before testing)
- Site URL: `https://app.catovermeulen.com`
- Redirect URLs: add `https://app.catovermeulen.com`
- Failure to set these causes magic links to redirect to localhost

---

## Purchase + Onboarding Flow (Blueprint)

1. Showit Blueprint landing page → "Buy Now" → Stripe Checkout (hosted)
2. Stripe Checkout collects email + payment. Session created with `metadata: { product: 'blueprint' }`
3. Stripe fires `checkout.session.completed` webhook → Supabase Edge Function `stripe-webhook`
4. Edge Function:
   - Verifies `stripe-signature` header against `STRIPE_WEBHOOK_SECRET`
   - Extracts email: check `session.customer_details.email` first, fall back to `session.customer_email`
   - Upserts row into `access_grants` with `available_at = NULL` (not available until intake submitted)
   - Always returns HTTP 200 — even on duplicate — so Stripe does not keep retrying
   - Calls Supabase Auth admin API to generate magic link for `app.catovermeulen.com`
   - Sends welcome email via Resend with magic link + instruction to complete their intake form
5. Client clicks magic link → portal → dashboard → Blueprint card shows "intake" state
6. Client clicks Blueprint card → `blueprint.html` → intake form (name, DOB, time of birth, city, country)
7. Client submits intake form → `profiles` row saved, `available_at` on `access_grants` set to `NOW() + 24h`
8. Dashboard Blueprint card switches to `pending` state with countdown
9. 24h later → card becomes `ready`, client can view their reading

### Edge Function deploy command
```bash
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref [project-ref]
```
`--no-verify-jwt` is required — Stripe requests carry no Supabase JWT and will 401 without it.

---

## Pages

### `index.html` — Login + Dashboard
- Not logged in: centered email input + "Send me access link" button. Cato branding, smoke background.
- Logged in: dashboard with three product cards (Blueprint, Course, Mini Reading)
- Blueprint card states:
  - `locked` — no access_grants row → lock icon, "Get your reading" links to Showit purchase page
  - `intake` — row exists, available_at is NULL, profiles.submitted_at is NULL → "Complete your details" CTA links to blueprint.html
  - `pending` — profiles submitted, available_at is in the future → non-clickable, countdown "Ready in Xh Ym"
  - `ready` — available_at has passed → clickable, navigates to blueprint.html
- Course + Mini Reading cards: locked state only in Phase 1 (links to Showit)

### `blueprint.html` — Blueprint viewer + intake form
Three views depending on state, checked on load:

**Intake view** (no profiles.submitted_at):
- Form fields: Full name, Date of birth (date picker), Time of birth (time picker), City, Country
- Submit → saves to `profiles`, sets `available_at = NOW() + 24h` on `access_grants`, redirects to dashboard

**Pending view** (profiles submitted, available_at in future):
- "Your reading is being prepared." + countdown timer
- No form, no reading content

**Ready view** (available_at has passed):
- Phase 1: placeholder text "Your reading is ready. Cato will be in touch shortly."
- Download PDF button: Phase 1 placeholder, wired up in later phase when PDF storage is added

### `course.html` — Course player (Phase 2 placeholder)
- Ships as an empty file in Phase 1 — do not implement course content yet

---

## Supabase Edge Function: `stripe-webhook`

```
POST /functions/v1/stripe-webhook
```

Environment variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Resend / Email Setup

- Add domain `mail.catovermeulen.com` in Resend (subdomain — NOT root domain)
- Add DNS records in Hover: DKIM, SPF, DMARC for `mail.catovermeulen.com`
- Supabase SMTP sender: `noreply@mail.catovermeulen.com` — must match verified subdomain exactly, NOT `@catovermeulen.com`

---

## Stripe Setup

- One Stripe product: Blueprint (course + mini reading added later)
- Checkout session must include `metadata: { product: 'blueprint' }`
- Webhook endpoint: `https://[supabase-project].supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed` only

---

## File Structure (GitHub Pages repo)

```
/
├── index.html          # Login + dashboard
├── blueprint.html      # Blueprint viewer + intake form
├── course.html         # Empty placeholder (Phase 2)
├── auth.js             # Supabase auth + session handling
├── db.js               # Supabase data access (access_grants, profiles)
├── dashboard.js        # Dashboard product card rendering + state logic
├── styles.css          # Shared styles (Cato brand colors + Cormorant Garamond + Jost)
├── CNAME               # app.catovermeulen.com
└── supabase/
    └── functions/
        └── stripe-webhook/
            └── index.ts
```

---

## DNS (in Hover)

- CNAME: host `app`, value = GitHub Pages domain of the repo (e.g. `richvieren.github.io` if using that account)
- Resend: DKIM + SPF + DMARC records for `mail.catovermeulen.com`

---

## Common Failure Points (from Intuitie experience)

- `--no-verify-jwt` missing on Edge Function deploy → 401 on every Stripe webhook
- Supabase Site URL not updated from localhost → magic links redirect to localhost
- Resend sender using root domain not subdomain → 403 on email send
- RLS using `auth.email()` instead of `auth.jwt() ->> 'email'` → paywall loop
- Email case mismatch in access_grants → always lowercase on insert
- Stripe retry on 4xx/5xx → always return 200, use upsert with onConflict for deduplication
- `available_at` check: must compare against `NOW()` server-side, not client clock
