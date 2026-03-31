# Cato Portal Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client portal at `app.catovermeulen.com` where Blueprint buyers log in via magic link, submit their astro intake form, then access their reading 24 hours later.

**Architecture:** Static GitHub Pages site. Supabase for auth (magic link via Resend SMTP), access control (`access_grants`), and astro intake (`profiles`). Stripe Checkout + Edge Function webhook grants access and fires welcome email with magic link.

**Tech Stack:** Vanilla HTML/JS/CSS, Supabase JS v2, Stripe Checkout + webhooks, Supabase Edge Functions (Deno), Resend API, GitHub Pages.

**Reference:** Intuitie portal at `~/Developer/PORTAL/` — same auth pattern. Key differences: Stripe not ThriveCart, `profiles` intake table, `available_at` timer, four card states.

---

## File Structure

```
cato-portal/                         ← GitHub repo root
├── index.html                       # Login screen + dashboard (two views in one file)
├── blueprint.html                   # Intake form / pending / ready views
├── course.html                      # Empty Phase 2 placeholder
├── auth.js                          # Supabase client init, magic link, session helpers
├── db.js                            # access_grants + profiles data access
├── dashboard.js                     # Blueprint card state logic + rendering
├── styles.css                       # Brand colors, typography, shared layout
├── CNAME                            # app.catovermeulen.com
└── supabase/
    └── functions/
        ├── stripe-webhook/
        │   └── index.ts             # Stripe sig verify → upsert access_grants → Resend email
        └── set-available-at/
            └── index.ts             # Sets available_at = NOW()+24h after intake submission
```

No build step. No bundler. Files loaded directly via `<script src="">` tags.

---

## Task 1: Supabase project + schema

**Files:**
- Reference only (no local files — done in Supabase dashboard + SQL editor)

- [ ] **Step 1: Create Supabase project**

  Go to supabase.com → New project. Name: `cato-portal`. Note the project ref, URL, and anon key.

- [ ] **Step 2: Run schema SQL**

  In Supabase SQL editor, run:

  ```sql
  -- access_grants
  create table access_grants (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    product text not null,
    granted_at timestamptz not null default now(),
    stripe_session_id text unique,
    available_at timestamptz,
    revoked_at timestamptz
  );

  alter table access_grants enable row level security;

  create policy "users read own grants"
    on access_grants for select
    using (lower(email) = lower(auth.jwt() ->> 'email'));

  -- profiles (intake form data)
  create table profiles (
    id uuid primary key references auth.users(id),
    email text not null,
    full_name text,
    dob date,
    tob time,
    city text,
    country text,
    submitted_at timestamptz,
    created_at timestamptz not null default now()
  );

  alter table profiles enable row level security;

  create policy "users read own profile"
    on profiles for select
    using (auth.uid() = id);

  create policy "users write own profile"
    on profiles for insert
    with check (auth.uid() = id);

  create policy "users update own profile"
    on profiles for update
    using (auth.uid() = id);
  ```

- [ ] **Step 3: Add set_available_at SQL function**

  Run in Supabase SQL editor — lets the Edge Function set `available_at` using the Postgres clock (spec requirement: server-side time only):

  ```sql
  create or replace function set_blueprint_available_at(p_email text)
  returns void
  language sql
  security definer
  as $$
    update access_grants
    set available_at = now() + interval '24 hours'
    where product = 'blueprint'
      and lower(email) = lower(p_email)
      and revoked_at is null
      and available_at is null;
  $$;
  ```

- [ ] **Step 4: Configure Supabase Auth**

  Dashboard → Authentication → URL Configuration:
  - Site URL: `https://app.catovermeulen.com`
  - Redirect URLs: add `https://app.catovermeulen.com`

- [ ] **Step 4: Configure Resend SMTP in Supabase**

  Dashboard → Authentication → SMTP Settings:
  - Enable custom SMTP
  - Host: `smtp.resend.com`, Port: 465, User: `resend`, Password: Resend API key
  - Sender name: `Cato Vermeulen`, Sender email: `noreply@mail.catovermeulen.com`

  > Resend domain must be `mail.catovermeulen.com` (subdomain) with DKIM/SPF/DMARC verified in Hover DNS.

---

## Task 2: GitHub repo scaffold

