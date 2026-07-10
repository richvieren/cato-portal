# Cosmic Profile — Design Spec

_$9 low-ticket tripwire product for Cato's portal. Natal chart data visualized as widgets, gateway to paid readings._

---

## Product

**Name:** Cosmic Profile (working title — Cato picks the real name)
**Price:** $9-$29 (Cato decides final price)
**What they get:** Permanent profile page with interactive natal chart widgets, bite-sized astrology insights, and teaser paths to paid readings.
**What it costs us:** ~$0.01 per user without snippets (one astrology API call + Supabase row storage). ~$0.04-$0.05 per user with GLM-generated snippets.

---

## Architecture

### Stack (unchanged)

- **Frontend:** Vanilla JS + HTML + CSS on GitHub Pages (app.catovermeulen.com)
- **Database/Auth:** Supabase (fdewbbrzetgqqsonpqvp)
- **Astrology data:** astrology-api.io (one `charts/natal` call per user)
- **Payments:** Stripe (new $9 price ID)
- **Visualizations:** D3.js (lightweight, no framework needed) for chart wheel + data viz widgets
- **No LLM.** All interpretations are pre-written JSON snippets (added later, not in v1).

### No Vercel. No framework. No new infra.

---

## Purchase Flow

```
1. Client buys $9 Cosmic Profile on catovermeulen.com (Stripe checkout)
2. Stripe webhook fires → existing edge function creates access_grant (product: 'cosmic_profile')
3. Welcome email with magic link (same flow as current products)
4. Client logs in → lands on profile page
5. Client fills birth data form (same intake fields: name, DOB, TOB, city, country)
6. Edge function calls astrology API → stores full chart data in new `natal_charts` table
7. Profile page renders all widgets from stored chart data
```

### New Stripe product needed
- Product: Cosmic Profile
- Price: $9 (one-time)
- Add price ID to PRICE_TO_PRODUCT mapping in stripe-webhook edge function

---

## Database Changes

### New table: `natal_charts`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK to auth.users |
| email | text | For lookup consistency with access_grants |
| planets | jsonb | Full planet positions (sign, degree, house, retrograde) |
| houses | jsonb | All 12 house cusps with signs |
| aspects | jsonb | All major aspects (conjunction, square, trine, opposition, sextile) |
| computed_at | timestamptz | When the chart was calculated |

One row per user. Computed once from the astrology API response, never recomputed unless birth data changes.

### Existing tables — no changes

- `access_grants` — add 'cosmic_profile' as a product type
- `profiles` — already stores birth data, reuse as-is

---

## New Edge Function: `compute-chart`

Triggered after birth data intake submission (same pattern as `set-available-at`).

1. Receive user_id + birth data
2. Call astrology API `charts/natal` endpoint
3. Parse response into planets/houses/aspects
4. Compute derived data: element balance, modality split, hemisphere balance, stelliums
5. Store in `natal_charts` table
6. Return success (profile page polls or reloads)

Derived data is computed server-side and stored, so the frontend just reads and renders. No chart math in the browser.

---

## Portal Overhaul

### Page structure (after redesign)

| Page | URL | Purpose |
|---|---|---|
| **Profile** | `/` (index.html) | The dashboard. Chart widgets + product sections. Landing page for all users. |
| **Blueprint reading** | `/blueprint.html` | Full blueprint reading view (for buyers). Intake form if not yet submitted. |
| **Transit reading** | `/transit-reading.html` | Full transit reading view (for buyers). Intake form if not yet submitted. |
| **Astrocartography** | `/astrocartography.html` | Full astrocartography reading view (for buyers). Intake form if not yet submitted. |
| **Mini reading** | `/mini-reading.html` | Mini reading view. |
| **Course** | `/course.html` | Course player (unchanged). |

### Profile page is the new index.html

Everyone lands here. What you see depends on what you've bought.

---

## Profile Page Layout

### Section 1: Header

- Name + Big 3 (Sun, Moon, Rising) as styled badges with sign glyphs
- Chart ruler card ("Your chart is led by Venus in Scorpio")
- Small "Edit birth details" link

### Section 2: Natal Chart Wheel

- Interactive SVG rendered by D3.js
- Planets plotted at correct degrees
- House lines + sign boundaries
- Tap/hover a planet to highlight its aspects
- Retrograde planets marked with Rx glyph
- This is the visual centerpiece

### Section 3: Snapshot Widgets (2-column grid on desktop, single column mobile)

