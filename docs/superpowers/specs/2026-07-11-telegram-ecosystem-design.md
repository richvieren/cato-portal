# Cato Telegram Ecosystem — Design Spec

## Overview

A Telegram bot (@CatoVermeulenBot) that delivers personalized daily business astrology transit alerts to premium clients, drip-feeds courses, and funnels free community members toward paid products. One bot, one ecosystem — connecting to the existing Supabase backend and running on the existing VPS.

## Goals

1. **Retention**: Keep premium clients engaged daily with personalized transit alerts
2. **Delivery**: Provide an alternative course delivery channel inside Telegram
3. **Conversion**: Upsell free Opulent channel members to paid products
4. **Stability**: Pre-generate all alert content at enrollment — daily send is just a queue read

## Non-Goals

- No Telegram Mini App (portal stays on web)
- No payment processing inside Telegram (Stripe/portal handles payments)
- No migration away from existing portal — Telegram is additive
- No real-time LLM calls at send time

---

## Ecosystem Structure

```
@CatoVermeulenBot (single bot — the brain)
│
├── FREE: Opulent Channel (t.me/+P3odk5KbKtthZTU0)
│   └── 242 subscribers, broadcast channel
│   └── Free value, cosmic weather, teasers → upsell to paid
│
├── PAID PROGRAM: Evergreen Queen (t.me/+Yqj4SndJokY1NzE8)
│   └── High-ticket, rolling enrollment, 6-month access
│   └── Members get personalized transit alerts via bot DMs
│
├── PAID PROGRAM: Legacy Leaders (t.me/+mHWarbHchI40ZWE0)
│   └── High-ticket, rolling enrollment, 6-month access
│   └── Members get personalized transit alerts via bot DMs
│
└── BOT DMs (1:1 with each user)
    └── Transit reading buyers → 3 months daily alerts
    └── Course buyers → drip-fed lessons
    └── Onboarding, upsells, support
```

## Entitlement Rules

| Client type | Alert duration | Source grant |
|---|---|---|
| Transit reading buyer | 3 months (90 days from `granted_at`) | `product = 'transit_reading'` |
| Evergreen Queen member | 6 months (180 days from `granted_at`) | `product = 'masterclass_eq'` |
| Legacy Leaders member | 6 months (180 days from `granted_at`) | `product = 'masterclass_ll'` |
| Blueprint buyer | No alerts (unless also bought transits) | — |
| Course buyer | Course lessons only, no transit alerts | `product = 'course'` |
| Free follower (Opulent) | No alerts, no courses | — |

Durations configurable. Initial values: 90 days (transit), 180 days (masterclass).

---

## Architecture

```
┌─────────────────────────┐
│   Supabase (existing)    │
│  - profiles              │
│  - access_grants         │
│  - natal_charts          │
│  - course_progress       │
│  - telegram_alerts (new) │
│  - course_lessons (new)  │
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│  VPS (161.97.100.134)    │
│  Contabo Cloud VPS 10    │
│  4 vCPU, 8GB RAM         │
│                          │
│  ┌─────────────────────┐ │
│  │ cato-bot (systemd)  │ │
│  │ Node.js + Grammy    │ │
│  │ - Webhook receiver  │ │
│  │ - Daily send cron   │ │
│  │ - Alert generator   │ │
│  └─────────────────────┘ │
│                          │
│  ┌─────────────────────┐ │
│  │ cato-blueprint      │ │
│  │ (existing pipeline) │ │
│  └─────────────────────┘ │
└───────────┬──────────────┘
            │
  ┌─────────┼─────────┐
  │         │         │
  ▼         ▼         ▼
Telegram  Astrology  GLM-5.2
Bot API   API (.io)  (OpenRouter)
```

### Tech Stack

- **Runtime**: Node.js 20+ (TypeScript)
- **Bot framework**: Grammy (MIT, free, TypeScript-native)
- **Database**: Supabase (existing project fdewbbrzetgqqsonpqvp)
- **Hosting**: Existing VPS (161.97.100.134), systemd service
- **Astrology**: astrology-api.io (existing account)
- **LLM**: GLM-5.2 via OpenRouter (existing key)
- **Scheduling**: node-cron (in-process)

### Why this stack

- Zero new infrastructure — everything already exists and is paid for
- Grammy bot process uses ~50-100MB RAM — trivial on an 8GB box
- Separate systemd service from reading pipeline — independent restarts
- Webhook mode (not polling) — more reliable, lower resource usage

---

## Supabase Schema Changes

### Existing table: `profiles`

