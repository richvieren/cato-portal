# Cosmic Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a $9 cosmic profile product to Cato's portal that shows interactive natal chart widgets, replaces the current dashboard with a profile-first layout, and creates upsell paths to paid readings.

**Architecture:** Vanilla JS + D3.js frontend on GitHub Pages. New Supabase edge function calls the astrology API on intake submit, stores parsed chart data in a new `natal_charts` table. Profile page reads stored data and renders ~20 widget components. No LLM. No new infra.

**Tech Stack:** Vanilla JS, D3.js (v7, CDN), Supabase (Postgres + Edge Functions + Auth), astrology-api.io, Stripe, GitHub Pages

## Global Constraints

- No frameworks. Vanilla JS only. D3.js is the only new library.
- All existing reading pages (blueprint.html, transit-reading.html, etc.) must continue working unchanged.
- Auth flow (magic links via Supabase OTP) unchanged.
- Design tokens from styles.css: `--smoke`, `--mist`, `--golden`, `--linen`, `--stone`, `--smoke-card`, `--border`, `--golden-glow`.
- Fonts: Cormorant Garamond (display), Jost (body).
- Supabase project: `fdewbbrzetgqqsonpqvp`.
- Astrology API: `https://api.astrology-api.io/api/v3/charts/natal` with Whole Sign houses + Placidus angles.
- Portal lives at: `~/AOOA/clients/Cato/portal/`, deployed to `app.catovermeulen.com` via GitHub Pages.
- NEVER touch VPS pipeline code. NEVER modify existing edge functions beyond adding the new price ID mapping.
- Mobile-first responsive. 1-col mobile, 2-col desktop for widget grid.

---

## File Map

### New files

| File | Responsibility |
|---|---|
| `chart-engine.js` | Fetches `natal_charts` data from Supabase, computes derived data (elements, modalities, hemispheres, stelliums), exports a `ChartData` object that all widgets consume |
| `chart-wheel.js` | D3.js natal chart wheel renderer (SVG). Planets, signs, houses, aspects on hover |
| `widgets.js` | All widget components: Big 3, element balance, modality, hemisphere, stelliums, planet cards, business lens, aspect web, cosmic DNA, retrogrades |
| `profile.js` | Profile page orchestrator: checks grants, loads chart data, renders sections, handles upsell cards |
| `profile-intake.html` | Birth data intake form for cosmic profile buyers (reuses existing form patterns from blueprint.html) |
| `supabase/functions/compute-chart/index.ts` | Edge function: receives birth data, calls astrology API, parses response, stores in `natal_charts` |
| `supabase/migrations/001_natal_charts.sql` | Creates `natal_charts` table + RLS policies |

### Modified files

| File | What changes |
|---|---|
| `index.html` | Complete rewrite — profile page replaces product card dashboard |
| `styles.css` | Add widget grid, chart wheel, card system, locked/teaser states, responsive rules |
| `db.js` | Add `getCosmicProfileGrant()`, `getNatalChart()`, `submitCosmicProfileIntake()` |
| `dashboard.js` | Keep existing render functions (still used by reading pages). Add `cosmicProfileState()` |
| `supabase/functions/stripe-webhook/index.ts` | Add cosmic_profile price ID to `PRICE_TO_PRODUCT` + email template |

### Unchanged files

| File | Why |
|---|---|
| `auth.js` | Auth flow doesn't change |
| `autocomplete.js` | Reused as-is for city field |
| `blueprint.html`, `transit-reading.html`, `astrocartography.html`, `mini-reading.html`, `course.html` | Reading pages stay as-is |

---

### Task 1: Database — natal_charts table + RLS

**Files:**
- Create: `supabase/migrations/001_natal_charts.sql`

**Interfaces:**
- Consumes: nothing
- Produces: `natal_charts` table with columns: `id` (uuid PK), `user_id` (uuid FK), `email` (text), `planets` (jsonb), `houses` (jsonb), `aspects` (jsonb), `elements` (jsonb), `modalities` (jsonb), `hemispheres` (jsonb), `stelliums` (jsonb), `chart_ruler` (jsonb), `computed_at` (timestamptz)

- [ ] **Step 1: Write the migration SQL**

```sql
-- 001_natal_charts.sql
-- Run this in Supabase SQL Editor

create table if not exists public.natal_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  planets jsonb not null default '[]'::jsonb,
  houses jsonb not null default '[]'::jsonb,
  aspects jsonb not null default '[]'::jsonb,
  elements jsonb not null default '{}'::jsonb,
  modalities jsonb not null default '{}'::jsonb,
  hemispheres jsonb not null default '{}'::jsonb,
  stelliums jsonb not null default '[]'::jsonb,
  chart_ruler jsonb,
  computed_at timestamptz not null default now(),
  unique(user_id)
);

-- RLS: users can read their own chart
alter table public.natal_charts enable row level security;

create policy "Users can read own chart"
  on public.natal_charts for select
  using (auth.uid() = user_id);

-- Service role can insert/update (edge function uses service role key)
create policy "Service role can insert charts"
  on public.natal_charts for insert
  with check (true);

create policy "Service role can update charts"
  on public.natal_charts for update
  using (true);

-- Index for lookup by user_id
create index if not exists idx_natal_charts_user_id on public.natal_charts(user_id);
```

- [ ] **Step 2: Run the migration in Supabase SQL Editor**

Go to the Supabase dashboard → SQL Editor → paste and run. Verify the table exists in Table Editor.

- [ ] **Step 3: Verify RLS**

In SQL Editor, run:
```sql
select * from public.natal_charts limit 1;
```
Should return empty results (no rows yet). Confirm the table exists and has all columns.

---

### Task 2: Edge function — compute-chart

**Files:**
- Create: `supabase/functions/compute-chart/index.ts`

**Interfaces:**
- Consumes: `natal_charts` table (Task 1), astrology API (`charts/natal` endpoint)
- Produces: `computeChart(user_id, email, birth_data)` → inserts parsed chart into `natal_charts`

The edge function receives birth data from the frontend, geocodes the city, calls the astrology API twice (Whole Sign + Placidus for real angles), parses the response into structured JSONB columns, and computes derived data (element balance, modalities, hemispheres, stelliums, chart ruler).

- [ ] **Step 1: Create the edge function directory**

```bash
mkdir -p ~/AOOA/clients/Cato/portal/supabase/functions/compute-chart
```

- [ ] **Step 2: Write the edge function**

```typescript
// supabase/functions/compute-chart/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const supabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ASTROLOGY_API_BASE = 'https://api.astrology-api.io/api/v3';
const ASTROLOGY_API_KEY = Deno.env.get('ASTROLOGY_API_KEY')!;

// Sign metadata for element/modality classification
const SIGN_META: Record<string, { element: string; modality: string }> = {
  Aries:       { element: 'fire',  modality: 'cardinal' },
  Taurus:      { element: 'earth', modality: 'fixed' },
  Gemini:      { element: 'air',   modality: 'mutable' },
  Cancer:      { element: 'water', modality: 'cardinal' },
  Leo:         { element: 'fire',  modality: 'fixed' },
  Virgo:       { element: 'earth', modality: 'mutable' },
  Libra:       { element: 'air',   modality: 'cardinal' },
  Scorpio:     { element: 'water', modality: 'fixed' },
  Sagittarius: { element: 'fire',  modality: 'mutable' },
  Capricorn:   { element: 'earth', modality: 'cardinal' },
  Aquarius:    { element: 'air',   modality: 'fixed' },
  Pisces:      { element: 'water', modality: 'mutable' },
};

// Traditional sign rulers for chart ruler calculation
const SIGN_RULERS: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

// Major planets only (exclude angles, nodes for element/modality counts)
const MAJOR_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

interface BirthData {
  full_name: string;
  dob: string;      // YYYY-MM-DD
  tob: string;      // HH:MM
  city: string;
  country: string;
}

async function geocode(city: string, country: string): Promise<{ lat: number; lon: number; tzone: number }> {
  const queries = [`${city}, ${country}`, city];
  for (const query of queries) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'cato-cosmic-profile/1.0' } }
    );
    const results = await res.json();
    if (results.length > 0) {
      const lat = parseFloat(results[0].lat);
      const lon = parseFloat(results[0].lon);
      // Get timezone offset
      const tzRes = await fetch(
        `https://timeapi.io/api/timezone/coordinate?latitude=${lat}&longitude=${lon}`
      );
      const tzData = await tzRes.json();
      const tzone = (tzData.currentUtcOffset?.seconds ?? 0) / 3600;
      return { lat, lon, tzone };
    }
  }
  throw new Error(`Could not geocode: ${city}, ${country}`);
}