**Element Balance**
- Fire / Earth / Air / Water as four horizontal bars or a radial chart
- Shows count + percentage
- Color-coded (fire=red/orange, earth=green/brown, air=blue/light, water=teal/deep blue — adapted to Cato's palette)

**Modality Split**
- Cardinal / Fixed / Mutable as three segments
- Same visual treatment as element balance

**Hemisphere Balance**
- Top/bottom (public vs private life)
- Left/right (self vs others)
- Visual: chart wheel simplified to quadrants with planet dot counts

**Stellium Detector**
- Only appears if 3+ planets share a sign or house
- Glowing highlight card: "You have a Capricorn stellium in your 4th house"
- If no stellium, this widget doesn't render

### Section 4: Planet Placements (scrollable cards or accordion)

Each planet gets a card:
- Planet glyph + name
- Sign + degree
- House number
- Retrograde badge if applicable
- Interpretation snippet (empty in v1, placeholder: "Interpretation coming soon" or just omit)

Planets shown: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node

### Section 5: Business Lens (Cato's differentiator)

**Money Houses**
- 2nd house (earned income) and 8th house (other people's money) side by side
- Sign on cusp + any planets in those houses
- Visual: two columns or two cards

**Visibility Style**
- MC (Midheaven) sign + any 10th house planets
- "How the world sees your brand"

**Communication Style**
- Mercury sign + house
- "How you sell"

**Leadership Style**
- Sun + Mars placements
- "How you lead"

### Section 6: Aspect Web

- Visual spiderweb/network diagram
- Planets as nodes, aspects as lines
- Line thickness = orb tightness (exact = bold, wide = faint)
- Color by aspect type (trine = flowing, square = tension, conjunction = fusion)

### Section 7: Fun / Shareable

**Cosmic DNA Strip**
- Horizontal color-coded strip of all placements
- Unique visual fingerprint per person
- "Share your cosmic DNA" button (generates shareable image — later feature, not v1)

**Retrograde Tracker**
- Which natal planets are retrograde
- Simple badge row

### Section 8: Product Sections (dynamic based on purchases)

For each product (blueprint, transits, astrocartography, mini, course):

**If purchased + delivered:**
- Product-specific widgets pulled from the reading data (v2 — for now, just "View your reading →" link)
- Inline highlights / key insights (v2)

**If purchased + pending:**
- Countdown timer (same as current)
- "Your reading is being prepared"

**If purchased + needs intake:**
- "Complete your details →" CTA

**If NOT purchased:**
- Teaser widget with blurred/locked visual
- 1-2 line hook about what this reading reveals
- CTA button linking to sales page or Stripe checkout

**Teaser content per product:**

| Product | Teaser widget | Hook |
|---|---|---|
| Blueprint | Locked "Business Archetype" card | "Your chart holds a full business strategy. This is the deep dive." |
| Transits | Locked "Next 3 Months" timeline | "What's coming for your business — dates, moves, windows." |
| Astrocartography | Locked mini world map with blurred pins | "Where in the world your business thrives." |
| Mini Reading | Locked "Quick Roadmap" card | "Your 90-day business snapshot." |
| Course | Locked lesson list | "Learn to read your own chart for business." |

---

## Design Direction

### Current design tokens (keeping)

- `--smoke: #181817` (background)
- `--mist: #F2F0E5` (primary text)
- `--golden: #BA916B` (accent/CTA)
- `--linen: #D8CFB9` (borders)
- `--stone: #B4A794` (secondary text)
- Fonts: Cormorant Garamond (display) + Jost (body)

### New design elements needed

- **Widget card system** — consistent card component with subtle border, slight background lift from --smoke
- **Data visualization palette** — element colors, aspect colors, chart wheel colors, all derived from the existing warm palette (no neon, no cold blues)
- **Locked/teaser state** — blur overlay + lock icon + golden CTA button
- **Interactive states** — hover/tap feedback on chart planets and widget cards
- **Responsive grid** — 2-col on desktop, 1-col on mobile. Widgets snap to grid.
- **Section dividers** — subtle, maybe a thin --linen line or just generous spacing

### Vibe

Luxury editorial meets data dashboard. Think: if a high-end astrology app and a Bloomberg terminal had a baby, styled by Cato's warm golden aesthetic. Information-dense but breathable. Every widget earns its space.

---

## LLM Modularity

The interpretation snippets (v2) will be generated by an LLM but the system must not be locked to any provider. Design:

- **`snippets-generator/` directory** on VPS alongside the existing reading pipeline
- **Single config file** specifying: provider (claude/glm/deepseek), model ID, API endpoint, API key env var
- **Same interface regardless of provider:** input = planet/sign/house combo + brand bible context, output = 1-2 sentence snippet
- **OpenAI-compatible API format** — GLM-5.2 (DeepInfra), DeepSeek, and Claude all support this, so the generation script uses one HTTP call pattern with swappable base URL + model ID
- **Pre-generate, not real-time.** Snippets are batch-generated once and stored as JSON. No LLM call happens when a user loads their profile.
- **Brand bible injected via system prompt** — `~/AOOA/clients/Cato/brand-bible.md` loaded into system prompt for voice consistency regardless of which model runs

Current plan: GLM-5.2 via DeepInfra (~$0.035 per full set of snippets). Can swap to Claude or anything else by changing one config.

---

## What's NOT in V1

- Text interpretation snippets (added later via GLM-5.2 batch generation — see LLM Modularity above)
- Celebrity comparison ("You share your Sun-Moon combo with...")
- Shareable cosmic DNA image generation
- Product-specific widgets from purchased readings (blueprint insights inline, transit timeline, etc.)
- Push notifications for transit events
- Any LLM calls whatsoever

---

## File Changes

### New files
- `natal-chart.js` — D3.js chart wheel renderer
- `widgets.js` — all widget components (element balance, modality, aspects, etc.)
- `chart-data.js` — fetches natal_charts data from Supabase, provides to widgets
- `snippets.json` — interpretation text (empty in v1, populated later)

### Modified files
- `index.html` — complete rewrite (profile page replaces product card grid)
- `dashboard.js` — rewrite to render profile + dynamic product sections
- `db.js` — add natal_charts queries + compute-chart trigger
- `styles.css` — major additions for widget grid, chart wheel, card system, responsive layout
- `auth.js` — no changes expected

### New Supabase assets
- `natal_charts` table (migration SQL)
- `compute-chart` edge function
- New Stripe price ID added to `stripe-webhook` edge function

### Unchanged
- `blueprint.html`, `transit-reading.html`, `astrocartography.html`, `mini-reading.html`, `course.html` — keep as-is for v1 (redesign these to match new look in a follow-up)
- VPS pipeline — untouched
- Auth flow — untouched

---

## Open Questions (for Cato)

1. Product name: "Cosmic Profile"? "Your Chart"? "Star Map"? Something else?
2. Does she want the $9 product on her existing Showit sales page or a new dedicated page?
3. Any widgets she'd want to add or kill?
4. Priority on adding text snippets — soon after launch, or way later?