Add column:
```sql
ALTER TABLE profiles ADD COLUMN telegram_chat_id BIGINT UNIQUE;
```

- Nullable — existing rows unaffected
- Unique constraint prevents duplicate Telegram links
- Set when user verifies email via bot

### Existing table: `access_grants`

Add column:
```sql
ALTER TABLE access_grants ADD COLUMN expires_at TIMESTAMPTZ;
```

- Nullable — existing grants (null) never expire
- Auto-set by webhook on purchase:
  - `transit_reading` → `NOW() + INTERVAL '90 days'`
  - `masterclass_eq` → `NOW() + INTERVAL '180 days'`
  - `masterclass_ll` → `NOW() + INTERVAL '180 days'`
  - All others → NULL (permanent)

### New table: `telegram_alerts`

```sql
CREATE TABLE telegram_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  send_date DATE NOT NULL,
  body_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telegram_alerts_send ON telegram_alerts(send_date, sent_at);
CREATE INDEX idx_telegram_alerts_user ON telegram_alerts(user_id);
```

- Pre-generated alerts stored with `send_date`
- `sent_at` null = not yet sent, filled when delivered
- Daily cron queries: `WHERE send_date = TODAY AND sent_at IS NULL`

### New table: `course_lessons`

```sql
CREATE TABLE course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  lesson_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  body_text TEXT NOT NULL,
  voice_note_url TEXT,
  image_url TEXT,
  drip_delay_hours INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(course_id, lesson_number)
);
```

- Each lesson is a row — Cato edits via bot commands or Supabase Studio
- `drip_delay_hours`: minimum time before next lesson unlocks (default 24h)
- `voice_note_url` / `image_url`: optional Supabase Storage URLs

### RLS Policies

- `telegram_alerts`: service role only (bot reads/writes with service key)
- `course_lessons`: service role for write, authenticated users for read (own course grants)
- All existing RLS policies untouched

---

## Alert Generation Pipeline (at enrollment)

```
Trigger: new access_grant with product in (transit_reading, masterclass_eq, masterclass_ll)
│
├── 1. Calculate alert period:
│      start = tomorrow
│      end = expires_at
│      days = end - start
│
├── 2. Get natal chart from natal_charts table (already computed)
│
├── 3. Call astrology API: ephemeris for full period
│      (planetary positions for each day in the range)
│
├── 4. For each day, determine significant transits:
│      - Planet enters new sign
│      - Transit planet conjuncts/opposes/squares natal planet
│      - Moon phase (new/full) in relevant house
│      - Retrograde stations
│
├── 5. GLM-5.2 batch generation:
│      System prompt: Cato's mentoring voice (from VPS reading prompt)
│      For each day with significant transits:
│        Generate 2-3 sentence personalized business tip
│      For quiet days:
│        Generate a general energy/focus message
│
├── 6. Insert all alerts into telegram_alerts table
│      (one row per day, send_date set, sent_at null)
│
└── 7. Done. Daily cron handles delivery from here.
```

### Cost per user

- Astrology API (ephemeris batch): ~$0.01
- GLM-5.2 (90 messages at ~$0.015 each): ~$1.35
- **Total per 3-month enrollment: ~$1.50**
- **Total per 6-month enrollment: ~$3.00**

### GLM-5.2 prompt structure

```
System: You are Cato Vermeulen's astrology advisor. Write in a warm,
direct mentoring voice. No fluff. 2-3 sentences max per alert.
Business context only — every transit interpretation relates to
business decisions, timing, visibility, or energy management.
Do not overthink. Write directly.

User:
Client natal chart: Sun in Cancer (4th house), Moon in Libra (7th),
Rising Scorpio, Mercury in Gemini (8th)...

Today's transits (July 15, 2026):
- Transit Venus conjunct natal Midheaven (exact, 0°03' orb)
- Transit Mars in Virgo squares natal Saturn in Gemini

Write a personalized business transit alert for today.
```

### Alert voice examples (mentoring tone)

> "Venus crosses your Midheaven today. Your visibility is heightened — if you've been sitting on a launch or a pitch, this is your window. Trust the pull toward being seen."

> "Mars squares your Saturn. Frustration with slow progress is real today. Don't force outcomes. The tension is building the discipline you'll need next week."

> "Quiet day transit-wise. Good energy for deep work and clearing your admin backlog. Nothing major pulling your attention — use that."

---

## Daily Send Cron