async function fetchNatalChart(birthData: BirthData) {
  const [year, month, day] = birthData.dob.split('-').map(Number);
  const [hour, minute] = birthData.tob.split(':').map(Number);
  const { lat, lon, tzone } = await geocode(birthData.city, birthData.country);

  const payload = {
    subject: {
      name: birthData.full_name,
      birth_data: { year, month, day, hour, minute, second: 0, latitude: lat, longitude: lon, timezone_offset: tzone },
    },
    options: { house_system: 'W' },
  };

  const headers = {
    'Authorization': `Bearer ${ASTROLOGY_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Whole Sign chart
  const wsRes = await fetch(`${ASTROLOGY_API_BASE}/charts/natal`, {
    method: 'POST', headers, body: JSON.stringify(payload),
  });
  if (!wsRes.ok) throw new Error(`Astrology API error: ${wsRes.status}`);
  const wsChart = await wsRes.json();

  // Placidus chart for real ASC/MC degrees
  const pPayload = { ...payload, options: { house_system: 'P' } };
  const pRes = await fetch(`${ASTROLOGY_API_BASE}/charts/natal`, {
    method: 'POST', headers, body: JSON.stringify(pPayload),
  });
  if (pRes.ok) {
    const pChart = await pRes.json();
    const realAngles: Record<string, any> = {};
    for (const p of pChart.chart_data.planetary_positions) {
      if (p.name === 'Ascendant' || p.name === 'Medium_Coeli') {
        realAngles[p.name] = p;
      }
    }
    for (let i = 0; i < wsChart.chart_data.planetary_positions.length; i++) {
      const name = wsChart.chart_data.planetary_positions[i].name;
      if (realAngles[name]) {
        wsChart.chart_data.planetary_positions[i] = realAngles[name];
      }
    }
  }

  return wsChart;
}

function parseChart(rawChart: any) {
  const positions = rawChart.chart_data.planetary_positions;
  const rawHouses = rawChart.chart_data.houses;
  const rawAspects = rawChart.chart_data.aspects || [];

  // Parse planets
  const planets = positions.map((p: any) => ({
    name: p.name,
    sign: p.sign,
    degree: p.degree,
    house: p.house,
    retrograde: p.retrograde || false,
    full_degree: p.full_degree,
  }));

  // Parse houses
  const houses = rawHouses.map((h: any) => ({
    number: h.number,
    sign: h.sign,
    degree: h.degree,
  }));

  // Parse aspects (only major: conjunction, opposition, trine, square, sextile)
  const majorAspectTypes = ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
  const aspects = rawAspects
    .filter((a: any) => majorAspectTypes.includes(a.type))
    .map((a: any) => ({
      planet1: a.first_planet,
      planet2: a.second_planet,
      type: a.type,
      orb: a.orb,
    }));

  // Compute elements
  const elements: Record<string, { count: number; planets: string[] }> = {
    fire: { count: 0, planets: [] },
    earth: { count: 0, planets: [] },
    air: { count: 0, planets: [] },
    water: { count: 0, planets: [] },
  };

  // Compute modalities
  const modalities: Record<string, { count: number; planets: string[] }> = {
    cardinal: { count: 0, planets: [] },
    fixed: { count: 0, planets: [] },
    mutable: { count: 0, planets: [] },
  };

  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    const meta = SIGN_META[p.sign];
    if (!meta) continue;
    elements[meta.element].count++;
    elements[meta.element].planets.push(p.name);
    modalities[meta.modality].count++;
    modalities[meta.modality].planets.push(p.name);
  }

  // Compute hemispheres (based on house position)
  // Houses 1-6 = southern/below horizon (private), 7-12 = northern/above horizon (public)
  // Houses 1-3, 10-12 = eastern/left (self), 4-9 = western/right (others)
  const hemispheres = {
    above: { count: 0, planets: [] as string[] },  // houses 7-12
    below: { count: 0, planets: [] as string[] },  // houses 1-6
    east: { count: 0, planets: [] as string[] },    // houses 10-12, 1-3
    west: { count: 0, planets: [] as string[] },    // houses 4-9
  };

  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    const h = p.house;
    if (h >= 7 && h <= 12) { hemispheres.above.count++; hemispheres.above.planets.push(p.name); }
    else { hemispheres.below.count++; hemispheres.below.planets.push(p.name); }
    if (h >= 10 || h <= 3) { hemispheres.east.count++; hemispheres.east.planets.push(p.name); }
    else { hemispheres.west.count++; hemispheres.west.planets.push(p.name); }
  }

  // Detect stelliums (3+ major planets in same sign or same house)
  const stelliums: Array<{ type: 'sign' | 'house'; key: string; planets: string[] }> = [];
  const bySign: Record<string, string[]> = {};
  const byHouse: Record<number, string[]> = {};
  for (const p of planets) {
    if (!MAJOR_PLANETS.includes(p.name)) continue;
    if (!bySign[p.sign]) bySign[p.sign] = [];
    bySign[p.sign].push(p.name);
    if (!byHouse[p.house]) byHouse[p.house] = [];
    byHouse[p.house].push(p.name);
  }
  for (const [sign, pls] of Object.entries(bySign)) {
    if (pls.length >= 3) stelliums.push({ type: 'sign', key: sign, planets: pls });
  }
  for (const [house, pls] of Object.entries(byHouse)) {
    if (pls.length >= 3) stelliums.push({ type: 'house', key: `House ${house}`, planets: pls });
  }

  // Chart ruler: planet that rules the Ascendant sign
  const asc = planets.find((p: any) => p.name === 'Ascendant');
  let chartRuler = null;
  if (asc) {
    const rulerName = SIGN_RULERS[asc.sign];
    const rulerPlanet = planets.find((p: any) => p.name === rulerName);
    if (rulerPlanet) {
      chartRuler = {
        planet: rulerName,
        sign: rulerPlanet.sign,
        house: rulerPlanet.house,
        ascendant_sign: asc.sign,
      };
    }
  }

  return { planets, houses, aspects, elements, modalities, hemispheres, stelliums, chartRuler };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const supabase = supabaseAdmin();
  const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  let body: BirthData;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const rawChart = await fetchNatalChart(body);
    const parsed = parseChart(rawChart);

    const { error: dbErr } = await supabase.from('natal_charts').upsert({
      user_id: user.id,
      email: user.email!.toLowerCase(),
      planets: parsed.planets,
      houses: parsed.houses,
      aspects: parsed.aspects,
      elements: parsed.elements,
      modalities: parsed.modalities,
      hemispheres: parsed.hemispheres,
      stelliums: parsed.stelliums,
      chart_ruler: parsed.chartRuler,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (dbErr) throw dbErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err) {
    console.error('compute-chart error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
});
```

- [ ] **Step 3: Add ASTROLOGY_API_KEY to Supabase Edge Function secrets**

In Supabase dashboard → Edge Functions → Secrets, add:
- `ASTROLOGY_API_KEY` — the key from `~/astrocartography-app/.env.local`

- [ ] **Step 4: Deploy the edge function**

```bash
cd ~/AOOA/clients/Cato/portal
supabase functions deploy compute-chart --project-ref fdewbbrzetgqqsonpqvp
```

- [ ] **Step 5: Test with curl**

Get a valid JWT from the portal (log in, grab from browser dev tools Network tab), then:

```bash
curl -X POST 'https://fdewbbrzetgqqsonpqvp.supabase.co/functions/v1/compute-chart' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_HERE' \
  -d '{"full_name":"Test User","dob":"1990-06-15","tob":"14:30","city":"Cape Town","country":"South Africa"}'
```

Expected: `{"ok":true}`. Check `natal_charts` table in Supabase — should have one row with populated JSONB columns.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/compute-chart/index.ts supabase/migrations/001_natal_charts.sql
git commit -m "feat: add compute-chart edge function + natal_charts table"
```

---

### Task 3: Stripe webhook — add cosmic_profile product

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts` (lines 214-219 for PRICE_TO_PRODUCT, lines 32-152 for EMAIL_TEMPLATES)

**Interfaces:**
- Consumes: Stripe checkout.session.completed event
- Produces: `access_grants` row with `product: 'cosmic_profile'`, welcome email sent

- [ ] **Step 1: Create the $9 product in Stripe**

Go to Stripe Dashboard → Products → Create product:
- Name: "Cosmic Profile"
- Price: $9 (or $29 — Cato decides) one-time
- Copy the `price_` ID

- [ ] **Step 2: Add price ID to webhook**

In `supabase/functions/stripe-webhook/index.ts`, add to the `PRICE_TO_PRODUCT` map (after line 219):

```typescript
    'price_XXXXXXXXXXXXXXXXXXXXXXXXX': 'cosmic_profile',  // Replace with actual Stripe price ID
```

- [ ] **Step 3: Add email template**

In the `EMAIL_TEMPLATES` object, add after the `course` template (after line 151):

```typescript
  cosmic_profile: (link) => ({
    subject: 'Your Cosmic Profile Access',
    html: `
      <p>Your payment went through 🔥</p>
      <p>Here's how to access your cosmic profile.</p>

      <p><strong>Step 1: Log into your portal</strong><br>
      Click the button below. It's a secure login link tied to your email. One click and you're in, no password needed.</p>
      <p style="margin:24px 0"><a href="${link}" style="background:#9F8261;color:#ffffff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:500;display:inline-block">Enter your portal</a></p>
      ${FALLBACK_LINE}

      <p><strong>Step 2: Fill in your birth details</strong><br>
      Once you're logged in, you'll see a form asking for your date, time, and place of birth. Fill it in accurately. That's all you need.</p>

      <p><strong>Step 3: Explore your profile</strong><br>
      Your natal chart, planet placements, element balance, business lens, and more. It's all there, instantly.</p>

      <p>See you on the other side ✨</p>
      <p>Cato</p>
      ${SUPPORT_LINE}
    `,
  }),
```

- [ ] **Step 4: Handle available_at for cosmic_profile**

In the webhook, around line 245, the `available_at` logic currently sets it immediately only for `course`. Add `cosmic_profile`:

```typescript
  const available_at = (product === 'course' || product === 'cosmic_profile') ? new Date().toISOString() : null;
```

- [ ] **Step 5: Deploy updated webhook**

```bash
cd ~/AOOA/clients/Cato/portal
supabase functions deploy stripe-webhook --project-ref fdewbbrzetgqqsonpqvp
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat: add cosmic_profile to Stripe webhook + email template"
```

---

### Task 4: Data layer — db.js additions

**Files:**
- Modify: `db.js` (add new functions at end of file)
- Modify: `dashboard.js` (add cosmicProfileState)

**Interfaces:**
- Consumes: `access_grants` table, `natal_charts` table, `compute-chart` edge function
- Produces: `getCosmicProfileGrant()` → grant row or null, `getNatalChart()` → chart data or null, `submitCosmicProfileIntake(userId, fields)` → triggers compute-chart

- [ ] **Step 1: Add getCosmicProfileGrant to db.js**

Append to `db.js`:

```javascript
/**
 * Fetch Cosmic Profile access grant for current user.
 * Returns grant row or null.
 */
async function getCosmicProfileGrant() {
  const email = await _getUserEmail();
  if (!email) return null;
  const { data, error } = await window.sb
    .from('access_grants')
    .select('id, available_at, granted_at')
    .eq('product', 'cosmic_profile')
    .eq('email', email)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (error) { console.error('getCosmicProfileGrant error:', error); return null; }
  return data;
}
```

- [ ] **Step 2: Add getNatalChart to db.js**

```javascript
/**
 * Fetch natal chart data for current user.
 * Returns chart row or null.
 */
async function getNatalChart() {
  const { data, error } = await window.sb
    .from('natal_charts')
    .select('planets, houses, aspects, elements, modalities, hemispheres, stelliums, chart_ruler, computed_at')
    .maybeSingle();
  if (error) { console.error('getNatalChart error:', error); return null; }
  return data;
}
```

- [ ] **Step 3: Add submitCosmicProfileIntake to db.js**

```javascript
/**
 * Submit cosmic profile intake: upsert profile (birth data) + call compute-chart edge function.
 * Returns { error } or {}.
 */
async function submitCosmicProfileIntake(userId, fields) {
  // 1. Upsert profile (birth data only)
  const { error: profileErr } = await window.sb
    .from('profiles')
    .upsert({
      id: userId,
      email: fields.email,
      full_name: fields.full_name,
      dob: fields.dob,
      tob: fields.tob || null,
      city: fields.city,
      country: fields.country,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  if (profileErr) return { error: profileErr };

  // 2. Compute chart via edge function
  const { data: { session } } = await window.sb.auth.getSession();
  const res = await fetch(
    `${window.SUPABASE_URL}/functions/v1/compute-chart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(fields),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'Failed to compute chart' };
  }

  return {};
}
```

- [ ] **Step 4: Add cosmicProfileState to dashboard.js**

Append to `dashboard.js`:

```javascript
/**
 * Determine cosmic profile state.
 * locked  — no grant
 * intake  — grant exists, no chart computed yet
 * ready   — chart computed
 */