**Files:**
- Create: `CNAME`
- Create: `course.html`

- [ ] **Step 1: Create GitHub repo**

  New repo: `cato-portal` (public). Enable GitHub Pages → Source: main branch, root.

- [ ] **Step 2: Create CNAME**

  ```
  app.catovermeulen.com
  ```

- [ ] **Step 3: Create course.html placeholder**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Course — Cato Vermeulen</title>
  </head>
  <body>
    <!-- Phase 2 -->
  </body>
  </html>
  ```

- [ ] **Step 4: Commit and push**

  ```bash
  git add CNAME course.html
  git commit -m "chore: scaffold repo with CNAME and course placeholder"
  git push
  ```

- [ ] **Step 5: Add DNS CNAME in Hover**

  Host: `app`, Type: CNAME, Value: `<github-username>.github.io`

---

## Task 3: styles.css

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write styles.css**

  ```css
  /* styles.css — Cato Vermeulen portal brand styles */

  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400&display=swap');

  :root {
    --stone: #BAAFA3;
    --linen: #D8CFB9;
    --smoke: #242324;
    --mist: #F2F0E5;
    --golden: #9F8261;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--smoke);
    color: var(--mist);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    min-height: 100vh;
  }

  h1, h2, h3 {
    font-family: 'Cormorant Garamond', serif;
    font-weight: 400;
  }

  /* ── Layout ─────────────────────────────────────────── */

  .page-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
  }

  .container {
    max-width: 880px;
    margin: 0 auto;
    padding: 3rem 2rem;
  }

  /* ── Login screen ────────────────────────────────────── */

  .login-wrap {
    text-align: center;
    max-width: 400px;
    width: 100%;
  }

  .login-wrap h1 {
    font-size: 2.4rem;
    letter-spacing: 0.04em;
    color: var(--linen);
    margin-bottom: 0.4rem;
  }

  .login-wrap p {
    color: var(--stone);
    font-size: 0.9rem;
    margin-bottom: 2.4rem;
    letter-spacing: 0.06em;
  }

  .login-sent {
    color: var(--linen);
    font-size: 0.95rem;
    line-height: 1.7;
  }

  /* ── Form inputs ─────────────────────────────────────── */

  input[type="email"],
  input[type="text"],
  input[type="date"],
  input[type="time"] {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--stone);
    color: var(--mist);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    font-size: 1rem;
    padding: 0.6rem 0;
    margin-bottom: 1.6rem;
    outline: none;
    transition: border-color 0.2s;
  }

  input::placeholder { color: var(--stone); }
  input:focus { border-bottom-color: var(--linen); }

  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator {
    filter: invert(0.6);
    cursor: pointer;
  }

  /* ── Buttons ─────────────────────────────────────────── */

  .btn {
    display: inline-block;
    padding: 0.75rem 2.4rem;
    border: 1px solid var(--stone);
    background: transparent;
    color: var(--mist);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    font-size: 0.85rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
    text-decoration: none;
  }

  .btn:hover {
    border-color: var(--linen);
    color: var(--linen);
  }

  .btn-primary {
    border-color: var(--golden);
    color: var(--golden);
  }

  .btn-primary:hover {
    border-color: var(--linen);
    color: var(--linen);
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Dashboard header ────────────────────────────────── */

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid rgba(186,175,163,0.2);
    padding-bottom: 1.2rem;
    margin-bottom: 3rem;
  }

  .dashboard-header h1 {
    font-size: 1.8rem;
    color: var(--linen);
    letter-spacing: 0.04em;
  }

  .sign-out-btn {
    background: none;
    border: none;
    color: var(--stone);
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: color 0.2s;
  }

  .sign-out-btn:hover { color: var(--mist); }

  /* ── Product cards ───────────────────────────────────── */

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1.6rem;
  }

  .card {
    border: 1px solid rgba(186,175,163,0.25);
    padding: 2rem;
    position: relative;
    transition: border-color 0.2s;
  }

  .card:hover { border-color: rgba(186,175,163,0.5); }

  .card-label {
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--stone);
    margin-bottom: 0.6rem;
  }

  .card h2 {
    font-size: 1.6rem;
    color: var(--linen);
    margin-bottom: 1rem;
    letter-spacing: 0.03em;
  }

  .card-status {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    color: var(--stone);
    margin-bottom: 1.4rem;
    min-height: 1.2rem;
  }

  .card-status.ready { color: var(--golden); }

  .card-cta {
    display: inline-block;
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--golden);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
    cursor: pointer;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    font-family: 'Jost', sans-serif;
    font-weight: 300;
    padding: 0;
  }

  .card-cta:hover { border-bottom-color: var(--golden); }

  .card-cta.muted {
    color: var(--stone);
    pointer-events: none;
  }

  /* ── Blueprint page ──────────────────────────────────── */

  .blueprint-wrap {
    max-width: 560px;
    margin: 0 auto;
  }

  .blueprint-wrap h1 {
    font-size: 2rem;
    color: var(--linen);
    margin-bottom: 0.4rem;
  }

  .blueprint-wrap .subtitle {
    color: var(--stone);
    font-size: 0.85rem;
    letter-spacing: 0.06em;
    margin-bottom: 3rem;
  }

  .field-label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--stone);
    margin-bottom: 0.3rem;
  }

  .field-group { margin-bottom: 0.4rem; }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.6rem;
  }

  .countdown {
    font-size: 2.4rem;
    font-family: 'Cormorant Garamond', serif;
    color: var(--linen);
    letter-spacing: 0.06em;
    margin: 2rem 0 0.6rem;
  }

  .countdown-label {
    color: var(--stone);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* ── Error message ───────────────────────────────────── */

  .error-msg {
    color: #c97878;
    font-size: 0.85rem;
    margin-top: 0.8rem;
    min-height: 1.2rem;
  }

  /* ── Back link ───────────────────────────────────────── */

  .back-link {
    display: inline-block;
    color: var(--stone);
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-decoration: none;
    margin-bottom: 3rem;
    transition: color 0.2s;
  }

  .back-link:hover { color: var(--mist); }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add styles.css
  git commit -m "feat: add brand styles (Cato colors + Cormorant/Jost)"
  ```

---

## Task 4: auth.js

**Files:**
- Create: `auth.js`

- [ ] **Step 1: Write auth.js**

  Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with the actual values from the Supabase project.

  ```js
  // auth.js — Supabase client init + auth helpers

  const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

  const { createClient } = supabase;
  window.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getSession() {
    const { data: { session } } = await window.sb.auth.getSession();
    return session;
  }

  async function sendMagicLink(email) {
    const { error } = await window.sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://app.catovermeulen.com'
      }
    });
    return { error };
  }

  async function signOut() {
    await window.sb.auth.signOut();
    window.location.reload();
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add auth.js
  git commit -m "feat: add auth.js with Supabase client + magic link helpers"
  ```

---

## Task 5: db.js

**Files:**
- Create: `db.js`

- [ ] **Step 1: Write db.js**

  ```js
  // db.js — access_grants + profiles data layer
  // Depends on window.sb from auth.js

  /**
   * Fetch Blueprint access grant for current user email.
   * Returns grant row or null.
   */
  async function getBlueprintGrant(email) {
    const { data, error } = await window.sb
      .from('access_grants')
      .select('id, available_at, granted_at')
      .eq('product', 'blueprint')
      .is('revoked_at', null)
      .maybeSingle();
    if (error) { console.error('getBlueprintGrant error:', error); return null; }
    return data;
  }

  /**
   * Fetch profiles row for current user.
   * Returns profile or null.
   */
  async function getProfile() {
    const { data, error } = await window.sb
      .from('profiles')
      .select('id, full_name, dob, tob, city, country, submitted_at')
      .maybeSingle();
    if (error) { console.error('getProfile error:', error); return null; }
    return data;
  }

  /**
   * Submit intake form: upsert profile row + set available_at on access_grants.
   * Returns { error } or {}.
   */
  async function submitIntake(userId, fields) {
    // 1. Upsert profile
    const { error: profileErr } = await window.sb
      .from('profiles')
      .upsert({
        id: userId,
        email: fields.email,
        full_name: fields.full_name,
        dob: fields.dob,
        tob: fields.tob,
        city: fields.city,
        country: fields.country,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (profileErr) return { error: profileErr };

    // 2. Set available_at = now + 24h on access_grants via Edge Function
    // (client cannot write access_grants — RLS only allows SELECT)
    // We call a dedicated Supabase Edge Function for this.
    const { data: { session } } = await window.sb.auth.getSession();
    const res = await fetch(
      `${window.SUPABASE_URL}/functions/v1/set-available-at`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error || 'Failed to set available_at' };
    }

    return {};
  }
  ```

  > `set-available-at` is a small Edge Function (Task 8) that sets `available_at = now() + interval '24 hours'` on the user's blueprint grant using the service role — the client cannot write `access_grants` directly.

- [ ] **Step 2: Commit**

  ```bash
  git add db.js
  git commit -m "feat: add db.js with access_grants + profiles data layer"
  ```

---

## Task 6: index.html (login + dashboard)

**Files:**
- Create: `index.html`
- Create: `dashboard.js`

- [ ] **Step 1: Write dashboard.js**

  ```js
  // dashboard.js — Blueprint card state logic

  /**
   * Determine blueprint card state from grant + profile data.
   *
   * States:
   *   locked   — no grant row
   *   intake   — grant exists, profile not yet submitted
   *   pending  — profile submitted, available_at in the future
   *   ready    — available_at has passed
   */
  function blueprintState(grant, profile) {
    if (!grant) return 'locked';
    if (!profile || !profile.submitted_at) return 'intake';
    if (!grant.available_at) return 'pending'; // intake submitted but available_at not set yet (edge case)
    const available = new Date(grant.available_at);
    if (Date.now() < available.getTime()) return 'pending';
    return 'ready';
  }

  /**
   * Format countdown: "Ready in Xh Ym"
   */
  function formatCountdown(available_at) {
    const msLeft = new Date(available_at).getTime() - Date.now();
    if (msLeft <= 0) return 'Ready now';
    const totalMins = Math.floor(msLeft / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  /**
   * Render the Blueprint card into #blueprint-card.
   */
  function renderBlueprintCard(state, grant) {
    const card = document.getElementById('blueprint-card');

    const configs = {
      locked: {
        status: '',
        ctaText: 'Get your reading',
        ctaHref: 'https://catovermeulen.com/blueprint', // Showit purchase page
        ctaClass: 'card-cta',
        clickable: true,
      },
      intake: {
        status: 'Complete your details to begin',
        ctaText: 'Complete your details →',
        ctaHref: 'blueprint.html',
        ctaClass: 'card-cta',
        clickable: true,
      },
      pending: {
        status: `Ready in ${grant ? formatCountdown(grant.available_at) : '...'}`,
        ctaText: null,
        ctaHref: null,
        ctaClass: 'card-cta muted',
        clickable: false,
      },
      ready: {
        status: 'Your reading is ready',
        ctaText: 'View reading →',
        ctaHref: 'blueprint.html',
        ctaClass: 'card-cta',
        clickable: true,
      },
    };

    const c = configs[state];

    card.innerHTML = `
      <div class="card-label">Blueprint Reading</div>
      <h2>Category of One</h2>
      <div class="card-status ${state === 'ready' ? 'ready' : ''}">${c.status}</div>
      ${c.ctaText
        ? `<a href="${c.ctaHref}" class="${c.ctaClass}">${c.ctaText}</a>`
        : ''}
    `;

    // Live countdown update for pending state
    if (state === 'pending' && grant?.available_at) {
      const statusEl = card.querySelector('.card-status');
      setInterval(() => {
        const newState = blueprintState(grant, { submitted_at: true });
        if (newState === 'ready') {
          statusEl.textContent = 'Your reading is ready';
          statusEl.classList.add('ready');
          const cta = document.createElement('a');
          cta.href = 'blueprint.html';
          cta.className = 'card-cta';
          cta.textContent = 'View reading →';
          card.appendChild(cta);
        } else {
          statusEl.textContent = `Ready in ${formatCountdown(grant.available_at)}`;
        }
      }, 60000); // update every minute
    }
  }
  ```

- [ ] **Step 2: Write index.html**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cato Vermeulen — Client Portal</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="auth.js"></script>
    <script src="db.js"></script>
    <script src="dashboard.js"></script>
  </head>
  <body>

    <!-- ── Login screen ──────────────────────────────────── -->
    <div id="login-screen" class="page-center" style="display:none">
      <div class="login-wrap">
        <h1>Cato Vermeulen</h1>
        <p>Client Portal</p>

        <div id="login-form">
          <input type="email" id="email-input" placeholder="Your email address" autocomplete="email">
          <button class="btn btn-primary" id="send-link-btn" onclick="handleSendLink()">Send access link</button>
          <div class="error-msg" id="login-error"></div>
        </div>

        <div id="login-sent" class="login-sent" style="display:none">
          <p>Check your inbox.</p>
          <p style="margin-top:0.8rem;color:var(--stone);font-size:0.85rem">
            We've sent a login link to your email.<br>Click it to enter your portal.
          </p>
        </div>
      </div>
    </div>

    <!-- ── Dashboard ─────────────────────────────────────── -->
    <div id="dashboard-screen" class="container" style="display:none">
      <div class="dashboard-header">
        <h1>Your Portal</h1>
        <button class="sign-out-btn" onclick="signOut()">Sign out</button>
      </div>

      <div class="cards-grid">
        <!-- Blueprint card — state injected by dashboard.js -->
        <div class="card" id="blueprint-card">
          <div class="card-label">Blueprint Reading</div>
          <h2>Category of One</h2>
          <div class="card-status">Loading...</div>
        </div>

        <!-- Course card — Phase 2 locked -->
        <div class="card">
          <div class="card-label">Course</div>
          <h2>Coming Soon</h2>
          <div class="card-status"></div>
          <a href="https://catovermeulen.com" class="card-cta">Learn more</a>
        </div>

        <!-- Mini Reading card — Phase 3 locked -->
        <div class="card">
          <div class="card-label">Mini Reading</div>
          <h2>Coming Soon</h2>
          <div class="card-status"></div>
          <a href="https://catovermeulen.com" class="card-cta">Learn more</a>
        </div>
      </div>
    </div>

    <script>
      // Make SUPABASE_URL available to db.js for Edge Function calls
      window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';

      async function init() {
        const session = await getSession();
        if (!session) {
          document.getElementById('login-screen').style.display = 'flex';
          return;
        }
        await loadDashboard(session);
      }

      async function loadDashboard(session) {
        document.getElementById('dashboard-screen').style.display = 'block';
        const grant = await getBlueprintGrant(session.user.email);
        const profile = await getProfile();
        const state = blueprintState(grant, profile);
        renderBlueprintCard(state, grant);
      }

      async function handleSendLink() {
        const email = document.getElementById('email-input').value.trim();
        const errEl = document.getElementById('login-error');
        const btn = document.getElementById('send-link-btn');
        errEl.textContent = '';

        if (!email) { errEl.textContent = 'Enter your email address.'; return; }

        btn.disabled = true;
        btn.textContent = 'Sending...';

        const { error } = await sendMagicLink(email);

        if (error) {
          errEl.textContent = error.message || 'Something went wrong. Try again.';
          btn.disabled = false;
          btn.textContent = 'Send access link';
        } else {
          document.getElementById('login-form').style.display = 'none';
          document.getElementById('login-sent').style.display = 'block';
        }
      }

      init();
    </script>
  </body>
  </html>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add index.html dashboard.js
  git commit -m "feat: add login screen and dashboard with blueprint card states"
  ```

---

## Task 7: blueprint.html (intake + pending + ready)

**Files:**
- Create: `blueprint.html`

- [ ] **Step 1: Write blueprint.html**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Blueprint — Cato Vermeulen</title>
    <link rel="stylesheet" href="styles.css">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="auth.js"></script>
    <script src="db.js"></script>
    <script src="dashboard.js"></script>
  </head>
  <body>
    <div class="container">
      <a href="index.html" class="back-link">← Back to portal</a>

      <div class="blueprint-wrap">

        <!-- ── Intake view ───────────────────────────────── -->
        <div id="intake-view" style="display:none">
          <h1>Your Blueprint</h1>
          <p class="subtitle">Enter your birth details so Cato can prepare your reading.</p>

          <form id="intake-form" onsubmit="handleIntakeSubmit(event)">
            <div class="field-group">
              <label class="field-label" for="full-name">Full name</label>
              <input type="text" id="full-name" placeholder="As it appears on your birth certificate" required>
            </div>

            <div class="two-col">
              <div class="field-group">
                <label class="field-label" for="dob">Date of birth</label>
                <input type="date" id="dob" required>
              </div>
              <div class="field-group">
                <label class="field-label" for="tob">Time of birth</label>
                <input type="time" id="tob">
              </div>
            </div>

            <div class="two-col">
              <div class="field-group">
                <label class="field-label" for="city">City of birth</label>
                <input type="text" id="city" placeholder="e.g. Amsterdam" required>
              </div>
              <div class="field-group">
                <label class="field-label" for="country">Country</label>
                <input type="text" id="country" placeholder="e.g. Netherlands" required>
              </div>
            </div>

            <div class="error-msg" id="intake-error"></div>
            <button type="submit" class="btn btn-primary" id="submit-btn" style="margin-top:1rem">
              Submit details
            </button>
          </form>
        </div>

        <!-- ── Pending view ──────────────────────────────── -->
        <div id="pending-view" style="display:none">
          <h1>Your Blueprint</h1>
          <p class="subtitle">Your reading is being prepared.</p>
          <div class="countdown" id="countdown-display">—</div>
          <div class="countdown-label">until your reading is ready</div>
        </div>

        <!-- ── Ready view ────────────────────────────────── -->
        <div id="ready-view" style="display:none">
          <h1>Your Blueprint</h1>
          <p class="subtitle">Your reading is ready.</p>
          <p style="color:var(--stone);line-height:1.8;margin-top:2rem">
            Cato will be in touch shortly with your full Category of One Blueprint.
          </p>
          <!-- Phase 2: PDF download button here -->
        </div>

      </div>
    </div>

    <script>
      window.SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';

      async function init() {
        const session = await getSession();
        if (!session) {
          window.location.href = 'index.html';
          return;
        }

        const grant = await getBlueprintGrant(session.user.email);
        const profile = await getProfile();
        const state = blueprintState(grant, profile);

        if (state === 'locked') {
          window.location.href = 'index.html';
          return;
        }

        if (state === 'intake') {
          document.getElementById('intake-view').style.display = 'block';
          return;
        }

        if (state === 'pending') {
          document.getElementById('pending-view').style.display = 'block';
          startCountdown(grant.available_at);
          return;
        }

        // ready
        document.getElementById('ready-view').style.display = 'block';
      }

      function startCountdown(available_at) {
        function tick() {
          const el = document.getElementById('countdown-display');
          const msLeft = new Date(available_at).getTime() - Date.now();
          if (msLeft <= 0) {
            el.textContent = 'Ready';
            return;
          }
          const h = Math.floor(msLeft / 3600000);
          const m = Math.floor((msLeft % 3600000) / 60000);
          el.textContent = `${h}h ${m}m`;
        }
        tick();
        setInterval(tick, 60000);
      }

      async function handleIntakeSubmit(e) {
        e.preventDefault();
        const btn = document.getElementById('submit-btn');
        const errEl = document.getElementById('intake-error');
        errEl.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Saving...';

        const { data: { session } } = await window.sb.auth.getSession();

        const { error } = await submitIntake(session.user.id, {
          email: session.user.email,
          full_name: document.getElementById('full-name').value.trim(),
          dob: document.getElementById('dob').value,
          tob: document.getElementById('tob').value || null,
          city: document.getElementById('city').value.trim(),
          country: document.getElementById('country').value.trim(),
        });

        if (error) {
          errEl.textContent = typeof error === 'string' ? error : 'Something went wrong. Try again.';
          btn.disabled = false;
          btn.textContent = 'Submit details';
        } else {
          window.location.href = 'index.html';
        }
      }

      init();
    </script>
  </body>
  </html>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add blueprint.html
  git commit -m "feat: add blueprint page with intake, pending, and ready views"
  ```

---

## Task 8: set-available-at Edge Function

**Files:**
- Create: `supabase/functions/set-available-at/index.ts`

This Edge Function is called by the client after intake form submission. It uses the service role to write `available_at` on the user's blueprint grant — the client cannot do this directly because RLS only allows SELECT on `access_grants`.

- [ ] **Step 1: Create function directory**

  ```bash
  mkdir -p supabase/functions/set-available-at
  ```

- [ ] **Step 2: Write index.ts**

  ```typescript
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const supabaseAdmin = () => createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  Deno.serve(async (req) => {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify caller is authenticated
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Get email from JWT
    const supabase = supabaseAdmin();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    }

    const email = user.email!.toLowerCase();

    // Set available_at = NOW() + 24h using Postgres clock (not Edge Function clock)
    // Uses a security-definer SQL function created in the schema setup (Task 1 Step 3)
    const { error } = await supabase.rpc('set_blueprint_available_at', { p_email: email });

    if (error) {
      console.error('set-available-at error:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  ```

- [ ] **Step 3: Deploy**

  ```bash
  supabase functions deploy set-available-at --project-ref YOUR_PROJECT_REF
  ```

  > This function requires JWT — do NOT use `--no-verify-jwt` here. Only `stripe-webhook` needs that flag.

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/functions/set-available-at/
  git commit -m "feat: add set-available-at Edge Function for intake form submission"
  ```

---

## Task 9: stripe-webhook Edge Function

**Files:**
- Create: `supabase/functions/stripe-webhook/index.ts`

- [ ] **Step 1: Create function directory**

  ```bash
  mkdir -p supabase/functions/stripe-webhook
  ```

- [ ] **Step 2: Write index.ts**

  ```typescript
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
  import Stripe from 'https://esm.sh/stripe@14?target=deno';

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseAdmin = () => createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const APP_URL = 'https://app.catovermeulen.com';
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

  async function generateMagicLink(email: string): Promise<string> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: APP_URL }
    });
    if (error) throw error;
    return data.properties.action_link;
  }

  async function sendWelcomeEmail(email: string, magicLink: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cato Vermeulen <noreply@mail.catovermeulen.com>',
        to: email,
        subject: 'Your Blueprint Portal Access',
        html: `
          <p>Hi,</p>
          <p>Your Category of One Blueprint is on its way.</p>
          <p>Click the link below to access your portal and complete your birth details so Cato can begin your reading:</p>
          <p><a href="${magicLink}" style="color:#9F8261">Enter your portal →</a></p>
          <p style="color:#888;font-size:0.85em">This link expires in 24 hours. If you didn't purchase a Blueprint, you can ignore this email.</p>
          <p>— Cato</p>
        `
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Resend error: ${JSON.stringify(body)}`);
    }
  }

  Deno.serve(async (req) => {
    // Always return 200 to Stripe — log errors internally
    const respond = (status = 200) =>
      new Response('OK', { status });

    if (req.method !== 'POST') return respond(405);

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
    } catch (err) {
      console.error('Stripe signature verification failed:', err);
      // Return 400 on bad signature — intentional deviation from spec's "always 200" guidance.
      // Stripe does NOT retry on 4xx (only on 5xx/timeouts). A bad signature means the request
      // is not from Stripe; returning 400 is correct and safe. The "always 200" rule applies
      // to business logic errors (duplicate grants, missing email) — not security failures.
      return respond(400);
    }

    if (event.type !== 'checkout.session.completed') {
      return respond(200);
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const email = (
      session.customer_details?.email ?? session.customer_email ?? ''
    ).toLowerCase();
    const product = (session.metadata?.product ?? 'blueprint') as string;
    const sessionId = session.id;

    if (!email) {
      console.error('No email in Stripe session:', sessionId);
      return respond(200);
    }

    const supabase = supabaseAdmin();

    // Upsert access_grants — UNIQUE on stripe_session_id prevents duplicate grants
    const { error: grantErr } = await supabase.from('access_grants').upsert({
      email,
      product,
      stripe_session_id: sessionId,
      available_at: null,    // set when intake form is submitted
    }, { onConflict: 'stripe_session_id' });

    if (grantErr) {
      console.error('access_grants upsert error:', grantErr);
      // Return 200 anyway — we don't want Stripe to retry
      return respond(200);
    }

    console.log('Access granted:', email, product, sessionId);

    // Generate magic link + send welcome email
    try {
      const magicLink = await generateMagicLink(email);
      await sendWelcomeEmail(email, magicLink);
      console.log('Welcome email sent to:', email);
    } catch (err) {
      console.error('Magic link / email error:', err);
      // Not fatal — grant already written, client can still log in
    }

    return respond(200);
  });
  ```

- [ ] **Step 3: Set environment variables**

  ```bash
  supabase secrets set \
    STRIPE_SECRET_KEY=sk_live_... \
    STRIPE_WEBHOOK_SECRET=whsec_... \
    RESEND_API_KEY=re_... \
    --project-ref YOUR_PROJECT_REF
  ```

  > Use `sk_test_` and `whsec_` from Stripe test mode while testing.

- [ ] **Step 4: Deploy with --no-verify-jwt**

  ```bash
  supabase functions deploy stripe-webhook --no-verify-jwt --project-ref YOUR_PROJECT_REF
  ```

  > `--no-verify-jwt` is required — Stripe requests carry no Supabase JWT.

- [ ] **Step 5: Register webhook in Stripe**

  Stripe dashboard → Developers → Webhooks → Add endpoint:
  - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
  - Events: `checkout.session.completed` only
  - Copy the signing secret → use as `STRIPE_WEBHOOK_SECRET`

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/functions/stripe-webhook/
  git commit -m "feat: add stripe-webhook Edge Function with access grant + Resend email"
  ```

---

## Task 10: Stripe product + Checkout setup

No code. Config steps.

- [ ] **Step 1: Create Blueprint product in Stripe**

  Stripe dashboard → Products → Add product. Name: "Category of One Blueprint". Set price.

- [ ] **Step 2: Create Checkout link with metadata**

  Stripe dashboard → Payment links → Create. Select Blueprint product.

  Important: Checkout sessions created via Payment Links don't support metadata by default. Use the Stripe API or a thin server to create sessions with `metadata: { product: 'blueprint' }`. The simplest Phase 1 approach is to hardcode `product: 'blueprint'` in the Edge Function (since there's only one product) — no metadata needed.

  > Update `stripe-webhook/index.ts` line: `const product = 'blueprint';` — remove the metadata lookup.

- [ ] **Step 3: Verify test purchase flow**

  Use Stripe test mode. Complete a test checkout → check:
  1. Supabase `access_grants` row inserted
  2. Welcome email received with magic link
  3. Magic link → portal → Blueprint card shows `intake` state

---

## Task 11: DNS + GitHub Pages verification

- [ ] **Step 1: Verify CNAME in Hover**

  DNS → add `app CNAME <github-username>.github.io`

  Wait for propagation. Verify: `dig app.catovermeulen.com CNAME`

- [ ] **Step 2: Enable HTTPS in GitHub Pages**

  Repo → Settings → Pages → Custom domain: `app.catovermeulen.com` → Enforce HTTPS.

- [ ] **Step 3: Verify Resend domain**

  Resend dashboard → Domains → Add `mail.catovermeulen.com`.
  Copy DKIM + SPF + DMARC records → add to Hover DNS.
  Wait for verification (green checkmarks).

- [ ] **Step 4: Full end-to-end smoke test**

  1. Open `https://app.catovermeulen.com` — login screen appears
  2. Enter email → magic link email arrives
  3. Click link → dashboard loads
  4. Manually insert `access_grants` row in Supabase for this email with `product = 'blueprint'`, `available_at = null`
  5. Refresh → Blueprint card shows `intake` state
  6. Click → `blueprint.html` → fill form → submit
  7. Dashboard → Blueprint card shows `pending` with countdown
  8. Manually set `available_at` to 1 minute in the past in Supabase
  9. Refresh → card shows `ready`

---

## Common failure points (from Intuitie experience)

| Failure | Fix |
|---|---|
| Magic links redirect to localhost | Set Supabase Site URL to `https://app.catovermeulen.com` |
| Stripe webhook 401 | Deploy with `--no-verify-jwt` |
| Resend 403 | Use `mail.catovermeulen.com` subdomain, NOT root domain |
| RLS blocks grant read | Policy uses `auth.jwt() ->> 'email'`, not `auth.email()` |
| Email case mismatch | Always `toLowerCase()` before insert |
| Stripe retries | Always return 200, use `upsert` with `onConflict: 'stripe_session_id'` |
| `available_at` checked client-side | Clock drift causes issues — Edge Function uses server time |
