# DESIGN.md — Cato Vermeulen Portal

> Read this before generating any UI for the Cato Vermeulen client portal. Source of truth is `docs/specs/2026-03-31-cato-portal-design.md`. This file is the agent-readable summary.

---

## 1. Visual Theme & Atmosphere

Luxury editorial. Warm neutrals on deep smoke backgrounds. The feeling is a high-end studio — quiet, considered, unhurried. Nothing decorative for its own sake. No gradients, no shadows, no bright accents. The warmth comes from the palette, not from ornament.

**Density:** Low. Generous whitespace. Content breathes.
**Mood:** Elevated, intimate, calm. A private space for a client, not a public-facing product.
**Never:** Gradients, drop shadows, bright colors, bold headings, uppercase labels, decorative dividers.

---

## 2. Color Palette

| Token | Hex | Role |
|---|---|---|
| `--stone` | `#BAAFA3` | Muted text, labels, secondary information |
| `--linen` | `#D8CFB9` | Warm mid-tone — subheadings, borders, dividers |
| `--smoke` | `#242324` | Page background — deep, near-black |
| `--mist` | `#F2F0E5` | Primary text on dark backgrounds |
| `--golden` | `#9F8261` | Accent — CTAs, links, highlights, active states |

**Usage rules:**
- Smoke is always the page background.
- Mist is body text. Never pure white.
- Golden is the single accent — use it sparingly. CTAs, active nav, key links only.
- Stone is for everything secondary: labels, metadata, helper text.
- Linen for dividers and borders — warm, not cold gray.

---

## 3. Typography

| Token | Typeface | Weight | Usage |
|---|---|---|---|
| `font-display` | Cormorant Garamond | 300–400 | Page titles, card headings, reading titles |
| `font-body` | Jost | 300 | Body copy, labels, UI text, buttons |

**Rules:**
- Headings: Cormorant Garamond, weight 300 or 400. Never bold.
- Body: Jost, weight 300. Light throughout.
- No bold text anywhere. Weight contrast comes from size, not weight.
- Italic in Cormorant Garamond is allowed and encouraged for emphasis.
- Letter-spacing: `0.04em` on headings, `0` on body.
- No ALL CAPS.

---

## 4. Component Patterns

### Cards
- Background: slightly lighter than page — `rgba(255,255,255,0.03)` or a subtle border
- Border: `1px solid rgba(186,175,163,0.3)` (linen, low opacity)
- Padding: generous — `2rem` minimum
- No border radius beyond `2–4px` maximum
- No shadow

### Buttons / CTAs
- Primary: `--golden` text, no background — link style
- CTA links: `color: var(--golden)`, small arrow suffix (→), no underline by default
- Hover: underline or slight opacity shift
- No filled button backgrounds unless absolutely necessary
- No ALL CAPS labels

### Status indicators
- Ready state: `--golden` text, small dot or checkmark
- Pending: `--stone` text, muted
- Locked: `--stone`, no CTA

### Forms / Inputs
- Background: transparent or very dark
- Border: `1px solid rgba(186,175,163,0.4)` — linen
- Text: `--mist`
- Focus: border shifts to `--golden`
- Labels: Jost 300, `--stone`, above the field
- No placeholder-only labels

### Navigation / Header
- Background: same as page (`--smoke`)
- Title: Cormorant Garamond, `--linen`
- Sign out / utility: Jost 300, `--stone`
- User email: Jost 300, `--stone`, small

---

## 5. Layout Principles

- Max content width: `880px`, centred
- Page padding: `3rem 2rem`
- Card grid: auto-fill, `min 280px`, gap `1.5rem`
- Generous vertical spacing between sections — `3rem` minimum
- No tight layouts. Whitespace is part of the design.

---

## 6. Depth & Elevation

No traditional shadow system. Depth via:
- Subtle border (`1px solid rgba(186,175,163,0.3)`)
- Very slight background contrast between page and card
- Golden accent on interactive elements

---

## 7. Do's and Don'ts

**Do:**
- Use golden sparingly — only where action is needed
- Let whitespace do the work
- Use Cormorant Garamond italic for elegance
- Keep status copy short and calm ("Your reading is ready", "Complete your details")

**Don't:**
- Use bold or heavy type weights
- Add decorative elements (icons, dividers, badges)
- Use bright colors or high contrast
- Write ALL CAPS labels
- Add shadows or gradients
- Use more than two typefaces

---

## 8. Responsive Behavior

- Mobile: single column, cards stack vertically
- Padding reduces to `1.5rem 1rem` on small screens
- Typography scales down gracefully — Cormorant Garamond remains large and editorial even at `1.8rem`
- Touch targets: `44px` minimum

---

## 9. Agent Prompt Guide

**Quick color reference:**
- Smoke `#242324` — page background
- Mist `#F2F0E5` — primary text
- Golden `#9F8261` — accent, CTAs
- Linen `#D8CFB9` — borders, dividers
- Stone `#BAAFA3` — secondary text

**Ready-to-use prompts:**
- "Build a product card using the Cato portal design — smoke background, linen border, Cormorant Garamond heading in mist, stone status text, golden CTA link."
- "Create a login screen — centered, smoke background, Cormorant Garamond heading, Jost body, golden send button as a text link."
- "Design a dashboard header — Cormorant Garamond page title in linen, user email in stone, sign out in stone on the right."