function cosmicProfileState(grant, chart) {
  if (!grant) return 'locked';
  if (!chart) return 'intake';
  return 'ready';
}
```

- [ ] **Step 5: Commit**

```bash
git add db.js dashboard.js
git commit -m "feat: add cosmic profile data layer (grant, chart, intake)"
```

---

### Task 5: Chart engine — derived data helper

**Files:**
- Create: `chart-engine.js`

**Interfaces:**
- Consumes: `getNatalChart()` from db.js → raw chart row
- Produces: `ChartData` object with helper methods: `getBig3()`, `getElements()`, `getModalities()`, `getHemispheres()`, `getStelliums()`, `getChartRuler()`, `getPlanetCards()`, `getBusinessLens()`, `getRetrogrades()`, `getAspects()`

- [ ] **Step 1: Write chart-engine.js**

```javascript
// chart-engine.js — Parse stored natal_charts data into widget-ready objects.
// All computation was done server-side by compute-chart. This is just accessors + formatting.

const SIGN_GLYPHS = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  Ascendant: 'AC', Medium_Coeli: 'MC', North_Node: '☊',
};

const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North_Node'];

const ELEMENT_COLORS = {
  fire: '#C4654A',
  earth: '#8B7D5E',
  air: '#A3B5C4',
  water: '#5B7B7A',
};

const ASPECT_COLORS = {
  Conjunction: '#BA916B',
  Trine: '#5B7B7A',
  Sextile: '#A3B5C4',
  Square: '#C4654A',
  Opposition: '#8B4A4A',
};

/**
 * Create a ChartData instance from a natal_charts row.
 * @param {object} chartRow — row from getNatalChart()
 */
function ChartData(chartRow) {
  this._raw = chartRow;
  this.planets = chartRow.planets;
  this.houses = chartRow.houses;
  this.aspects = chartRow.aspects;
  this.elements = chartRow.elements;
  this.modalities = chartRow.modalities;
  this.hemispheres = chartRow.hemispheres;
  this.stelliums = chartRow.stelliums;
  this.chartRuler = chartRow.chart_ruler;
}

/** Sun, Moon, Ascendant */
ChartData.prototype.getBig3 = function () {
  const find = (name) => this.planets.find(p => p.name === name);
  return {
    sun: find('Sun'),
    moon: find('Moon'),
    rising: find('Ascendant'),
  };
};

/** Element counts + planet lists */
ChartData.prototype.getElements = function () {
  return this.elements;
};

/** Modality counts + planet lists */
ChartData.prototype.getModalities = function () {
  return this.modalities;
};

/** Hemisphere balance */
ChartData.prototype.getHemispheres = function () {
  return this.hemispheres;
};

/** Stelliums (may be empty array) */
ChartData.prototype.getStelliums = function () {
  return this.stelliums;
};

/** Chart ruler info */
ChartData.prototype.getChartRuler = function () {
  return this.chartRuler;
};

/** Major planets as ordered cards (excludes angles) */
ChartData.prototype.getPlanetCards = function () {
  return PLANET_ORDER
    .map(name => this.planets.find(p => p.name === name))
    .filter(Boolean);
};

/** Business lens: money houses, visibility, communication, leadership */
ChartData.prototype.getBusinessLens = function () {
  const findPlanetsInHouse = (h) => this.planets.filter(p => p.house === h && PLANET_ORDER.includes(p.name));
  const findHouse = (n) => this.houses.find(h => h.number === n);

  return {
    money: {
      second: { house: findHouse(2), planets: findPlanetsInHouse(2) },
      eighth: { house: findHouse(8), planets: findPlanetsInHouse(8) },
    },
    visibility: {
      mc: this.planets.find(p => p.name === 'Medium_Coeli'),
      tenthHouse: { house: findHouse(10), planets: findPlanetsInHouse(10) },
    },
    communication: {
      mercury: this.planets.find(p => p.name === 'Mercury'),
    },
    leadership: {
      sun: this.planets.find(p => p.name === 'Sun'),
      mars: this.planets.find(p => p.name === 'Mars'),
    },
  };
};

/** Retrograde natal planets */
ChartData.prototype.getRetrogrades = function () {
  return this.planets.filter(p => p.retrograde && PLANET_ORDER.includes(p.name));
};

/** Aspects for the aspect web */
ChartData.prototype.getAspects = function () {
  return this.aspects;
};
```

- [ ] **Step 2: Commit**

```bash
git add chart-engine.js
git commit -m "feat: add chart-engine.js — widget data accessors"
```

---

### Task 6: Chart wheel — D3.js natal chart SVG

**Files:**
- Create: `chart-wheel.js`

**Interfaces:**
- Consumes: `ChartData` object (from chart-engine.js) — specifically `planets` (with `full_degree`, `sign`, `name`, `retrograde`) and `houses` (with `number`, `sign`)
- Produces: `renderChartWheel(containerId, chartData)` → renders interactive SVG into a DOM element

This is the visual centerpiece. A circular natal chart with:
- Outer ring: 12 zodiac signs (30 degrees each, colored by element)
- Inner ring: 12 house divisions
- Planets plotted at their degree position
- Hover a planet to highlight its aspects (lines across the wheel)

- [ ] **Step 1: Write chart-wheel.js**

```javascript
// chart-wheel.js — D3.js natal chart wheel renderer
// Depends on D3.js v7 (loaded via CDN) and chart-engine.js constants

/**
 * Render an interactive natal chart wheel as SVG.
 * @param {string} containerId — DOM element ID to render into
 * @param {ChartData} chartData — from chart-engine.js
 */
