# Cosmic Profile v2 — Implementation Brief

> Start here. This is the complete brief for the next session. Read this, read the files referenced, then execute.

## What this is

Full overhaul of the Cosmic Business Profile at app.catovermeulen.com based on Cato's feedback (2026-07-12). The profile works but the content is too vague, some widgets lack context, and the chart wheel has a bug.

## Files to modify

- `portal/widgets.js` — all widget render functions
- `portal/chart-engine.js` — add house cusp methods, fix data access
- `portal/chart-wheel.js` — fix whole sign house alignment
- `portal/profile.js` — orchestrator changes
- `portal/index.html` — structural HTML changes
- `portal/styles.css` — styling for new elements
- `portal/snippets.json` — full regeneration via GLM

## Changes to implement (in order)

### 1. MC as pill (not card)
Move Midheaven out of the Big 3 grid. Render it as a pill below the chart ruler pill, same style. `renderChartRuler` in widgets.js is the reference. Add a `renderMidheavenPill` that does the same.

### 2. Chart wheel whole-sign fix
**Bug:** Cato's ASC is Pisces but the chart wheel shows 1st house starting at Aries. In whole sign, the 1st house IS the rising sign. The house boundaries should be: house 1 = 0-30° of the rising sign, house 2 = next sign, etc.

**File:** `portal/chart-wheel.js`
**Fix:** The wheel currently projects houses using the ASC degree. In whole sign, each house starts at 0° of its sign. House 1 starts at 0° of the ASC sign, not at the exact ASC degree. Check the `drawHouses` or equivalent function and ensure house boundaries align to sign boundaries.

### 3. Archetype spectrums — add context
Each spectrum (Visionary/Operator, Starter/Finisher, Committed/Adaptable) needs 1-2 sentences explaining what the person's position means. Generate per-user via GLM or use static descriptions per quadrant.

### 4. Hemisphere/chart focus — plain language
The quadrant heat map says things like "Public / Others / Clients & Audience" without explaining what it means. Add a 1-2 sentence summary: "Most of your planets sit in the upper hemisphere, which means your business energy is directed outward toward clients and public visibility."

### 5. Planet strengths — add substance
The leaderboard bars need text explaining why each planet is ranked where it is. Example: "Mars ranks highest because it sits in its own sign (Scorpio) and aspects three other planets."

### 6. Retrogrades — deeper business meanings
Current retrograde section just lists which planets are Rx. Needs per-planet business interpretation. For personal planets (Mercury, Venus, Mars) Rx, flag as especially significant. Example: "Saturn Rx in your 2nd house: your relationship with money runs deeper than most. You probably undercharged early in your career..."

### 7. Sales style / leadership style — explain basis
Current badges say "Analytical Seller" or "Creative Leader" without explaining why. Add: "Based on Mercury in Virgo (7th house)" and a 2-sentence explanation.

### 8. Business lens deeper — house cusps
Add interpretive text for:
- 2nd house cusp sign + element = how you make money
- 6th house cusp sign + element = how you do daily work
- 10th house cusp sign + element = how you build your public career

Already started: money style widget shows 2nd house sign. Needs the same for 6th and 10th, plus interpretive copy for all three.

### 9. GLM snippet regeneration
The current 312 snippets are too vague and abstract. Regenerate all categories with this prompt structure (tested and approved tone):

**System prompt:**
```
You write cosmic business profile snippets for entrepreneurs. You translate astrology into plain business language. Think: smart friend who happens to know astrology, explaining what someone's chart means for their business.

Rules:
- 5th grade reading level. No jargon unless you immediately explain it.
- Specific. Tangible. Give examples of what this looks like in real life.
- Every insight connects to business: money, clients, visibility, leadership, daily work, or energy.
- No em dashes. Ever. Split into two sentences instead.
- No filler words. No 'journey'. No 'transform'. No 'unlock'. No 'harness'.
- Short paragraphs. 2-4 sentences each.
- Write like you are talking to a friend over coffee.
- Do not overthink. Write directly.
```

**Categories to regenerate:**
- Welcome (144 Sun x Rising combos) — more tangible, less abstract
- At a glance (12 element x modality combos) — more depth
- Money (12 by sign) — connect to 2nd house, concrete
- Visibility (12 by sign) — connect to MC/10th house
- Sales (12 by sign) — explain the selling style with examples
- Leadership (12 by sign) — explain leadership approach with examples
- Question (84 ruler x house combos) — make it punchier

**New categories to add:**
- Element combo summaries (fire/earth/air/water dominant with low element context)
- Modality summaries (cardinal/fixed/mutable dominant)
- House cusp interpretations (2nd, 6th, 10th by sign)
- Retrograde business meanings (per planet)
- MC sign interpretations (career destiny)
- Moon sign business nourishment (per sign)

**Cost estimate:** ~$0.50-1.00 via GLM on OpenRouter.

### 10. Welcome text
Change from "COSMIC BUSINESS PROFILE" overline to "Welcome to an introduction to your Cosmic Profile" or similar. Cato's exact wording TBD.

### 11. Remove upsell banners mid-profile
The inline upsell banners (Blueprint, Transits) break the flow. The CTA at the bottom handles upselling. Remove the mid-profile banners.

## Test with
- Cato's chart: cato.vermeulen@outlook.com (Leo Sun, Cap Moon, Pisces Rising, Sag MC)
- Richard's chart: richard@aooa.tv (Cancer Sun, Libra Moon, Scorpio Rising, Leo MC)

## Reference files
- Cato's full feedback: transcribed in `_wiki/log.md` under [2026-07-12]
- Current widgets: `portal/widgets.js`
- Chart engine: `portal/chart-engine.js`
- Chart wheel: `portal/chart-wheel.js`
- Current snippets: `portal/snippets.json`
- Anti-AI audit: `~/cato-shared-docs/anti-ai-audit.md`
- GLM test copy (approved tone): generated in session 2026-07-12, output in conversation

## Deploy
```bash
cd portal
git add -A && git commit -m "feat: Cosmic Profile v2" && git push origin main
```
GitHub Pages auto-deploys. Verify with `curl -s https://app.catovermeulen.com/widgets.js | grep 'renderMidheavenPill'`.