```
Runs: 7:00 AM (UTC+2, South Africa time — configurable)

1. Query telegram_alerts:
   WHERE send_date = CURRENT_DATE
   AND sent_at IS NULL

2. For each alert:
   a. Look up profiles.telegram_chat_id for the user
   b. If no chat_id (user hasn't linked yet): skip
   c. Send via Telegram Bot API (protect_content: true)
   d. On success: UPDATE sent_at = NOW()
   e. On failure (user blocked bot): mark chat_id inactive

3. Rate limiting:
   - 100ms delay between sends
   - 50 users = ~5 seconds total
   - Well within Telegram's 30 msg/sec limit
```

No LLM calls. No API calls. Just database reads and Telegram sends. Bulletproof.

---

## Bot Onboarding Flow

```
/start or deep link (t.me/CatoVermeulenBot?start=...)
│
├── Bot: "Welcome! I'm Cato's astrology bot. I deliver personalized
│    transit alerts and course lessons based on your chart.
│
│    To connect your account, what's the email you used at checkout?"
│
├── User sends email
│
├── Bot queries Supabase (profiles table by email):
│   │
│   ├── FOUND + active transit/masterclass grant:
│   │   → Save telegram_chat_id to profiles
│   │   → "You're verified! Your daily transit alerts start
│   │      tomorrow morning at 7am. Sit tight."
│   │
│   ├── FOUND + no active transit/masterclass grant:
│   │   → Save telegram_chat_id anyway (for future purchases)
│   │   → "I found your account! You don't have an active
│   │      transit subscription yet. Here's what's available:"
│   │   → [Product menu with links to portal]
│   │
│   └── NOT FOUND:
│       → "I couldn't find that email. Make sure it's the one
│          you used at checkout. Try again or contact
│          hello@catovermeulen.com"
│
└── No birth data collection needed — natal_charts already
    computed from portal intake.
```

### Deep links

- From Opulent channel teasers: `t.me/CatoVermeulenBot?start=opulent`
- From email after purchase: `t.me/CatoVermeulenBot?start=activate`
- From Evergreen Queen group: `t.me/CatoVermeulenBot?start=eq`
- From Legacy Leaders group: `t.me/CatoVermeulenBot?start=ll`

Deep link payload tracked for analytics (which source drives activations).

---

## Course Delivery

### Lesson flow (in bot DMs)

```
Grant created for course → bot detects (webhook or poll)
│
├── Bot: "📚 Your [Course Name] is ready! Tap to start."
│   [▶️ Start Lesson 1]
│
├── User taps → bot sends Lesson 1:
│   - body_text (protect_content: true)
│   - voice_note if exists (protect_content: true)
│   - image if exists (protect_content: true)
│   - Inline keyboard: [✅ Complete] [❓ Question]
│
├── User taps "Complete":
│   - course_progress row inserted
│   - If drip_delay_hours > 0:
│     "Lesson 2 unlocks in [X hours]. I'll ping you!"
│   - After delay: bot sends next lesson notification
│
├── User taps "Question":
│   - "Type your question and I'll pass it to Cato."
│   - Question saved/forwarded to Cato's DM or a dedicated channel
│
└── After final lesson:
    "You've completed [Course Name]! 🎉
     Ready for the next level? [Upsell options]"
```

### Content management (two interfaces)

**A) Bot admin commands (for Cato):**
```
/admin addlesson <course_id> <lesson_number> <title>
[Cato sends text as next message]
[Optionally sends voice note]
[Optionally sends image]
/admin listlessons <course_id>
/admin editlesson <lesson_id>
/admin deletelesson <lesson_id>
```

Only works for Cato's Telegram user ID (hardcoded admin check).

**B) Supabase Studio (for Richard):**
Direct table editing at https://supabase.com/dashboard/project/fdewbbrzetgqqsonpqvp/editor

Both write to the same `course_lessons` table.

### Content protection