function renderChartWheel(containerId, chartData) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const size = Math.min(container.clientWidth, 560);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 10;
  const signR = outerR - 36;
  const houseR = signR - 24;
  const planetR = houseR - 40;
  const innerR = planetR - 30;

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('width', '100%')
    .style('max-width', `${size}px`);

  // Zodiac sign order starting from Aries
  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

  // Find ASC degree to rotate the wheel (ASC = left horizon = 180 degrees in SVG)
  const asc = chartData.planets.find(p => p.name === 'Ascendant');
  const ascDeg = asc ? asc.full_degree : 0;
  // Rotation: ASC should be at 9 o'clock (180deg SVG). Chart degrees go counter-clockwise.
  const rotation = 180 - ascDeg;

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  // --- Outer ring: zodiac signs ---
  const signArc = d3.arc()
    .innerRadius(signR)
    .outerRadius(outerR);

  SIGNS.forEach((sign, i) => {
    const startAngle = (i * 30 + rotation) * Math.PI / 180;
    const endAngle = ((i + 1) * 30 + rotation) * Math.PI / 180;
    const meta = SIGN_META_SIMPLE[sign];

    g.append('path')
      .attr('d', signArc({ startAngle, endAngle }))
      .attr('fill', meta ? meta.color + '15' : 'rgba(255,255,255,0.03)')
      .attr('stroke', 'rgba(216,207,185,0.12)')
      .attr('stroke-width', 0.5);

    // Sign glyph
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = (signR + outerR) / 2;
    g.append('text')
      .attr('x', Math.cos(midAngle - Math.PI / 2) * labelR)
      .attr('y', Math.sin(midAngle - Math.PI / 2) * labelR)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'var(--stone)')
      .attr('font-size', '13px')
      .text(SIGN_GLYPHS[sign] || '');
  });

  // --- House lines ---
  for (let i = 1; i <= 12; i++) {
    const house = chartData.houses.find(h => h.number === i);
    if (!house) continue;
    // In Whole Sign, house cusps align with sign boundaries, but we draw them anyway
    const deg = (i - 1) * 30 + rotation;
    const rad = deg * Math.PI / 180;
    const x1 = Math.cos(rad - Math.PI / 2) * innerR;
    const y1 = Math.sin(rad - Math.PI / 2) * innerR;
    const x2 = Math.cos(rad - Math.PI / 2) * signR;
    const y2 = Math.sin(rad - Math.PI / 2) * signR;

    g.append('line')
      .attr('x1', x1).attr('y1', y1)
      .attr('x2', x2).attr('y2', y2)
      .attr('stroke', i === 1 || i === 4 || i === 7 || i === 10
        ? 'rgba(216,207,185,0.25)' : 'rgba(216,207,185,0.08)')
      .attr('stroke-width', i === 1 || i === 10 ? 1.5 : 0.5);

    // House number
    const numDeg = deg + 15;
    const numRad = numDeg * Math.PI / 180;
    const numR = (innerR + houseR) / 2;
    g.append('text')
      .attr('x', Math.cos(numRad - Math.PI / 2) * numR)
      .attr('y', Math.sin(numRad - Math.PI / 2) * numR)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', 'rgba(180,167,148,0.3)')
      .attr('font-size', '10px')
      .attr('font-family', 'Jost, sans-serif')
      .text(i);
  }

  // --- Inner circle ---
  g.append('circle')
    .attr('r', innerR)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(216,207,185,0.1)')
    .attr('stroke-width', 0.5);

  // --- Planets ---
  const majorPlanets = chartData.planets.filter(p =>
    PLANET_ORDER.includes(p.name) || p.name === 'Ascendant' || p.name === 'Medium_Coeli'
  );

  // Aspect lines group (rendered behind planets)
  const aspectGroup = g.append('g').attr('class', 'aspects').style('opacity', 0);

  const planetDots = [];

  majorPlanets.forEach(planet => {
    const deg = planet.full_degree + rotation;
    const rad = deg * Math.PI / 180;
    const x = Math.cos(rad - Math.PI / 2) * planetR;
    const y = Math.sin(rad - Math.PI / 2) * planetR;

    const isAngle = planet.name === 'Ascendant' || planet.name === 'Medium_Coeli';

    // Planet dot
    const dot = g.append('g')
      .attr('transform', `translate(${x},${y})`)
      .attr('class', 'planet-dot')
      .style('cursor', 'pointer');

    dot.append('circle')
      .attr('r', isAngle ? 4 : 6)
      .attr('fill', isAngle ? 'var(--golden)' : 'var(--mist)')
      .attr('stroke', 'var(--smoke)')
      .attr('stroke-width', 2);

    dot.append('text')
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', planet.retrograde ? '#C4654A' : 'var(--mist)')
      .attr('font-size', '11px')
      .text((PLANET_GLYPHS[planet.name] || planet.name.slice(0, 2)) + (planet.retrograde ? '℞' : ''));

    planetDots.push({ planet, x, y, deg, dot });

    // Hover: show aspects for this planet
    dot.on('mouseenter', () => {
      aspectGroup.style('opacity', 1);
      aspectGroup.selectAll('*').remove();
      const relatedAspects = chartData.aspects.filter(a =>
        a.planet1 === planet.name || a.planet2 === planet.name
      );
      relatedAspects.forEach(aspect => {
        const otherName = aspect.planet1 === planet.name ? aspect.planet2 : aspect.planet1;
        const other = planetDots.find(pd => pd.planet.name === otherName);
        if (!other) return;
        aspectGroup.append('line')
          .attr('x1', x).attr('y1', y)
          .attr('x2', other.x).attr('y2', other.y)
          .attr('stroke', ASPECT_COLORS[aspect.type] || 'rgba(255,255,255,0.2)')
          .attr('stroke-width', Math.max(0.5, 2 - aspect.orb / 4))
          .attr('stroke-dasharray', aspect.type === 'Opposition' ? '4,3' : 'none')
          .attr('opacity', 0.7);
      });
    });

    dot.on('mouseleave', () => {
      aspectGroup.style('opacity', 0);
    });
  });
}

// Simplified sign metadata for wheel coloring
const SIGN_META_SIMPLE = {
  Aries: { color: '#C4654A' }, Taurus: { color: '#8B7D5E' }, Gemini: { color: '#A3B5C4' },
  Cancer: { color: '#5B7B7A' }, Leo: { color: '#C4654A' }, Virgo: { color: '#8B7D5E' },
  Libra: { color: '#A3B5C4' }, Scorpio: { color: '#5B7B7A' }, Sagittarius: { color: '#C4654A' },
  Capricorn: { color: '#8B7D5E' }, Aquarius: { color: '#A3B5C4' }, Pisces: { color: '#5B7B7A' },
};
```

- [ ] **Step 2: Commit**

```bash
git add chart-wheel.js
git commit -m "feat: add D3.js natal chart wheel renderer"
```

---

### Task 7: Widget components

**Files:**
- Create: `widgets.js`

**Interfaces:**
- Consumes: `ChartData` object (chart-engine.js)
- Produces: `renderBig3(containerId, chartData)`, `renderElementBalance(containerId, chartData)`, `renderModalitySplit(containerId, chartData)`, `renderHemisphereBalance(containerId, chartData)`, `renderStelliums(containerId, chartData)`, `renderPlanetCards(containerId, chartData)`, `renderBusinessLens(containerId, chartData)`, `renderAspectWeb(containerId, chartData)`, `renderCosmicDNA(containerId, chartData)`, `renderRetrogrades(containerId, chartData)`, `renderChartRuler(containerId, chartData)`

Each widget renders into a container by ID. All widgets are self-contained and fail silently if the container doesn't exist.

- [ ] **Step 1: Write widgets.js**

```javascript
// widgets.js — All profile widget components
// Each function renders into a named container. Depends on chart-engine.js constants.

/** Big 3 — Sun, Moon, Rising as three badge cards */
function renderBig3(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const big3 = chartData.getBig3();
  const items = [
    { label: 'Sun', data: big3.sun, icon: '☉' },
    { label: 'Moon', data: big3.moon, icon: '☽' },
    { label: 'Rising', data: big3.rising, icon: 'AC' },
  ];
  el.innerHTML = items.map(item => {
    if (!item.data) return '';
    return `
      <div class="widget-badge">
        <span class="badge-icon">${item.icon}</span>
        <span class="badge-sign">${item.data.sign}</span>
        <span class="badge-label">${item.label}</span>
      </div>
    `;
  }).join('');
}

/** Chart Ruler card */
function renderChartRuler(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const ruler = chartData.getChartRuler();
  if (!ruler) { el.style.display = 'none'; return; }
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Chart Ruler</div>
      <div class="widget-card-value">${PLANET_GLYPHS[ruler.planet] || ''} ${ruler.planet}</div>
      <div class="widget-card-detail">${ruler.sign} in the ${ordinal(ruler.house)} house</div>
      <div class="widget-card-sub">Rules your ${ruler.ascendant_sign} Ascendant</div>
    </div>
  `;
}

/** Element Balance — 4 horizontal bars */
function renderElementBalance(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const elements = chartData.getElements();
  const total = Object.values(elements).reduce((s, e) => s + e.count, 0) || 1;
  const order = ['fire', 'earth', 'air', 'water'];
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Elements</div>
      ${order.map(key => {
        const e = elements[key];
        const pct = Math.round((e.count / total) * 100);
        return `
          <div class="bar-row">
            <span class="bar-label">${key}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:${ELEMENT_COLORS[key]}"></div>
            </div>
            <span class="bar-count">${e.count}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/** Modality Split — 3 horizontal bars */
function renderModalitySplit(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const mods = chartData.getModalities();
  const total = Object.values(mods).reduce((s, m) => s + m.count, 0) || 1;
  const order = ['cardinal', 'fixed', 'mutable'];
  const colors = { cardinal: '#BA916B', fixed: '#8B7D5E', mutable: '#A3B5C4' };
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Modality</div>
      ${order.map(key => {
        const m = mods[key];
        const pct = Math.round((m.count / total) * 100);
        return `
          <div class="bar-row">
            <span class="bar-label">${key}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:${colors[key]}"></div>
            </div>
            <span class="bar-count">${m.count}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/** Hemisphere Balance — quadrant dot visualization */
function renderHemisphereBalance(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const h = chartData.getHemispheres();
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Hemisphere Balance</div>
      <div class="hemisphere-grid">
        <div class="hemisphere-cell">
          <div class="hemisphere-count">${h.above.count}</div>
          <div class="hemisphere-label">above horizon</div>
          <div class="hemisphere-sub">public life</div>
        </div>
        <div class="hemisphere-cell">
          <div class="hemisphere-count">${h.below.count}</div>
          <div class="hemisphere-label">below horizon</div>
          <div class="hemisphere-sub">inner world</div>
        </div>
        <div class="hemisphere-cell">
          <div class="hemisphere-count">${h.east.count}</div>
          <div class="hemisphere-label">eastern</div>
          <div class="hemisphere-sub">self-driven</div>
        </div>
        <div class="hemisphere-cell">
          <div class="hemisphere-count">${h.west.count}</div>
          <div class="hemisphere-label">western</div>
          <div class="hemisphere-sub">others-oriented</div>
        </div>
      </div>
    </div>
  `;
}

/** Stellium Detector — only renders if stelliums exist */
function renderStelliums(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const stelliums = chartData.getStelliums();
  if (!stelliums.length) { el.style.display = 'none'; return; }
  el.innerHTML = stelliums.map(s => `
    <div class="widget-card widget-card-glow">
      <div class="widget-card-label">Stellium</div>
      <div class="widget-card-value">${s.key}</div>
      <div class="widget-card-detail">${s.planets.join(', ')} clustered in ${s.type === 'sign' ? 'the sign of ' + s.key : s.key}</div>
    </div>
  `).join('');
}

/** Planet Cards — scrollable row of all major planets */
function renderPlanetCards(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const planets = chartData.getPlanetCards();
  el.innerHTML = `
    <div class="planet-cards-scroll">
      ${planets.map(p => `
        <div class="planet-card">
          <div class="planet-card-glyph">${PLANET_GLYPHS[p.name] || ''}</div>
          <div class="planet-card-name">${p.name.replace('_', ' ')}</div>
          <div class="planet-card-sign">${SIGN_GLYPHS[p.sign] || ''} ${p.sign}</div>
          <div class="planet-card-house">${ordinal(p.house)} house</div>
          ${p.retrograde ? '<div class="planet-card-rx">℞ retrograde</div>' : ''}
        </div>
      `).join('')}
    </div>
  `;
}

/** Business Lens — money, visibility, communication, leadership */
function renderBusinessLens(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const biz = chartData.getBusinessLens();

  function houseSummary(houseData) {
    const sign = houseData.house ? houseData.house.sign : '—';
    const planets = houseData.planets.map(p => p.name).join(', ') || 'no planets';
    return `${sign} — ${planets}`;
  }

  el.innerHTML = `
    <div class="biz-grid">
      <div class="widget-card">
        <div class="widget-card-label">Your Money</div>
        <div class="biz-row">
          <span class="biz-house">2nd house</span>
          <span class="biz-detail">${houseSummary(biz.money.second)}</span>
        </div>
        <div class="biz-sub">earned income</div>
        <div class="biz-row" style="margin-top:0.8rem">
          <span class="biz-house">8th house</span>
          <span class="biz-detail">${houseSummary(biz.money.eighth)}</span>
        </div>
        <div class="biz-sub">other people's money</div>
      </div>
      <div class="widget-card">
        <div class="widget-card-label">Your Visibility</div>
        <div class="biz-row">
          <span class="biz-house">MC</span>
          <span class="biz-detail">${biz.visibility.mc ? biz.visibility.mc.sign : '—'}</span>
        </div>
        <div class="biz-sub">how the world sees your brand</div>
      </div>
      <div class="widget-card">
        <div class="widget-card-label">How You Sell</div>
        <div class="biz-row">
          <span class="biz-house">Mercury</span>
          <span class="biz-detail">${biz.communication.mercury ? biz.communication.mercury.sign + ' in ' + ordinal(biz.communication.mercury.house) : '—'}</span>
        </div>
      </div>
      <div class="widget-card">
        <div class="widget-card-label">How You Lead</div>
        <div class="biz-row">
          <span class="biz-house">Sun</span>
          <span class="biz-detail">${biz.leadership.sun ? biz.leadership.sun.sign + ' in ' + ordinal(biz.leadership.sun.house) : '—'}</span>
        </div>
        <div class="biz-row" style="margin-top:0.4rem">
          <span class="biz-house">Mars</span>
          <span class="biz-detail">${biz.leadership.mars ? biz.leadership.mars.sign + ' in ' + ordinal(biz.leadership.mars.house) : '—'}</span>
        </div>
      </div>
    </div>
  `;
}

/** Aspect Web — D3 network diagram */
function renderAspectWeb(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const aspects = chartData.getAspects();
  const planets = chartData.getPlanetCards();
  if (!aspects.length) { el.style.display = 'none'; return; }

  const size = Math.min(el.clientWidth, 400);
  const cx = size / 2;
  const r = size / 2 - 30;

  // Place planets in a circle
  const positions = {};
  planets.forEach((p, i) => {
    const angle = (i / planets.length) * Math.PI * 2 - Math.PI / 2;
    positions[p.name] = {
      x: cx + Math.cos(angle) * r,
      y: cx + Math.sin(angle) * r,
    };
  });

  const svg = d3.select(`#${containerId}`)
    .append('svg')
    .attr('viewBox', `0 0 ${size} ${size}`)
    .attr('width', '100%')
    .style('max-width', `${size}px`);

  // Aspect lines
  aspects.forEach(a => {
    const p1 = positions[a.planet1];
    const p2 = positions[a.planet2];
    if (!p1 || !p2) return;
    svg.append('line')
      .attr('x1', p1.x).attr('y1', p1.y)
      .attr('x2', p2.x).attr('y2', p2.y)
      .attr('stroke', ASPECT_COLORS[a.type] || 'rgba(255,255,255,0.15)')
      .attr('stroke-width', Math.max(0.5, 2 - a.orb / 3))
      .attr('opacity', 0.5);
  });

  // Planet nodes
  planets.forEach(p => {
    const pos = positions[p.name];
    if (!pos) return;
    const g = svg.append('g').attr('transform', `translate(${pos.x},${pos.y})`);
    g.append('circle').attr('r', 5).attr('fill', 'var(--mist)').attr('stroke', 'var(--smoke)').attr('stroke-width', 2);
    g.append('text').attr('y', -10).attr('text-anchor', 'middle').attr('fill', 'var(--stone)').attr('font-size', '10px')
      .text(PLANET_GLYPHS[p.name] || p.name.slice(0, 2));
  });
}

/** Cosmic DNA Strip — unique color barcode */
function renderCosmicDNA(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const planets = chartData.getPlanetCards();
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Cosmic DNA</div>
      <div class="dna-strip">
        ${planets.map(p => {
          const meta = SIGN_META_SIMPLE[p.sign];
          return `<div class="dna-segment" style="background:${meta ? meta.color : '#666'}" title="${p.name} in ${p.sign}"></div>`;
        }).join('')}
      </div>
      <div class="dna-labels">
        ${planets.map(p => `<span class="dna-label">${(PLANET_GLYPHS[p.name] || p.name[0])}</span>`).join('')}
      </div>
    </div>
  `;
}

/** Retrograde Tracker — badges for natal retrogrades */
function renderRetrogrades(containerId, chartData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const retros = chartData.getRetrogrades();
  if (!retros.length) {
    el.innerHTML = `
      <div class="widget-card">
        <div class="widget-card-label">Natal Retrogrades</div>
        <div class="widget-card-detail" style="opacity:0.4">None</div>
      </div>
    `;
    return;
  }
  el.innerHTML = `
    <div class="widget-card">
      <div class="widget-card-label">Natal Retrogrades</div>
      <div class="retro-badges">
        ${retros.map(p => `
          <span class="retro-badge">${PLANET_GLYPHS[p.name] || ''} ${p.name} ℞</span>
        `).join('')}
      </div>
    </div>
  `;
}

/** Utility: ordinal suffix */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
```

- [ ] **Step 2: Commit**

```bash
git add widgets.js
git commit -m "feat: add all profile widget components"
```

---

### Task 8: Profile page HTML + orchestrator

**Files:**
- Rewrite: `index.html` (complete rewrite)
- Create: `profile.js` (page orchestrator)
- Create: `profile-intake.html` (birth data form for cosmic profile)

**Interfaces:**
- Consumes: `getCosmicProfileGrant()`, `getNatalChart()`, `getProfile()`, `getBlueprintGrant()`, `getTransitGrant()`, `getAstrocartographyGrant()`, `getCourseGrant()` from db.js; `ChartData` from chart-engine.js; all widget renderers from widgets.js; `renderChartWheel` from chart-wheel.js
- Produces: Complete profile page with dynamic sections

- [ ] **Step 1: Create profile-intake.html**

This is the birth data form for cosmic profile buyers. Follows the exact same pattern as blueprint.html's intake form but with only birth data fields (no business questions).

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Cosmic Profile — Cato Vermeulen</title>
  <link rel="stylesheet" href="styles.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="auth.js"></script>
  <script src="db.js"></script>
  <script src="autocomplete.js"></script>
</head>
<body>
  <div id="login-screen" class="page-center" style="display:none">
    <div class="login-wrap">
      <img src="img/logo.png" alt="Cato Vermeulen" style="max-width:280px;margin-bottom:1.5rem;">
      <p>Client Portal</p>
      <div id="login-form">
        <input type="email" id="email-input" placeholder="Your email address" autocomplete="email">
        <button class="btn btn-primary" id="send-link-btn" onclick="handleSendLink()">Send access link</button>
        <div class="error-msg" id="login-error"></div>
      </div>
      <div id="login-sent" class="login-sent" style="display:none">
        <p>Check your inbox.</p>
        <p style="margin-top:0.8rem;color:var(--stone);font-size:0.85rem">We've sent a login link to your email.</p>
      </div>
    </div>
  </div>

  <div id="intake-screen" style="display:none;padding:3rem 2rem 6rem;">
    <div class="blueprint-wrap">
      <a href="index.html" class="back-link">← Back to profile</a>
      <h1>Your Birth Details</h1>
      <p class="subtitle">Enter your exact birth data to generate your cosmic profile.</p>

      <div id="intake-form">
        <div class="field-group">
          <label class="field-label">Full Name</label>
          <input type="text" id="f-name" placeholder="Your full name">
        </div>
        <div class="two-col">
          <div class="field-group">
            <label class="field-label">Date of Birth</label>
            <input type="date" id="f-dob">
          </div>
          <div class="field-group">
            <label class="field-label">Time of Birth</label>
            <input type="time" id="f-tob">
          </div>
        </div>
        <div class="field-group" style="position:relative">
          <label class="field-label">City of Birth</label>
          <input type="text" id="f-city" placeholder="City" autocomplete="off">
        </div>
        <div class="field-group">
          <label class="field-label">Country of Birth</label>
          <input type="text" id="f-country" placeholder="Country">
        </div>

        <div class="error-msg" id="intake-error"></div>
        <button class="btn btn-primary" id="submit-btn" onclick="handleSubmit()" style="margin-top:2rem">Generate my profile</button>
      </div>

      <div id="intake-loading" style="display:none;text-align:center;padding:4rem 0;">
        <p style="color:var(--golden);font-size:1.1rem">Computing your chart...</p>
        <p style="color:var(--stone);font-size:0.85rem;margin-top:0.5rem">This takes about 10 seconds.</p>
      </div>
    </div>
  </div>

  <script>
    window.SUPABASE_URL = 'https://fdewbbrzetgqqsonpqvp.supabase.co';

    async function init() {
      const session = await getSession();
      if (!session) {
        document.getElementById('login-screen').style.display = 'flex';
        return;
      }
      // Check if chart already exists — redirect to profile
      const chart = await getNatalChart();
      if (chart) {
        window.location.href = 'index.html';
        return;
      }
      // Pre-fill name and birth data from existing profile if available
      const profile = await getProfile();
      if (profile) {
        if (profile.full_name) document.getElementById('f-name').value = profile.full_name;
        if (profile.dob) document.getElementById('f-dob').value = profile.dob;
        if (profile.tob) document.getElementById('f-tob').value = profile.tob;
        if (profile.city) document.getElementById('f-city').value = profile.city;
        if (profile.country) document.getElementById('f-country').value = profile.country;
      }
      document.getElementById('intake-screen').style.display = 'block';
      initCityAutocomplete('f-city', 'f-country');
    }

    async function handleSubmit() {
      const errEl = document.getElementById('intake-error');
      errEl.textContent = '';
      const fields = {
        full_name: document.getElementById('f-name').value.trim(),
        dob: document.getElementById('f-dob').value,
        tob: document.getElementById('f-tob').value,
        city: document.getElementById('f-city').value.trim(),
        country: document.getElementById('f-country').value.trim(),
      };
      if (!fields.full_name || !fields.dob || !fields.city || !fields.country) {
        errEl.textContent = 'Please fill in all required fields.';
        return;
      }
      const session = await getSession();
      fields.email = session.user.email;

      document.getElementById('intake-form').style.display = 'none';
      document.getElementById('intake-loading').style.display = 'block';

      const { error } = await submitCosmicProfileIntake(session.user.id, fields);
      if (error) {
        document.getElementById('intake-form').style.display = 'block';
        document.getElementById('intake-loading').style.display = 'none';
        errEl.textContent = typeof error === 'string' ? error : error.message || 'Something went wrong.';
        return;
      }
      window.location.href = 'index.html';
    }

    async function handleSendLink() {
      const email = document.getElementById('email-input').value.trim();
      const errEl = document.getElementById('login-error');
      const btn = document.getElementById('send-link-btn');
      errEl.textContent = '';
      if (!email) { errEl.textContent = 'Enter your email address.'; return; }
      btn.disabled = true; btn.textContent = 'Sending...';
      const { error } = await sendMagicLink(email);
      if (error) {
        errEl.textContent = error.message || 'Something went wrong.';
        btn.disabled = false; btn.textContent = 'Send access link';
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

- [ ] **Step 2: Create profile.js**

```javascript
// profile.js — Profile page orchestrator
// Loads all grants + chart data, renders widget sections + product states

async function loadProfile(session) {
  document.getElementById('profile-screen').style.display = 'block';
  document.getElementById('user-email').textContent = session.user.email;

  // Load all data in parallel
  const [cosmicGrant, blueprintGrant, transitGrant, astroGrant, courseGrant, chart, profile] = await Promise.all([
    getCosmicProfileGrant(),
    getBlueprintGrant(),
    getTransitGrant(),
    getAstrocartographyGrant(),
    getCourseGrant(),
    getNatalChart(),
    getProfile(),
  ]);

  const state = cosmicProfileState(cosmicGrant, chart);

  // If they have a cosmic profile grant but no chart yet, redirect to intake
  if (state === 'intake') {
    window.location.href = 'profile-intake.html';
    return;
  }

  // If no cosmic profile grant at all, show the locked state (upsell)
  if (state === 'locked') {
    document.getElementById('profile-locked').style.display = 'block';
    document.getElementById('profile-widgets').style.display = 'none';
    // Still show existing product cards if they have other grants
    renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
    return;
  }

  // Chart exists — render everything
  document.getElementById('profile-locked').style.display = 'none';
  document.getElementById('profile-widgets').style.display = 'block';

  const cd = new ChartData(chart);

  // Header: name + big 3
  const big3 = cd.getBig3();
  document.getElementById('profile-name').textContent = profile ? profile.full_name : session.user.email;
  if (big3.sun && big3.moon && big3.rising) {
    document.getElementById('profile-subtitle').textContent =
      `${big3.sun.sign} Sun · ${big3.moon.sign} Moon · ${big3.rising.sign} Rising`;
  }

  // Render all widgets
  renderBig3('w-big3', cd);
  renderChartRuler('w-chart-ruler', cd);
  renderChartWheel('w-chart-wheel', cd);
  renderElementBalance('w-elements', cd);
  renderModalitySplit('w-modality', cd);
  renderHemisphereBalance('w-hemispheres', cd);
  renderStelliums('w-stelliums', cd);
  renderPlanetCards('w-planets', cd);
  renderBusinessLens('w-business', cd);
  renderAspectWeb('w-aspect-web', cd);
  renderCosmicDNA('w-cosmic-dna', cd);
  renderRetrogrades('w-retrogrades', cd);

  // Render product sections with upsells
  renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile);
}

function renderProductSections(blueprintGrant, transitGrant, astroGrant, courseGrant, profile) {
  const container = document.getElementById('product-sections');

  const products = [
    {
      id: 'blueprint',
      name: 'Category of One Blueprint',
      grant: blueprintGrant,
      profile: profile,
      hook: 'Your chart holds a full business strategy. This is the deep dive.',
      cta: 'Get your Blueprint',
      url: 'https://catovermeulen.com/category-of-one',
      readyUrl: 'blueprint.html',
      intakeUrl: 'blueprint.html',
    },
    {
      id: 'transit',
      name: 'Transits Reading',
      grant: transitGrant,
      profile: profile,
      hook: 'What\'s coming for your business. Dates, moves, windows.',
      cta: 'Get your Transits Reading',
      url: 'https://catovermeulen.com/transits-reading',
      readyUrl: 'transit-reading.html',
      intakeUrl: 'transit-reading.html',
    },
    {
      id: 'astrocartography',
      name: 'Astrocartography Reading',
      grant: astroGrant,
      profile: profile,
      hook: 'Where in the world your business thrives.',
      cta: 'Get your Astrocartography Reading',
      url: 'https://catovermeulen.com/astrocartography',
      readyUrl: 'astrocartography.html',
      intakeUrl: 'astrocartography.html',
    },
    {
      id: 'course',
      name: 'Business Astrology Course',
      grant: courseGrant,
      profile: null,
      hook: 'Learn to read your own chart for business.',
      cta: 'Get the Course',
      url: 'https://catovermeulen.com',
      readyUrl: 'course.html',
      intakeUrl: null,
    },
  ];

  container.innerHTML = products.map(p => {
    const state = p.id === 'course' ? courseState(p.grant) : blueprintState(p.grant, p.profile);

    if (state === 'locked') {
      return `
        <div class="product-card product-locked">
          <div class="product-card-label">${p.name}</div>
          <div class="product-card-hook">${p.hook}</div>
          <a href="${p.url}" class="card-cta">${p.cta} →</a>
        </div>
      `;
    }
    if (state === 'intake') {
      return `
        <div class="product-card product-intake">
          <div class="product-card-label">${p.name}</div>
          <div class="product-card-status">Complete your details to begin</div>
          <a href="${p.intakeUrl}" class="card-cta">Complete your details →</a>
        </div>
      `;
    }
    if (state === 'pending') {
      return `
        <div class="product-card product-pending">
          <div class="product-card-label">${p.name}</div>
          <div class="product-card-status">Ready in ${p.grant ? formatCountdown(p.grant.available_at) : '...'}</div>
        </div>
      `;
    }
    // ready
    return `
      <div class="product-card product-ready">
        <div class="product-card-label">${p.name}</div>
        <div class="product-card-status" style="color:var(--golden)">Your reading is ready</div>
        <a href="${p.readyUrl}" class="card-cta">View reading →</a>
      </div>
    `;
  }).join('');
}
```

- [ ] **Step 3: Rewrite index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cato Vermeulen — Your Cosmic Profile</title>
  <link rel="stylesheet" href="styles.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
  <script src="auth.js"></script>
  <script src="db.js"></script>
  <script src="dashboard.js"></script>
  <script src="chart-engine.js"></script>
  <script src="chart-wheel.js"></script>
  <script src="widgets.js"></script>
  <script src="profile.js"></script>
</head>
<body>

  <!-- Login -->
  <div id="login-screen" class="page-center" style="display:none">
    <div class="login-wrap">
      <img src="img/logo.png" alt="Cato Vermeulen" style="max-width:280px;margin-bottom:1.5rem;">
      <p>Client Portal</p>
      <div id="login-form">
        <input type="email" id="email-input" placeholder="Your email address" autocomplete="email">
        <button class="btn btn-primary" id="send-link-btn" onclick="handleSendLink()">Send access link</button>
        <div class="error-msg" id="login-error"></div>
      </div>
      <div id="login-sent" class="login-sent" style="display:none">
        <p>Check your inbox.</p>
        <p style="margin-top:0.8rem;color:var(--stone);font-size:0.85rem">We've sent a login link to your email.</p>
      </div>
    </div>
  </div>

  <!-- Profile -->
  <div id="profile-screen" style="display:none">
    <div class="dashboard-header">
      <img src="img/logo.png" alt="Cato Vermeulen" style="height:60px;">
      <div class="header-right">
        <span class="user-email" id="user-email"></span>
        <button class="sign-out-btn" onclick="signOut()">Sign out</button>
      </div>
    </div>

    <!-- Profile header -->
    <div class="profile-hero">
      <h2 id="profile-name"></h2>
      <p id="profile-subtitle" class="profile-subtitle"></p>
    </div>

    <!-- Locked state: no cosmic profile -->
    <div id="profile-locked" class="container" style="display:none">
      <div class="locked-banner">
        <h3>Your Cosmic Profile</h3>
        <p>Your natal chart, element balance, business lens, and more. Computed from your exact birth data.</p>
        <a href="https://catovermeulen.com" class="btn btn-primary" style="margin-top:1.5rem">Get your Cosmic Profile</a>
      </div>
    </div>

    <!-- Widget sections -->
    <div id="profile-widgets" class="container" style="display:none">

      <!-- Big 3 badges -->
      <div id="w-big3" class="big3-row"></div>

      <!-- Chart ruler -->
      <div id="w-chart-ruler" style="margin:2rem 0"></div>

      <!-- Chart wheel -->
      <section class="profile-section">
        <p class="section-label">Your Natal Chart</p>
        <div id="w-chart-wheel" class="chart-wheel-container"></div>
      </section>

      <!-- Snapshot widgets grid -->
      <section class="profile-section">
        <p class="section-label">Chart Snapshot</p>
        <div class="widget-grid">
          <div id="w-elements"></div>
          <div id="w-modality"></div>
          <div id="w-hemispheres"></div>
          <div id="w-stelliums"></div>
        </div>
      </section>

      <!-- Planet placements -->
      <section class="profile-section">
        <p class="section-label">Your Planets</p>
        <div id="w-planets"></div>
      </section>

      <!-- Business lens -->
      <section class="profile-section">
        <p class="section-label">Business Lens</p>
        <div id="w-business"></div>
      </section>

      <!-- Aspect web -->
      <section class="profile-section">
        <p class="section-label">Aspect Web</p>
        <div id="w-aspect-web"></div>
      </section>

      <!-- Fun widgets -->
      <section class="profile-section">
        <p class="section-label">Your Cosmic Fingerprint</p>
        <div class="widget-grid">
          <div id="w-cosmic-dna"></div>
          <div id="w-retrogrades"></div>
        </div>
      </section>
    </div>

    <!-- Product sections (dynamic: purchased + upsells) -->
    <div class="container" style="margin-top:3rem">
      <p class="section-label" style="color:var(--golden)">Your Readings</p>
      <div id="product-sections" class="product-grid"></div>
    </div>
  </div>

  <script>
    window.SUPABASE_URL = 'https://fdewbbrzetgqqsonpqvp.supabase.co';

    async function init() {
      const session = await getSession();
      if (!session) {
        document.getElementById('login-screen').style.display = 'flex';
        return;
      }
      await loadProfile(session);
    }

    async function handleSendLink() {
      const email = document.getElementById('email-input').value.trim();
      const errEl = document.getElementById('login-error');
      const btn = document.getElementById('send-link-btn');
      errEl.textContent = '';
      if (!email) { errEl.textContent = 'Enter your email address.'; return; }
      btn.disabled = true; btn.textContent = 'Sending...';
      const { error } = await sendMagicLink(email);
      if (error) {
        errEl.textContent = error.message || 'Something went wrong.';
        btn.disabled = false; btn.textContent = 'Send access link';
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

- [ ] **Step 4: Commit**

```bash
git add index.html profile.js profile-intake.html
git commit -m "feat: profile page replaces dashboard — widgets + product sections"
```

---

### Task 9: CSS — widget styles + profile layout

**Files:**
- Modify: `styles.css` (append new sections)

**Interfaces:**
- Consumes: all widget class names from widgets.js, profile.js, chart-wheel.js
- Produces: styled widget grid, cards, bars, badges, responsive layout

- [ ] **Step 1: Append widget CSS to styles.css**

Add after the existing responsive section (after line 506):

```css
/* ── PROFILE HERO ───────────────────────────────────── */

.profile-hero {
  text-align: center;
  padding: 5rem 2rem 2rem;
}

.profile-hero h2 {
  font-size: 3.5rem;
  font-weight: 300;
  color: var(--mist);
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 0.6rem;
}

.profile-subtitle {
  color: var(--stone);
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* ── SECTION LABELS ─────────────────────────────────── */

.profile-section {
  margin-bottom: 3rem;
}

.section-label {
  color: var(--golden);
  font-size: 0.6rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  font-weight: 400;
}

/* ── BIG 3 BADGES ───────────────────────────────────── */

.big3-row {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.widget-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.badge-icon {
  font-size: 1.6rem;
  color: var(--golden);
}

.badge-sign {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.3rem;
  color: var(--mist);
  font-weight: 400;
}

.badge-label {
  font-size: 0.55rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--stone);
}

/* ── WIDGET GRID ────────────────────────────────────── */

.widget-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
}

/* ── WIDGET CARDS ───────────────────────────────────── */

.widget-card {
  background: var(--smoke-card);
  padding: 2rem;
  border: 1px solid var(--border);
}

.widget-card-glow {
  border-color: rgba(186,145,107,0.2);
  background: linear-gradient(135deg, var(--smoke-card), rgba(186,145,107,0.04));
}

.widget-card-label {
  font-size: 0.55rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--golden);
  margin-bottom: 1rem;
}

.widget-card-value {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.6rem;
  color: var(--mist);
  font-weight: 300;
  margin-bottom: 0.4rem;
}

.widget-card-detail {
  font-size: 0.85rem;
  color: var(--stone);
  line-height: 1.5;
}

.widget-card-sub {
  font-size: 0.72rem;
  color: rgba(180,167,148,0.4);
  margin-top: 0.3rem;
}

/* ── BAR CHARTS ─────────────────────────────────────── */

.bar-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.6rem;
}

.bar-label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--stone);
  width: 60px;
  flex-shrink: 0;
}

.bar-track {
  flex-grow: 1;
  height: 6px;
  background: rgba(255,255,255,0.04);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease-out;
}

.bar-count {
  font-size: 0.75rem;
  color: var(--mist);
  width: 16px;
  text-align: right;
  flex-shrink: 0;
}

/* ── HEMISPHERE GRID ────────────────────────────────── */

.hemisphere-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.2rem;
}

.hemisphere-cell { text-align: center; }

.hemisphere-count {
  font-family: 'Cormorant Garamond', serif;
  font-size: 2.2rem;
  color: var(--mist);
  font-weight: 300;
}

.hemisphere-label {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--stone);
  margin-top: 0.2rem;
}

.hemisphere-sub {
  font-size: 0.65rem;
  color: rgba(180,167,148,0.35);
}

/* ── PLANET CARDS ───────────────────────────────────── */

.planet-cards-scroll {
  display: flex;
  gap: 1px;
  overflow-x: auto;
  padding-bottom: 1rem;
  -webkit-overflow-scrolling: touch;
}

.planet-cards-scroll::-webkit-scrollbar { height: 2px; }
.planet-cards-scroll::-webkit-scrollbar-track { background: transparent; }
.planet-cards-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 1px; }

.planet-card {
  flex-shrink: 0;
  width: 120px;
  background: var(--smoke-card);
  border: 1px solid var(--border);
  padding: 1.4rem 1rem;
  text-align: center;
}

.planet-card-glyph {
  font-size: 1.5rem;
  color: var(--golden);
  margin-bottom: 0.6rem;
}

.planet-card-name {
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--stone);
  margin-bottom: 0.6rem;
}

.planet-card-sign {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1rem;
  color: var(--mist);
  margin-bottom: 0.2rem;
}

.planet-card-house {
  font-size: 0.72rem;
  color: var(--stone);
}

.planet-card-rx {
  font-size: 0.6rem;
  color: #C4654A;
  margin-top: 0.5rem;
  letter-spacing: 0.1em;
}

/* ── BUSINESS LENS ──────────────────────────────────── */

.biz-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
}

.biz-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.biz-house {
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--golden);
}

.biz-detail {
  font-size: 0.85rem;
  color: var(--mist);
}

.biz-sub {
  font-size: 0.65rem;
  color: rgba(180,167,148,0.35);
  margin-top: 0.1rem;
}

/* ── COSMIC DNA STRIP ───────────────────────────────── */

.dna-strip {
  display: flex;
  gap: 2px;
  margin-bottom: 0.5rem;
}

.dna-segment {
  flex: 1;
  height: 24px;
  border-radius: 2px;
  opacity: 0.8;
  transition: opacity 0.3s;
}

.dna-segment:hover { opacity: 1; }

.dna-labels {
  display: flex;
  gap: 2px;
}

.dna-label {
  flex: 1;
  text-align: center;
  font-size: 0.55rem;
  color: var(--stone);
}

/* ── RETROGRADE BADGES ──────────────────────────────── */

.retro-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.retro-badge {
  font-size: 0.72rem;
  color: #C4654A;
  padding: 0.4rem 0.8rem;
  border: 1px solid rgba(196,101,74,0.2);
  border-radius: 2px;
}

/* ── CHART WHEEL ────────────────────────────────────── */

.chart-wheel-container {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.chart-wheel-container svg {
  width: 100%;
}

/* ── LOCKED BANNER ──────────────────────────────────── */

.locked-banner {
  text-align: center;
  padding: 4rem 2rem;
  border: 1px solid var(--border);
  background: var(--smoke-card);
  margin-bottom: 3rem;
}

.locked-banner h3 {
  font-size: 2rem;
  color: var(--mist);
  font-weight: 300;
  margin-bottom: 0.8rem;
}

.locked-banner p {
  color: var(--stone);
  font-size: 0.88rem;
  max-width: 440px;
  margin: 0 auto;
  line-height: 1.6;
}

/* ── PRODUCT CARDS (at bottom of profile) ───────────── */

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  margin-top: 1.5rem;
}

.product-card {
  background: var(--smoke-card);
  padding: 2.2rem 2rem;
  border: 1px solid var(--border);
}

.product-card-label {
  font-size: 0.6rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--golden);
  margin-bottom: 0.8rem;
}

.product-card-hook {
  font-size: 0.88rem;
  color: var(--stone);
  line-height: 1.5;
  margin-bottom: 1.2rem;
}

.product-card-status {
  font-size: 0.78rem;
  color: var(--stone);
  margin-bottom: 0.8rem;
}

.product-locked { opacity: 0.6; transition: opacity 0.3s; }
.product-locked:hover { opacity: 0.9; }

/* ── PROFILE RESPONSIVE ─────────────────────────────── */

@media (max-width: 768px) {
  .profile-hero { padding: 3rem 1.4rem 1.5rem; }
  .profile-hero h2 { font-size: 2.4rem; }
  .big3-row { gap: 1.2rem; }
  .widget-grid { grid-template-columns: 1fr; }
  .biz-grid { grid-template-columns: 1fr; }
  .product-grid { grid-template-columns: 1fr; }
  .planet-card { width: 100px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add profile + widget CSS — grid, cards, bars, responsive"
```

---

### Task 10: Integration test + deploy

**Files:**
- No new files

**Interfaces:**
- Consumes: all previous tasks
- Produces: working deployed portal at app.catovermeulen.com

- [ ] **Step 1: Test locally**

Open `index.html` directly in a browser (or use `python3 -m http.server 8000` in the portal directory). Log in with a test email. Verify:
- Login screen works
- Profile screen loads (shows locked state if no cosmic_profile grant)
- Product section shows reading cards

- [ ] **Step 2: Create a test grant in Supabase**

In Supabase SQL Editor, insert a test grant for a known email:
```sql
insert into access_grants (email, product, granted_at)
values ('TEST_EMAIL_HERE', 'cosmic_profile', now());
```

- [ ] **Step 3: Test the intake flow**

Log in with the test email. Should redirect to `profile-intake.html`. Fill in birth data, submit. Verify:
- `compute-chart` edge function is called (check Supabase Edge Function logs)
- `natal_charts` table gets a row with populated JSONB
- Redirects back to `index.html` and all widgets render

- [ ] **Step 4: Verify each widget renders**

Scroll through the profile. Check:
- [ ] Big 3 badges show correct Sun, Moon, Rising
- [ ] Chart ruler card shows correct planet
- [ ] Chart wheel renders with planets at correct positions
- [ ] Element balance bars add up to 10 (or planet count)
- [ ] Modality bars add up to 10
- [ ] Hemisphere counts add up to 10 on each axis
- [ ] Stelliums only show if 3+ planets cluster (may not appear for all charts)
- [ ] Planet cards scroll horizontally, show all 11 bodies
- [ ] Business lens shows 2nd/8th house, MC, Mercury, Sun, Mars
- [ ] Aspect web renders with lines between planets
- [ ] Cosmic DNA strip has 11 colored segments
- [ ] Retrogrades show correct Rx planets (or "None")
- [ ] Product sections show at the bottom with correct states

- [ ] **Step 5: Test responsive**

Open DevTools, toggle mobile view. Verify:
- Widget grid collapses to 1 column
- Planet cards still scroll horizontally
- Business lens collapses to 1 column
- Product grid collapses to 1 column
- No horizontal overflow on mobile

- [ ] **Step 6: Push to GitHub Pages**

```bash
cd ~/AOOA/clients/Cato/portal
git push origin master
```

Wait 1-2 minutes for GitHub Pages to deploy. Verify at `https://app.catovermeulen.com`.

- [ ] **Step 7: Clean up test grant**

```sql
delete from access_grants where email = 'TEST_EMAIL_HERE' and product = 'cosmic_profile';
delete from natal_charts where email = 'TEST_EMAIL_HERE';
```

---

## Task Dependency Order

```
Task 1 (DB) ──────┐
                   ├── Task 4 (db.js) ──┐
Task 2 (compute)───┘                    │
                                        ├── Task 8 (profile page + HTML)
Task 3 (Stripe) ───────────────────────┤
                                        │
Task 5 (chart-engine) ─────────────────┤
                                        │
Task 6 (chart-wheel) ──────────────────┤
                                        │
Task 7 (widgets) ──────────────────────┘
                                        │
Task 9 (CSS) ──────────────────────────┘
                                        │
Task 10 (integration test + deploy) ───┘
```

Tasks 1-3 and 5-7 can run in parallel. Task 4 depends on Task 1+2. Task 8 depends on all others. Task 9 can start anytime. Task 10 is the final gate.