- Every lesson message sent with `protect_content: true`
- Cannot be forwarded
- Cannot be copy-pasted
- Screenshots blocked on mobile
- Drip-fed (can't access lesson N+1 until N is complete)
- Course content never posted in any channel/group — DMs only

---

## Free Community → Upsell Flow

### Opulent channel teasers (automated, configurable)

Bot posts to the Opulent channel on a schedule (e.g., every Monday):

> "This week Mercury enters Virgo — the detail-obsessed zone. If you've been procrastinating on your SOPs, systems, or backend cleanup... this is your week.
>
> Want to know how this hits YOUR specific chart?
> → Start @CatoVermeulenBot"

These are pre-written by Cato (or generated in batch) and scheduled. Not personalized — they're generic teasers for the public channel.

### Bot product menu

When an unsubscribed user starts the bot:

```
[Inline keyboard]
🔮 Transit Reading (3 months of daily alerts) → portal link
👑 Evergreen Queen (6-month program) → portal link
🦁 Legacy Leaders (6-month program) → portal link
📚 Introduction Course → portal link
```

Bot links to existing Stripe/portal purchase flow. After purchase, webhook creates grant, bot auto-detects and activates.

---

## Existing Client Backfill

For clients who already have active grants but haven't been receiving alerts:

### Process

1. Query all users with active (non-expired) transit/masterclass grants
2. Calculate remaining days until `expires_at` (or `granted_at + 90/180 days` if `expires_at` not yet set)
3. Run the alert generation pipeline for remaining days only
4. Store in `telegram_alerts` with appropriate `send_date` values
5. Alerts sit waiting — delivered once user links Telegram via bot

### Triggering adoption

Cato posts in Evergreen Queen and Legacy Leaders groups:
> "I've set up personalized daily transit alerts just for you. Start @CatoVermeulenBot and verify your email to activate them."

No pressure. Those who link get alerts from the next morning. Those who don't — the content waits.

### Edge cases

- Client with <7 days remaining: still generate alerts (even 1 day of value is value)
- Client who never linked Telegram: alerts expire silently after `send_date` passes
- Client who links Telegram after some alerts expired: starts from today, doesn't get past dates

---

## Error Handling

| Scenario | Response |
|---|---|
| GLM-5.2 fails during generation | Retry once. If still fails, generate template-based alert (transit description without personalized interpretation). Flag for manual review. |
| Astrology API fails during generation | Retry with exponential backoff (3 attempts). If all fail, delay generation and retry next hour via cron. |
| User blocks bot | Telegram returns 403. Mark `telegram_chat_id` as inactive. Don't retry. |
| User unlinks/relinks | Old chat_id overwritten. Alerts resume from next send cycle. |
| VPS restarts | systemd auto-restarts bot service. Missed alerts caught on next cron run (queries all unsent for today). |
| Duplicate sends | `sent_at` field prevents double-delivery. Cron only picks up `sent_at IS NULL`. |

---

## Security

- Bot token stored as environment variable on VPS (not in code)
- Supabase service role key stored as environment variable on VPS
- OpenRouter API key stored as environment variable on VPS
- Admin commands restricted to Cato's Telegram user ID
- No user data exposed through bot (only sends to verified accounts)
- Email verification before linking — prevents someone claiming another user's alerts
- `protect_content: true` on all premium messages

---

## File Structure (on VPS)

```
/opt/cato-bot/
├── src/
│   ├── bot.ts              — Grammy bot setup, command handlers
│   ├── commands/
│   │   ├── start.ts        — Onboarding flow
│   │   ├── admin.ts        — Admin commands (lesson management)
│   │   └── menu.ts         — Product menu / upsell
│   ├── cron/
│   │   ├── send-alerts.ts  — Daily 7am alert sender
│   │   └── generate-alerts.ts — Alert generation on new grant
│   ├── services/
│   │   ├── supabase.ts     — DB queries
│   │   ├── astrology.ts    — Astrology API calls
│   │   ├── glm.ts          — OpenRouter/GLM-5.2 calls
│   │   └── telegram.ts     — Message formatting helpers
│   └── config.ts           — Environment vars, constants
├── package.json
├── tsconfig.json
├── .env                    — API keys (not in git)
└── ecosystem.config.js    — PM2 or systemd config
```

---

## Costs

### Per-user costs (one-time at enrollment)

| Item | 3 months (transit) | 6 months (masterclass) |
|---|---|---|
| Astrology API | $0.01 | $0.01 |
| GLM-5.2 (alert generation) | $1.35 | $2.70 |
| **Total** | **$1.36** | **$2.71** |

### Monthly operational costs

| Item | Cost |
|---|---|
| VPS | $0 (already paid) |
| Grammy | $0 (MIT, free) |
| Telegram Bot API | $0 (free) |
| Supabase | $0 (already on paid plan) |
| Daily sends (Telegram) | $0 |
| **Total monthly** | **$0** |

### At scale (100 users)

- Backfill generation: ~$150 one-time
- New enrollments: $1.36-$2.71 per user
- Monthly operational: $0

---

## Future Considerations (not in scope)

- Telegram Stars for micro-purchases (paid single alerts, one-off readings)
- Paid subscription tier via InviteMember for the premium channel
- Voice message alerts (Cato records, bot sends)
- Community bot features in Evergreen Queen / Legacy Leaders groups
- WhatsApp fallback for clients not on Telegram
- Multi-language support
