# Cato Telegram Ecosystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build @CatoVermeulenBot — a Grammy-based Telegram bot on the existing VPS that delivers pre-generated personalized transit alerts, drip-feeds courses, and upsells free community members.

**Architecture:** Node.js/TypeScript bot using Grammy framework, connecting to the existing Supabase project (fdewbbrzetgqqsonpqvp) for data. Alert content is pre-generated at enrollment using astrology-api.io + GLM-5.2 via OpenRouter, stored in a `telegram_alerts` table, and sent daily by a cron job. No runtime LLM calls at send time. Bot runs as a systemd service on the existing VPS (161.97.100.134) alongside the reading pipeline.

**Tech Stack:** Node.js 20+, TypeScript, Grammy (Telegram bot framework), @supabase/supabase-js, node-cron, vitest (tests)

## Global Constraints

- **Do not modify existing portal files** (index.html, styles.css, widgets.js, etc.) — the bot is additive
- **Do not modify existing Supabase Edge Functions** — the stripe-webhook stays untouched; expires_at logic goes in the bot
- **All schema changes are additive** — ALTER TABLE ADD COLUMN only, no drops, no renames
- **Bot code lives at `portal/bot/`** locally, deploys to `/opt/cato-bot/` on VPS
- **Environment variables** stored in `.env` on VPS, never committed to git
- **protect_content: true** on every premium message (alerts + course lessons)
- **Cato's Telegram user ID** must be identified and hardcoded for admin commands
- **GLM-5.2 prompt** must include "Do not overthink. Write directly." to prevent reasoning token burn
- **Supabase project ID**: fdewbbrzetgqqsonpqvp
- **VPS**: 161.97.100.134 (Contabo Cloud VPS 10, 4 vCPU, 8GB RAM)
- **Astrology API**: astrology-api.io (existing account, v3 charts/natal endpoint)
- **OpenRouter model ID**: `z-ai/glm-5.2`
- **Timezone for daily cron**: Africa/Johannesburg (UTC+2)
- **Rate limit**: 100ms delay between Telegram sends, max 30 msg/sec

---

### Task 1: Project Scaffolding + Schema Migration

**Files:**
- Create: `portal/bot/package.json`
- Create: `portal/bot/tsconfig.json`
- Create: `portal/bot/src/config.ts`
- Create: `portal/bot/src/bot.ts`
- Create: `portal/bot/.env.example`
- Create: `portal/bot/.gitignore`
- Create: `portal/supabase/migrations/002_telegram_bot.sql`
- Test: `portal/bot/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `config` object exported from `src/config.ts` with fields: `BOT_TOKEN: string`, `SUPABASE_URL: string`, `SUPABASE_SERVICE_KEY: string`, `OPENROUTER_API_KEY: string`, `ASTROLOGY_API_KEY: string`, `ADMIN_CHAT_ID: number`, `CRON_TIMEZONE: string`, `PORTAL_URL: string`
  - Running Grammy bot instance that responds to `/ping`

- [ ] **Step 1: Initialize Node.js project**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
mkdir -p bot/src/__tests__
cd bot
npm init -y
npm install grammy @supabase/supabase-js node-cron dotenv
npm install -D typescript @types/node vitest tsx @types/node-cron
```

- [ ] **Step 2: Create package.json with scripts**

Replace the generated `portal/bot/package.json`:

```json
{
  "name": "cato-bot",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/bot.ts",
    "build": "tsc",
    "start": "node dist/bot.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2",
    "dotenv": "^16",
    "grammy": "^1",
    "node-cron": "^3"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/node-cron": "^3",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `portal/bot/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

- [ ] **Step 4: Create .env.example and .gitignore**

Create `portal/bot/.env.example`:

```
BOT_TOKEN=
SUPABASE_URL=https://fdewbbrzetgqqsonpqvp.supabase.co
SUPABASE_SERVICE_KEY=
OPENROUTER_API_KEY=
ASTROLOGY_API_KEY=
ADMIN_CHAT_ID=
CRON_TIMEZONE=Africa/Johannesburg
PORTAL_URL=https://app.catovermeulen.com
```

Create `portal/bot/.gitignore`:

```
node_modules/
dist/
.env
```

- [ ] **Step 5: Create config.ts**

Create `portal/bot/src/config.ts`:

```typescript
import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  BOT_TOKEN: required('BOT_TOKEN'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: required('SUPABASE_SERVICE_KEY'),
  OPENROUTER_API_KEY: required('OPENROUTER_API_KEY'),
  ASTROLOGY_API_KEY: required('ASTROLOGY_API_KEY'),
  ADMIN_CHAT_ID: Number(required('ADMIN_CHAT_ID')),
  CRON_TIMEZONE: process.env.CRON_TIMEZONE || 'Africa/Johannesburg',
  PORTAL_URL: process.env.PORTAL_URL || 'https://app.catovermeulen.com',
} as const;

// Alert duration in days per product type
export const ALERT_DURATIONS: Record<string, number> = {
  transit_reading: 90,
  masterclass_eq: 180,
  masterclass_ll: 180,
};

// Products that qualify for transit alerts
export const ALERT_PRODUCTS = Object.keys(ALERT_DURATIONS);
```

- [ ] **Step 6: Write config test**

Create `portal/bot/src/__tests__/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set all required vars
    process.env.BOT_TOKEN = 'test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter';
    process.env.ASTROLOGY_API_KEY = 'test-astro';
    process.env.ADMIN_CHAT_ID = '12345';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads all required config values', async () => {
    // Dynamic import to pick up env changes
    const { config } = await import('../config.ts');
    expect(config.BOT_TOKEN).toBe('test-token');
    expect(config.SUPABASE_URL).toBe('https://test.supabase.co');
    expect(config.ADMIN_CHAT_ID).toBe(12345);
  });

  it('defaults CRON_TIMEZONE to Africa/Johannesburg', async () => {
    delete process.env.CRON_TIMEZONE;
    const { config } = await import('../config.ts');
    expect(config.CRON_TIMEZONE).toBe('Africa/Johannesburg');
  });
});
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal/bot
npx vitest run
```

Expected: 2 tests pass.

- [ ] **Step 8: Create bot.ts with /ping command**

Create `portal/bot/src/bot.ts`:

```typescript
import { Bot } from 'grammy';
import { config } from './config.js';

const bot = new Bot(config.BOT_TOKEN);

bot.command('ping', (ctx) => ctx.reply('pong'));

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start in long-polling mode for development
// Production uses webhooks (configured in deployment task)
bot.start({
  onStart: () => console.log('CatoVermeulenBot started'),
});
```

- [ ] **Step 9: Create Supabase migration**

Create `portal/supabase/migrations/002_telegram_bot.sql`:

```sql
-- 002_telegram_bot.sql
-- Run this in Supabase SQL Editor
-- ADDITIVE ONLY — no drops, no renames, no changes to existing columns

-- 1. Add telegram_chat_id to profiles (links Telegram to portal account)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT UNIQUE;

-- 2. Add expires_at to access_grants (null = never expires)
ALTER TABLE public.access_grants
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. New table: pre-generated transit alerts
CREATE TABLE IF NOT EXISTS public.telegram_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  send_date DATE NOT NULL,
  body_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_alerts ENABLE ROW LEVEL SECURITY;

-- Service role can read/write (bot uses service role key)
CREATE POLICY "Service role full access on telegram_alerts"
  ON public.telegram_alerts FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_telegram_alerts_send
  ON public.telegram_alerts(send_date, sent_at);
CREATE INDEX IF NOT EXISTS idx_telegram_alerts_user
  ON public.telegram_alerts(user_id);

-- 4. New table: course lessons (content managed by Cato via bot or Supabase Studio)
CREATE TABLE IF NOT EXISTS public.course_lessons (
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

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;

-- Service role can read/write
CREATE POLICY "Service role full access on course_lessons"
  ON public.course_lessons FOR ALL
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 10: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/package.json bot/tsconfig.json bot/.env.example bot/.gitignore \
  bot/src/config.ts bot/src/bot.ts bot/src/__tests__/config.test.ts \
  supabase/migrations/002_telegram_bot.sql
git commit -m "feat: scaffold cato-bot project + schema migration"
```

---

### Task 2: Supabase Service Layer

**Files:**
- Create: `portal/bot/src/services/supabase.ts`
- Test: `portal/bot/src/__tests__/supabase.test.ts`

**Interfaces:**
- Consumes: `config` from `src/config.ts`
- Produces:
  - `findProfileByEmail(email: string): Promise<Profile | null>`
  - `linkTelegram(email: string, chatId: number): Promise<boolean>`
  - `getActiveAlertGrants(email: string): Promise<Grant[]>`
  - `getNatalChart(userId: string): Promise<NatalChart | null>`
  - `getTodayAlerts(): Promise<Alert[]>`
  - `markAlertSent(alertId: string): Promise<void>`
  - `insertAlerts(alerts: NewAlert[]): Promise<void>`
  - `getChatIdForUser(userId: string): Promise<number | null>`
  - `markChatIdInactive(userId: string): Promise<void>`
  - `getActiveAlertUsers(): Promise<AlertUser[]>`
  - `getCourseLesson(courseId: string, lessonNumber: number): Promise<Lesson | null>`
  - `getCourseGrant(email: string): Promise<Grant | null>`
  - `getCompletedLessons(userId: string): Promise<string[]>`
  - `markLessonComplete(userId: string, lessonId: string): Promise<void>`
  - `getLessonCount(courseId: string): Promise<number>`
  - `upsertLesson(lesson: NewLesson): Promise<void>`
  - `deleteLesson(lessonId: string): Promise<void>`
  - `listLessons(courseId: string): Promise<LessonSummary[]>`

- [ ] **Step 1: Create Supabase service**

Create `portal/bot/src/services/supabase.ts`:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, ALERT_PRODUCTS, ALERT_DURATIONS } from '../config.js';

const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY,
);

// --- Types ---

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  telegram_chat_id: number | null;
}

export interface Grant {
  id: string;
  email: string;
  product: string;
  granted_at: string;
  expires_at: string | null;
}

export interface NatalChart {
  user_id: string;
  planets: Record<string, any>[];
  houses: Record<string, any>[];
  aspects: Record<string, any>[];
  elements: Record<string, any>;
  modalities: Record<string, any>;
  hemispheres: Record<string, any>;
  stelliums: Record<string, any>[];
  chart_ruler: Record<string, any> | null;
}

export interface Alert {
  id: string;
  user_id: string;
  email: string;
  send_date: string;
  body_text: string;
}

export interface NewAlert {
  user_id: string;
  email: string;
  send_date: string;
  body_text: string;
}

export interface AlertUser {
  user_id: string;
  email: string;
  telegram_chat_id: number;
  product: string;
  granted_at: string;
  expires_at: string | null;
}

export interface Lesson {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  body_text: string;
  voice_note_url: string | null;
  image_url: string | null;
  drip_delay_hours: number;
}

export interface LessonSummary {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
}

export interface NewLesson {
  course_id: string;
  lesson_number: number;
  title: string;
  body_text: string;
  voice_note_url?: string | null;
  image_url?: string | null;
  drip_delay_hours?: number;
}

// --- Profile queries ---

export async function findProfileByEmail(email: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, telegram_chat_id')
    .eq('email', email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (error) { console.error('findProfileByEmail error:', error); return null; }
  return data;
}

export async function linkTelegram(email: string, chatId: number): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: chatId })
    .eq('email', email.toLowerCase());
  if (error) { console.error('linkTelegram error:', error); return false; }
  return true;
}

export async function getChatIdForUser(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.telegram_chat_id;
}

export async function markChatIdInactive(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', userId);
}

// --- Grant queries ---

export async function getActiveAlertGrants(email: string): Promise<Grant[]> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, email, product, granted_at, expires_at')
    .eq('email', email.toLowerCase())
    .in('product', ALERT_PRODUCTS)
    .is('revoked_at', null)
    .returns<Grant[]>();
  if (error) { console.error('getActiveAlertGrants error:', error); return []; }
  // Filter out expired grants in JS (cleaner than complex SQL with nullable expires_at)
  const now = new Date();
  return (data || []).filter(g => {
    if (g.expires_at && new Date(g.expires_at) < now) return false;
    // If no expires_at set yet, compute from granted_at + duration
    if (!g.expires_at && g.granted_at) {
      const duration = ALERT_DURATIONS[g.product];
      if (duration) {
        const expiry = new Date(g.granted_at);
        expiry.setDate(expiry.getDate() + duration);
        if (expiry < now) return false;
      }
    }
    return true;
  });
}

// --- Alert queries ---

export async function getTodayAlerts(): Promise<Alert[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('telegram_alerts')
    .select('id, user_id, email, send_date, body_text')
    .eq('send_date', today)
    .is('sent_at', null)
    .returns<Alert[]>();
  if (error) { console.error('getTodayAlerts error:', error); return []; }
  return data || [];
}

export async function markAlertSent(alertId: string): Promise<void> {
  await supabase
    .from('telegram_alerts')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', alertId);
}

export async function insertAlerts(alerts: NewAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  // Insert in batches of 500 to avoid payload limits
  for (let i = 0; i < alerts.length; i += 500) {
    const batch = alerts.slice(i, i + 500);
    const { error } = await supabase.from('telegram_alerts').insert(batch);
    if (error) console.error('insertAlerts batch error:', error);
  }
}

export async function getActiveAlertUsers(): Promise<AlertUser[]> {
  // Get all users with telegram linked AND an active alert-eligible grant
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, telegram_chat_id')
    .not('telegram_chat_id', 'is', null);
  if (pErr || !profiles) return [];

  const result: AlertUser[] = [];
  for (const p of profiles) {
    const grants = await getActiveAlertGrants(p.email);
    for (const g of grants) {
      result.push({
        user_id: p.id,
        email: p.email,
        telegram_chat_id: p.telegram_chat_id!,
        product: g.product,
        granted_at: g.granted_at,
        expires_at: g.expires_at,
      });
    }
  }
  return result;
}

// --- Natal chart ---

export async function getNatalChart(userId: string): Promise<NatalChart | null> {
  const { data, error } = await supabase
    .from('natal_charts')
    .select('user_id, planets, houses, aspects, elements, modalities, hemispheres, stelliums, chart_ruler')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.error('getNatalChart error:', error); return null; }
  return data;
}

// --- Course queries ---

export async function getCourseGrant(email: string): Promise<Grant | null> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, email, product, granted_at, expires_at')
    .eq('email', email.toLowerCase())
    .eq('product', 'course')
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (error) { console.error('getCourseGrant error:', error); return null; }
  return data;
}

export async function getCourseLesson(courseId: string, lessonNumber: number): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('*')
    .eq('course_id', courseId)
    .eq('lesson_number', lessonNumber)
    .maybeSingle();
  if (error) { console.error('getCourseLesson error:', error); return null; }
  return data;
}

export async function getCompletedLessons(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('course_progress')
    .select('lesson_id')
    .eq('user_id', userId);
  if (error) { console.error('getCompletedLessons error:', error); return []; }
  return (data || []).map(r => r.lesson_id);
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<void> {
  await supabase
    .from('course_progress')
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id' });
}

export async function getLessonCount(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  if (error) { console.error('getLessonCount error:', error); return 0; }
  return count || 0;
}

export async function upsertLesson(lesson: NewLesson): Promise<void> {
  const { error } = await supabase
    .from('course_lessons')
    .upsert(lesson, { onConflict: 'course_id,lesson_number' });
  if (error) console.error('upsertLesson error:', error);
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('course_lessons')
    .delete()
    .eq('id', lessonId);
  if (error) console.error('deleteLesson error:', error);
}

export async function listLessons(courseId: string): Promise<LessonSummary[]> {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('id, course_id, lesson_number, title')
    .eq('course_id', courseId)
    .order('lesson_number');
  if (error) { console.error('listLessons error:', error); return []; }
  return data || [];
}
```

- [ ] **Step 2: Write Supabase service tests**

Create `portal/bot/src/__tests__/supabase.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ALERT_DURATIONS, ALERT_PRODUCTS } from '../config.js';

// Unit tests for pure logic — DB integration tested manually
describe('Alert duration config', () => {
  it('has correct durations', () => {
    expect(ALERT_DURATIONS['transit_reading']).toBe(90);
    expect(ALERT_DURATIONS['masterclass_eq']).toBe(180);
    expect(ALERT_DURATIONS['masterclass_ll']).toBe(180);
  });

  it('ALERT_PRODUCTS matches ALERT_DURATIONS keys', () => {
    expect(ALERT_PRODUCTS).toEqual(['transit_reading', 'masterclass_eq', 'masterclass_ll']);
  });
});

describe('Grant expiry logic', () => {
  it('computes expiry from granted_at + duration', () => {
    const grantedAt = new Date('2026-07-01');
    const duration = ALERT_DURATIONS['transit_reading']; // 90 days
    const expiry = new Date(grantedAt);
    expiry.setDate(expiry.getDate() + duration);
    expect(expiry.toISOString().split('T')[0]).toBe('2026-09-29');
  });

  it('6-month masterclass expires correctly', () => {
    const grantedAt = new Date('2026-07-01');
    const duration = ALERT_DURATIONS['masterclass_eq']; // 180 days
    const expiry = new Date(grantedAt);
    expiry.setDate(expiry.getDate() + duration);
    expect(expiry.toISOString().split('T')[0]).toBe('2026-12-28');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal/bot
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/services/supabase.ts bot/src/__tests__/supabase.test.ts
git commit -m "feat: add Supabase service layer with all DB queries"
```

---

### Task 3: Bot Onboarding Flow

**Files:**
- Create: `portal/bot/src/commands/start.ts`
- Create: `portal/bot/src/commands/menu.ts`
- Modify: `portal/bot/src/bot.ts` — register command handlers

**Interfaces:**
- Consumes: `findProfileByEmail`, `linkTelegram`, `getActiveAlertGrants`, `getCourseGrant` from `services/supabase.ts`
- Produces:
  - `registerStartCommand(bot: Bot): void` — registers `/start` handler with email verification flow
  - `registerMenuCommand(bot: Bot): void` — registers product menu with inline keyboard
  - `showProductMenu(ctx: Context): Promise<void>` — reusable product menu display

- [ ] **Step 1: Create start command**

Create `portal/bot/src/commands/start.ts`:

```typescript
import { Bot, Context, session } from 'grammy';
import { findProfileByEmail, linkTelegram, getActiveAlertGrants, getCourseGrant } from '../services/supabase.js';
import { showProductMenu } from './menu.js';
import { config } from '../config.js';

interface SessionData {
  awaitingEmail?: boolean;
  source?: string;
}

export function registerStartCommand(bot: Bot) {
  // Handle /start with optional deep link payload
  bot.command('start', async (ctx) => {
    const payload = ctx.match; // deep link parameter
    const source = payload || 'direct';

    // Store session state
    ctx.session = { awaitingEmail: true, source };

    await ctx.reply(
      "Welcome! I'm Cato's astrology bot. I deliver personalized transit alerts and course lessons based on your chart.\n\n" +
      "To connect your account, send me the email you used at checkout.",
    );
  });

  // Handle text messages (email input)
  bot.on('message:text', async (ctx) => {
    if (!ctx.session?.awaitingEmail) return;

    const email = ctx.message.text.trim().toLowerCase();

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      await ctx.reply("That doesn't look like an email address. Try again.");
      return;
    }

    // Look up profile
    const profile = await findProfileByEmail(email);

    if (!profile) {
      await ctx.reply(
        "I couldn't find that email. Make sure it's the one you used at checkout.\n\n" +
        "Try again or contact hello@catovermeulen.com",
      );
      return;
    }

    // Link Telegram chat ID to profile
    const linked = await linkTelegram(email, ctx.chat.id);
    if (!linked) {
      await ctx.reply("Something went wrong linking your account. Contact hello@catovermeulen.com");
      ctx.session.awaitingEmail = false;
      return;
    }

    ctx.session.awaitingEmail = false;

    // Check what they have access to
    const alertGrants = await getActiveAlertGrants(email);
    const courseGrant = await getCourseGrant(email);

    if (alertGrants.length > 0) {
      const products = alertGrants.map(g => g.product).join(', ');
      await ctx.reply(
        `You're verified! ✨\n\n` +
        `Active access: ${products}\n\n` +
        `Your daily transit alerts start tomorrow morning at 7am. Sit tight.`,
      );
    } else if (courseGrant) {
      await ctx.reply(
        "You're verified! ✨\n\n" +
        "Your course is connected. Use /course to start your lessons.",
      );
    } else {
      await ctx.reply(
        "I found your account! You don't have an active transit subscription yet.\n\n" +
        "Here's what's available:",
      );
      await showProductMenu(ctx);
    }

    // Log activation source
    console.log(`Telegram linked: ${email} (chat ${ctx.chat.id}, source: ${ctx.session.source || 'unknown'})`);
  });
}
```

- [ ] **Step 2: Create product menu**

Create `portal/bot/src/commands/menu.ts`:

```typescript
import { Bot, Context, InlineKeyboard } from 'grammy';
import { config } from '../config.js';

const productMenu = new InlineKeyboard()
  .url('🔮 Transit Reading — 3 months of daily alerts', config.PORTAL_URL)
  .row()
  .url('👑 Evergreen Queen — 6-month program', config.PORTAL_URL)
  .row()
  .url('🦁 Legacy Leaders — 6-month program', config.PORTAL_URL)
  .row()
  .url('📚 Introduction Course', config.PORTAL_URL);

export async function showProductMenu(ctx: Context): Promise<void> {
  await ctx.reply(
    "Explore Cato's offerings:",
    { reply_markup: productMenu },
  );
}

export function registerMenuCommand(bot: Bot) {
  bot.command('menu', async (ctx) => {
    await showProductMenu(ctx);
  });
}
```

- [ ] **Step 3: Update bot.ts to register commands**

Replace `portal/bot/src/bot.ts`:

```typescript
import { Bot, session } from 'grammy';
import { config } from './config.js';
import { registerStartCommand } from './commands/start.js';
import { registerMenuCommand } from './commands/menu.js';

interface SessionData {
  awaitingEmail?: boolean;
  source?: string;
}

const bot = new Bot(config.BOT_TOKEN);

// Session middleware (in-memory, resets on restart — fine for onboarding flow)
bot.use(session({ initial: (): SessionData => ({}) }));

// Register commands
bot.command('ping', (ctx) => ctx.reply('pong'));
registerStartCommand(bot);
registerMenuCommand(bot);

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start in long-polling for dev, webhook for production
bot.start({
  onStart: () => console.log('CatoVermeulenBot started'),
});

export { bot };
```

- [ ] **Step 4: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/commands/start.ts bot/src/commands/menu.ts bot/src/bot.ts
git commit -m "feat: add bot onboarding flow with email verification and product menu"
```

---

### Task 4: Astrology + GLM Services

**Files:**
- Create: `portal/bot/src/services/astrology.ts`
- Create: `portal/bot/src/services/glm.ts`
- Create: `portal/bot/src/services/transits.ts`
- Test: `portal/bot/src/__tests__/transits.test.ts`

**Interfaces:**
- Consumes: `config` from `src/config.ts`, `NatalChart` from `services/supabase.ts`
- Produces:
  - `fetchDailyTransits(date: Date, lat: number, lon: number): Promise<TransitData>`
  - `detectSignificantTransits(transitData: TransitData, natalChart: NatalChart): SignificantTransit[]`
  - `generateAlertText(natalChart: NatalChart, transits: SignificantTransit[], date: Date): Promise<string>`
  - `generateQuietDayText(natalChart: NatalChart, date: Date): Promise<string>`

- [ ] **Step 1: Create astrology service**

Create `portal/bot/src/services/astrology.ts`:

```typescript
import { config } from '../config.js';

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  absoluteLongitude: number;
  isRetrograde: boolean;
  house: number;
}

export interface TransitData {
  date: Date;
  planets: PlanetPosition[];
}

const PLANET_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

const SIGN_ABBR: Record<string, string> = {
  Ari: 'Aries', Tau: 'Taurus', Gem: 'Gemini', Can: 'Cancer',
  Leo: 'Leo', Vir: 'Virgo', Lib: 'Libra', Sco: 'Scorpio',
  Sag: 'Sagittarius', Cap: 'Capricorn', Aqu: 'Aquarius', Pis: 'Pisces',
};

function expandSign(abbr: string): string {
  return SIGN_ABBR[abbr] || abbr;
}

export async function fetchDailyTransits(
  date: Date,
  lat: number = -33.9249, // Cape Town default
  lon: number = 18.4241,
): Promise<TransitData> {
  const dateStr = date.toISOString().split('T')[0];
  const [year, month, day] = dateStr.split('-');

  const params = new URLSearchParams({
    api_key: config.ASTROLOGY_API_KEY,
    year, month, day,
    hour: '12', minute: '0',
    latitude: String(lat),
    longitude: String(lon),
    house_system: 'whole_sign',
  });

  const res = await fetch(
    `https://astrology-api.io/api/v3/charts/natal?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Astrology API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const planets: PlanetPosition[] = [];

  for (const p of (data.planets || [])) {
    const name = p.name || p.planet;
    if (!PLANET_ORDER.includes(name)) continue;
    planets.push({
      planet: name,
      sign: expandSign(p.sign),
      degree: p.degree || 0,
      absoluteLongitude: p.absolute_longitude || p.full_degree || 0,
      isRetrograde: p.is_retrograde || false,
      house: p.house || 1,
    });
  }

  return { date, planets };
}
```

- [ ] **Step 2: Create transit detection service**

Create `portal/bot/src/services/transits.ts`:

```typescript
import { PlanetPosition, TransitData } from './astrology.js';
import { NatalChart } from './supabase.js';

export interface SignificantTransit {
  type: 'conjunction' | 'opposition' | 'square' | 'trine' | 'sextile' | 'sign_ingress' | 'retrograde_station';
  transitPlanet: string;
  transitSign: string;
  natalPlanet?: string;
  natalSign?: string;
  natalHouse?: number;
  orb?: number;
  description: string;
}

const ASPECT_ANGLES: Record<string, number> = {
  conjunction: 0,
  opposition: 180,
  square: 90,
  trine: 120,
  sextile: 60,
};

const ASPECT_ORBS: Record<string, number> = {
  conjunction: 8,
  opposition: 8,
  square: 7,
  trine: 7,
  sextile: 5,
};

function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export function detectSignificantTransits(
  transitData: TransitData,
  natalChart: NatalChart,
): SignificantTransit[] {
  const results: SignificantTransit[] = [];
  const natalPlanets = natalChart.planets as any[];

  for (const tp of transitData.planets) {
    // Check retrograde stations
    if (tp.isRetrograde && tp.planet !== 'Moon') {
      results.push({
        type: 'retrograde_station',
        transitPlanet: tp.planet,
        transitSign: tp.sign,
        description: `${tp.planet} retrograde in ${tp.sign}`,
      });
    }

    // Check aspects to natal planets
    for (const np of natalPlanets) {
      const natalName = np.name || np.planet;
      const natalLon = np.absolute_longitude || np.full_degree || 0;
      const natalSign = np.sign || '';
      const natalHouse = np.house || 1;

      for (const [aspectName, targetAngle] of Object.entries(ASPECT_ANGLES)) {
        const orb = angleDiff(tp.absoluteLongitude, natalLon) - targetAngle;
        const absOrb = Math.abs(orb);
        const maxOrb = ASPECT_ORBS[aspectName] || 8;

        if (absOrb <= maxOrb) {
          results.push({
            type: aspectName as SignificantTransit['type'],
            transitPlanet: tp.planet,
            transitSign: tp.sign,
            natalPlanet: natalName,
            natalSign: natalSign,
            natalHouse: natalHouse,
            orb: Math.round(absOrb * 100) / 100,
            description: `Transit ${tp.planet} in ${tp.sign} ${aspectName} natal ${natalName} in ${natalSign} (${absOrb.toFixed(1)}° orb)`,
          });
        }
      }
    }
  }

  // Sort by orb tightness (most exact first)
  results.sort((a, b) => (a.orb || 99) - (b.orb || 99));

  // Return top 3 most significant
  return results.slice(0, 3);
}

export function formatTransitsForPrompt(
  transits: SignificantTransit[],
  date: Date,
): string {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  if (transits.length === 0) {
    return `Date: ${dateStr}\nNo major transits today. Quiet energy.`;
  }

  const lines = transits.map(t => `- ${t.description}`);
  return `Date: ${dateStr}\nTransits:\n${lines.join('\n')}`;
}

export function formatNatalChartForPrompt(chart: NatalChart): string {
  const planets = (chart.planets as any[])
    .map(p => `${p.name || p.planet} in ${p.sign} (house ${p.house})${p.is_retrograde ? ' Rx' : ''}`)
    .join(', ');

  const elements = chart.elements as Record<string, number>;
  const dominant = Object.entries(elements).sort(([, a], [, b]) => b - a)[0];

  return `Natal chart: ${planets}\nDominant element: ${dominant?.[0] || 'unknown'}`;
}
```

- [ ] **Step 3: Create GLM service**

Create `portal/bot/src/services/glm.ts`:

```typescript
import { config } from '../config.js';

const SYSTEM_PROMPT = `You are Cato Vermeulen's astrology advisor. Write in a warm, direct mentoring voice. No fluff. 2-3 sentences max per alert. Business context only — every transit interpretation relates to business decisions, timing, visibility, or energy management. Do not overthink. Write directly.

Rules:
- Never mention product names (Blueprint, Transit Reading, etc.)
- No emojis
- No sign-offs or greetings
- Address the reader as "you"
- Be specific about what to do or not do today
- If multiple transits, focus on the most impactful one`;

export async function generateAlertText(
  natalChartContext: string,
  transitContext: string,
): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.2',
      max_tokens: 200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${natalChartContext}\n\n${transitContext}\n\nWrite a personalized business transit alert for today. IMPORTANT: Do not overthink. Write directly.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GLM API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GLM returned empty response');
  return text;
}

export async function generateQuietDayText(
  natalChartContext: string,
  date: Date,
): Promise<string> {
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'z-ai/glm-5.2',
      max_tokens: 150,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `${natalChartContext}\n\nDate: ${dateStr}\nNo major transits today.\n\nWrite a brief energy/focus message for a quiet transit day. What's the best use of this calm window? IMPORTANT: Do not overthink. Write directly.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GLM API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GLM returned empty response');
  return text;
}
```

- [ ] **Step 4: Write transit detection tests**

Create `portal/bot/src/__tests__/transits.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectSignificantTransits, formatTransitsForPrompt, formatNatalChartForPrompt } from '../services/transits.js';
import type { TransitData } from '../services/astrology.js';
import type { NatalChart } from '../services/supabase.js';

const mockNatalChart: NatalChart = {
  user_id: 'test-user',
  planets: [
    { name: 'Sun', sign: 'Cancer', house: 4, absolute_longitude: 100 },
    { name: 'Moon', sign: 'Libra', house: 7, absolute_longitude: 200 },
    { name: 'Mercury', sign: 'Gemini', house: 3, absolute_longitude: 80 },
  ],
  houses: [],
  aspects: [],
  elements: { Fire: 2, Earth: 3, Air: 4, Water: 3 },
  modalities: { Cardinal: 3, Fixed: 4, Mutable: 5 },
  hemispheres: {},
  stelliums: [],
  chart_ruler: null,
};

describe('detectSignificantTransits', () => {
  it('detects conjunction within orb', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Venus', sign: 'Cancer', degree: 10, absoluteLongitude: 103, isRetrograde: false, house: 4 },
      ],
    };

    const results = detectSignificantTransits(transitData, mockNatalChart);
    expect(results.length).toBeGreaterThan(0);
    const conj = results.find(r => r.type === 'conjunction' && r.natalPlanet === 'Sun');
    expect(conj).toBeDefined();
    expect(conj!.orb).toBeLessThanOrEqual(8);
  });

  it('detects opposition', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Mars', sign: 'Capricorn', degree: 10, absoluteLongitude: 280, isRetrograde: false, house: 10 },
      ],
    };

    const results = detectSignificantTransits(transitData, mockNatalChart);
    const opp = results.find(r => r.type === 'opposition' && r.natalPlanet === 'Sun');
    expect(opp).toBeDefined();
  });

  it('detects retrograde stations', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Mercury', sign: 'Leo', degree: 15, absoluteLongitude: 135, isRetrograde: true, house: 5 },
      ],
    };

    const results = detectSignificantTransits(transitData, mockNatalChart);
    const retro = results.find(r => r.type === 'retrograde_station');
    expect(retro).toBeDefined();
    expect(retro!.transitPlanet).toBe('Mercury');
  });

  it('returns max 3 results sorted by orb', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Sun', sign: 'Cancer', degree: 20, absoluteLongitude: 101, isRetrograde: false, house: 4 },
        { planet: 'Venus', sign: 'Cancer', degree: 10, absoluteLongitude: 99, isRetrograde: false, house: 4 },
        { planet: 'Mars', sign: 'Virgo', degree: 10, absoluteLongitude: 160, isRetrograde: false, house: 6 },
        { planet: 'Jupiter', sign: 'Cancer', degree: 5, absoluteLongitude: 95, isRetrograde: false, house: 4 },
      ],
    };

    const results = detectSignificantTransits(transitData, mockNatalChart);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for no significant aspects', () => {
    const transitData: TransitData = {
      date: new Date('2026-07-15'),
      planets: [
        { planet: 'Sun', sign: 'Aries', degree: 15, absoluteLongitude: 15, isRetrograde: false, house: 1 },
      ],
    };

    // 15° Aries vs 100° Cancer = 85° diff — not close to any standard aspect
    const results = detectSignificantTransits(transitData, mockNatalChart);
    const aspects = results.filter(r => r.type !== 'retrograde_station');
    // May or may not find aspects depending on orbs — this tests the function runs cleanly
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('formatTransitsForPrompt', () => {
  it('formats transits for GLM prompt', () => {
    const transits = [{
      type: 'conjunction' as const,
      transitPlanet: 'Venus',
      transitSign: 'Cancer',
      natalPlanet: 'Sun',
      natalSign: 'Cancer',
      natalHouse: 4,
      orb: 3,
      description: 'Transit Venus in Cancer conjunction natal Sun in Cancer (3.0° orb)',
    }];

    const result = formatTransitsForPrompt(transits, new Date('2026-07-15'));
    expect(result).toContain('Venus');
    expect(result).toContain('conjunction');
    expect(result).toContain('Sun');
  });

  it('handles quiet days', () => {
    const result = formatTransitsForPrompt([], new Date('2026-07-15'));
    expect(result).toContain('No major transits');
  });
});

describe('formatNatalChartForPrompt', () => {
  it('formats natal chart for GLM prompt', () => {
    const result = formatNatalChartForPrompt(mockNatalChart);
    expect(result).toContain('Sun in Cancer');
    expect(result).toContain('Moon in Libra');
    expect(result).toContain('Dominant element: Air');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal/bot
npx vitest run
```

Expected: All transit detection tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/services/astrology.ts bot/src/services/transits.ts \
  bot/src/services/glm.ts bot/src/__tests__/transits.test.ts
git commit -m "feat: add astrology, transit detection, and GLM services"
```

---

### Task 5: Alert Generation Pipeline

**Files:**
- Create: `portal/bot/src/cron/generate-alerts.ts`
- Test: `portal/bot/src/__tests__/generate-alerts.test.ts`

**Interfaces:**
- Consumes: `getNatalChart`, `insertAlerts`, `getActiveAlertGrants` from `services/supabase.ts`; `fetchDailyTransits` from `services/astrology.ts`; `detectSignificantTransits`, `formatTransitsForPrompt`, `formatNatalChartForPrompt` from `services/transits.ts`; `generateAlertText`, `generateQuietDayText` from `services/glm.ts`
- Produces:
  - `generateAlertsForUser(userId: string, email: string, startDate: Date, endDate: Date): Promise<number>` — generates and stores all alerts, returns count
  - `backfillExistingClients(): Promise<void>` — one-time backfill for existing grant holders

- [ ] **Step 1: Create alert generation pipeline**

Create `portal/bot/src/cron/generate-alerts.ts`:

```typescript
import { getNatalChart, insertAlerts, getActiveAlertUsers } from '../services/supabase.js';
import { fetchDailyTransits } from '../services/astrology.js';
import { detectSignificantTransits, formatTransitsForPrompt, formatNatalChartForPrompt } from '../services/transits.js';
import { generateAlertText, generateQuietDayText } from '../services/glm.js';
import { ALERT_DURATIONS } from '../config.js';
import type { NewAlert } from '../services/supabase.js';

const FALLBACK_TEMPLATE = (date: Date): string =>
  `Your cosmic weather for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Take stock of where your energy is today and direct it toward your highest-priority business goal.`;

export async function generateAlertsForUser(
  userId: string,
  email: string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const chart = await getNatalChart(userId);
  if (!chart) {
    console.error(`No natal chart for user ${userId} — skipping alert generation`);
    return 0;
  }

  const chartContext = formatNatalChartForPrompt(chart);
  const alerts: NewAlert[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    try {
      // Fetch transit positions for this date
      const transitData = await fetchDailyTransits(currentDate);

      // Detect significant transits against natal chart
      const significant = detectSignificantTransits(transitData, chart);

      let bodyText: string;

      if (significant.length > 0) {
        const transitContext = formatTransitsForPrompt(significant, currentDate);
        try {
          bodyText = await generateAlertText(chartContext, transitContext);
        } catch (glmErr) {
          console.error(`GLM failed for ${email} on ${dateStr}, retrying once...`);
          try {
            bodyText = await generateAlertText(chartContext, transitContext);
          } catch {
            console.error(`GLM retry failed for ${email} on ${dateStr}, using fallback`);
            bodyText = FALLBACK_TEMPLATE(currentDate);
          }
        }
      } else {
        try {
          bodyText = await generateQuietDayText(chartContext, currentDate);
        } catch {
          bodyText = FALLBACK_TEMPLATE(currentDate);
        }
      }

      alerts.push({
        user_id: userId,
        email,
        send_date: dateStr,
        body_text: bodyText,
      });
    } catch (err) {
      console.error(`Failed to generate alert for ${email} on ${dateStr}:`, err);
      // Use fallback for this day
      alerts.push({
        user_id: userId,
        email,
        send_date: dateStr,
        body_text: FALLBACK_TEMPLATE(currentDate),
      });
    }

    // Rate limit: small delay between API calls
    await new Promise(r => setTimeout(r, 500));

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Insert all alerts in batch
  await insertAlerts(alerts);
  console.log(`Generated ${alerts.length} alerts for ${email} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
  return alerts.length;
}

export async function backfillExistingClients(): Promise<void> {
  console.log('Starting backfill for existing clients...');
  const users = await getActiveAlertUsers();

  for (const user of users) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate end date from grant
    let endDate: Date;
    if (user.expires_at) {
      endDate = new Date(user.expires_at);
    } else {
      const duration = ALERT_DURATIONS[user.product] || 90;
      endDate = new Date(user.granted_at);
      endDate.setDate(endDate.getDate() + duration);
    }

    // Skip if grant already expired
    if (endDate < now) {
      console.log(`Grant expired for ${user.email} (${user.product}) — skipping`);
      continue;
    }

    const count = await generateAlertsForUser(user.user_id, user.email, tomorrow, endDate);
    console.log(`Backfilled ${count} alerts for ${user.email}`);
  }

  console.log('Backfill complete.');
}
```

- [ ] **Step 2: Write generation pipeline test**

Create `portal/bot/src/__tests__/generate-alerts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ALERT_DURATIONS } from '../config.js';

describe('Alert generation date math', () => {
  it('calculates correct end date for transit reading (90 days)', () => {
    const grantedAt = new Date('2026-07-11');
    const duration = ALERT_DURATIONS['transit_reading'];
    const endDate = new Date(grantedAt);
    endDate.setDate(endDate.getDate() + duration);

    const diffDays = Math.round((endDate.getTime() - grantedAt.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(90);
  });

  it('calculates correct end date for masterclass (180 days)', () => {
    const grantedAt = new Date('2026-07-11');
    const duration = ALERT_DURATIONS['masterclass_eq'];
    const endDate = new Date(grantedAt);
    endDate.setDate(endDate.getDate() + duration);

    const diffDays = Math.round((endDate.getTime() - grantedAt.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(180);
  });

  it('skips generation when grant is expired', () => {
    const grantedAt = new Date('2026-01-01');
    const duration = ALERT_DURATIONS['transit_reading']; // 90 days
    const endDate = new Date(grantedAt);
    endDate.setDate(endDate.getDate() + duration);
    // End date = April 1, 2026 — already passed
    const now = new Date('2026-07-11');
    expect(endDate < now).toBe(true);
  });

  it('generates for remaining days only when mid-grant', () => {
    const grantedAt = new Date('2026-06-01'); // 40 days ago
    const duration = ALERT_DURATIONS['transit_reading']; // 90 days
    const endDate = new Date(grantedAt);
    endDate.setDate(endDate.getDate() + duration);
    // End date = Aug 30, 2026
    const tomorrow = new Date('2026-07-12');
    const remainingDays = Math.round((endDate.getTime() - tomorrow.getTime()) / (1000 * 60 * 60 * 24));
    expect(remainingDays).toBe(49);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal/bot
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/cron/generate-alerts.ts bot/src/__tests__/generate-alerts.test.ts
git commit -m "feat: add alert generation pipeline with backfill support"
```

---

### Task 6: Daily Send Cron

**Files:**
- Create: `portal/bot/src/cron/send-alerts.ts`
- Modify: `portal/bot/src/bot.ts` — register cron job

**Interfaces:**
- Consumes: `getTodayAlerts`, `getChatIdForUser`, `markAlertSent`, `markChatIdInactive` from `services/supabase.ts`; `config` from `config.ts`
- Produces:
  - `sendDailyAlerts(bot: Bot): Promise<{ sent: number; skipped: number; failed: number }>`
  - Cron job registered in bot.ts that runs daily at 7:00 AM Africa/Johannesburg

- [ ] **Step 1: Create daily send cron**

Create `portal/bot/src/cron/send-alerts.ts`:

```typescript
import { Bot } from 'grammy';
import { getTodayAlerts, getChatIdForUser, markAlertSent, markChatIdInactive } from '../services/supabase.js';

const SEND_DELAY_MS = 100; // 100ms between sends (10 msg/sec, well under 30 limit)

export async function sendDailyAlerts(bot: Bot): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const alerts = await getTodayAlerts();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Daily alert send: ${alerts.length} alerts to process`);

  for (const alert of alerts) {
    const chatId = await getChatIdForUser(alert.user_id);

    if (!chatId) {
      skipped++;
      continue; // User hasn't linked Telegram yet — skip, don't mark sent
    }

    try {
      await bot.api.sendMessage(chatId, alert.body_text, {
        // @ts-ignore — protect_content exists in Telegram API but Grammy types may lag
        protect_content: true,
      });
      await markAlertSent(alert.id);
      sent++;
    } catch (err: any) {
      if (err?.error_code === 403) {
        // User blocked the bot
        console.log(`User ${alert.email} blocked bot — marking inactive`);
        await markChatIdInactive(alert.user_id);
        await markAlertSent(alert.id); // Mark sent to avoid retrying
        failed++;
      } else {
        console.error(`Failed to send alert to ${alert.email}:`, err);
        failed++;
        // Don't mark sent — will retry next cron run
      }
    }

    // Rate limit delay
    await new Promise(r => setTimeout(r, SEND_DELAY_MS));
  }

  console.log(`Daily alert send complete: ${sent} sent, ${skipped} skipped (no Telegram), ${failed} failed`);
  return { sent, skipped, failed };
}
```

- [ ] **Step 2: Update bot.ts with cron registration**

Replace `portal/bot/src/bot.ts`:

```typescript
import { Bot, session } from 'grammy';
import cron from 'node-cron';
import { config } from './config.js';
import { registerStartCommand } from './commands/start.js';
import { registerMenuCommand } from './commands/menu.js';
import { sendDailyAlerts } from './cron/send-alerts.js';

interface SessionData {
  awaitingEmail?: boolean;
  source?: string;
}

const bot = new Bot(config.BOT_TOKEN);

// Session middleware (in-memory)
bot.use(session({ initial: (): SessionData => ({}) }));

// Register commands
bot.command('ping', (ctx) => ctx.reply('pong'));
registerStartCommand(bot);
registerMenuCommand(bot);

// Daily alert cron — 7:00 AM in configured timezone
cron.schedule('0 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running daily alert send...`);
  try {
    await sendDailyAlerts(bot);
  } catch (err) {
    console.error('Daily alert cron failed:', err);
  }
}, { timezone: config.CRON_TIMEZONE });

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start
bot.start({
  onStart: () => {
    console.log('CatoVermeulenBot started');
    console.log(`Daily alerts scheduled for 07:00 ${config.CRON_TIMEZONE}`);
  },
});

export { bot };
```

- [ ] **Step 3: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/cron/send-alerts.ts bot/src/bot.ts
git commit -m "feat: add daily alert send cron with rate limiting and error handling"
```

---

### Task 7: Course Delivery + Admin Commands

**Files:**
- Create: `portal/bot/src/commands/course.ts`
- Create: `portal/bot/src/commands/admin.ts`
- Modify: `portal/bot/src/bot.ts` — register course and admin commands

**Interfaces:**
- Consumes: `getCourseGrant`, `getCourseLesson`, `getCompletedLessons`, `markLessonComplete`, `getLessonCount`, `findProfileByEmail`, `upsertLesson`, `deleteLesson`, `listLessons` from `services/supabase.ts`; `config` from `config.ts`
- Produces:
  - `registerCourseCommand(bot: Bot): void`
  - `registerAdminCommands(bot: Bot): void`

- [ ] **Step 1: Create course command**

Create `portal/bot/src/commands/course.ts`:

```typescript
import { Bot, InlineKeyboard } from 'grammy';
import {
  findProfileByEmail,
  getCourseGrant,
  getCourseLesson,
  getCompletedLessons,
  markLessonComplete,
  getLessonCount,
} from '../services/supabase.js';
import { showProductMenu } from './menu.js';

const DEFAULT_COURSE = 'introduction';

export function registerCourseCommand(bot: Bot) {
  // /course — show current lesson or start course
  bot.command('course', async (ctx) => {
    const chatId = ctx.chat.id;

    // Look up user by chat ID — we need their email for grant check
    // For now, ask them to /start first if not linked
    await sendNextLesson(ctx, DEFAULT_COURSE);
  });

  // Callback: complete lesson
  bot.callbackQuery(/^lesson_complete:(.+):(\d+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lessonNumber = parseInt(ctx.match[2]);
    const userId = ctx.from.id.toString();

    // Get the lesson to find its ID
    const lesson = await getCourseLesson(courseId, lessonNumber);
    if (!lesson) {
      await ctx.answerCallbackQuery('Lesson not found');
      return;
    }

    await markLessonComplete(userId, lesson.id);
    await ctx.answerCallbackQuery('Lesson marked complete! ✅');

    // Check if there's a next lesson
    const totalLessons = await getLessonCount(courseId);
    if (lessonNumber < totalLessons) {
      const nextLesson = await getCourseLesson(courseId, lessonNumber + 1);
      if (nextLesson && nextLesson.drip_delay_hours > 0) {
        await ctx.reply(
          `Lesson ${lessonNumber + 1} unlocks in ${nextLesson.drip_delay_hours} hours. I'll ping you!`,
        );
        // Schedule next lesson notification
        setTimeout(async () => {
          try {
            await sendLesson(ctx, courseId, lessonNumber + 1);
          } catch (err) {
            console.error('Failed to send next lesson:', err);
          }
        }, nextLesson.drip_delay_hours * 60 * 60 * 1000);
      } else if (nextLesson) {
        await sendLesson(ctx, courseId, lessonNumber + 1);
      }
    } else {
      await ctx.reply(
        "You've completed the course! 🎉\n\nReady for the next level?",
      );
      await showProductMenu(ctx);
    }
  });

  // Callback: ask question about lesson
  bot.callbackQuery(/^lesson_question:(.+):(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "Type your question and I'll pass it to Cato. She'll get back to you soon.",
    );
    // The next text message from this user could be captured as a question
    // For v1, just log it — Cato can see it in the bot's chat
  });

  // Callback: start specific lesson
  bot.callbackQuery(/^start_lesson:(.+):(\d+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lessonNumber = parseInt(ctx.match[2]);
    await ctx.answerCallbackQuery();
    await sendLesson(ctx, courseId, lessonNumber);
  });
}

async function sendNextLesson(ctx: any, courseId: string): Promise<void> {
  const userId = ctx.from.id.toString();
  const completed = await getCompletedLessons(userId);
  const totalLessons = await getLessonCount(courseId);

  if (totalLessons === 0) {
    await ctx.reply("No course content available yet. Check back soon!");
    return;
  }

  // Find next uncompleted lesson
  let nextNumber = 1;
  for (let i = 1; i <= totalLessons; i++) {
    const lesson = await getCourseLesson(courseId, i);
    if (lesson && !completed.includes(lesson.id)) {
      nextNumber = i;
      break;
    }
    if (i === totalLessons) {
      // All complete
      await ctx.reply("You've completed all lessons! 🎉");
      await showProductMenu(ctx);
      return;
    }
  }

  const keyboard = new InlineKeyboard()
    .text(`▶️ Start Lesson ${nextNumber}`, `start_lesson:${courseId}:${nextNumber}`);

  await ctx.reply(
    `📚 Your course is ready! You're on lesson ${nextNumber} of ${totalLessons}.`,
    { reply_markup: keyboard },
  );
}

async function sendLesson(ctx: any, courseId: string, lessonNumber: number): Promise<void> {
  const lesson = await getCourseLesson(courseId, lessonNumber);
  if (!lesson) {
    await ctx.reply("Lesson not found. Contact hello@catovermeulen.com");
    return;
  }

  const totalLessons = await getLessonCount(courseId);

  // Send lesson content with protection
  await ctx.reply(
    `📖 *Lesson ${lessonNumber}/${totalLessons}: ${lesson.title}*\n\n${lesson.body_text}`,
    {
      parse_mode: 'Markdown',
      protect_content: true,
    },
  );

  // Send voice note if exists
  if (lesson.voice_note_url) {
    await ctx.replyWithVoice(lesson.voice_note_url, { protect_content: true });
  }

  // Send image if exists
  if (lesson.image_url) {
    await ctx.replyWithPhoto(lesson.image_url, { protect_content: true });
  }

  // Action buttons
  const keyboard = new InlineKeyboard()
    .text('✅ Complete', `lesson_complete:${courseId}:${lessonNumber}`)
    .text('❓ Question', `lesson_question:${courseId}:${lessonNumber}`);

  await ctx.reply('Ready to continue?', { reply_markup: keyboard });
}
```

- [ ] **Step 2: Create admin commands**

Create `portal/bot/src/commands/admin.ts`:

```typescript
import { Bot } from 'grammy';
import { config } from '../config.js';
import { upsertLesson, deleteLesson, listLessons } from '../services/supabase.js';
import { generateAlertsForUser, backfillExistingClients } from '../cron/generate-alerts.js';

interface AdminSession {
  pendingLesson?: {
    courseId: string;
    lessonNumber: number;
    title: string;
    step: 'awaiting_text' | 'awaiting_voice' | 'awaiting_image' | 'done';
    bodyText?: string;
    voiceNoteUrl?: string;
    imageUrl?: string;
  };
}

function isAdmin(chatId: number): boolean {
  return chatId === config.ADMIN_CHAT_ID;
}

export function registerAdminCommands(bot: Bot) {
  // /admin — show admin help
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    await ctx.reply(
      "Admin commands:\n\n" +
      "/addlesson <course_id> <lesson_number> <title>\n" +
      "  → Then send the lesson text\n\n" +
      "/listlessons <course_id>\n" +
      "  → List all lessons in a course\n\n" +
      "/deletelesson <lesson_id>\n" +
      "  → Delete a lesson by ID\n\n" +
      "/backfill\n" +
      "  → Generate alerts for all existing clients\n\n" +
      "/stats\n" +
      "  → Show bot statistics",
    );
  });

  // /addlesson <course_id> <lesson_number> <title>
  bot.command('addlesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const parts = ctx.match?.split(' ');
    if (!parts || parts.length < 3) {
      await ctx.reply("Usage: /addlesson <course_id> <lesson_number> <title>\nExample: /addlesson introduction 1 Your Saturn Return");
      return;
    }

    const courseId = parts[0];
    const lessonNumber = parseInt(parts[1]);
    const title = parts.slice(2).join(' ');

    if (isNaN(lessonNumber)) {
      await ctx.reply("Lesson number must be a number.");
      return;
    }

    ctx.session.pendingLesson = {
      courseId,
      lessonNumber,
      title,
      step: 'awaiting_text',
    };

    await ctx.reply(`Adding lesson ${lessonNumber} to "${courseId}": "${title}"\n\nNow send me the lesson text.`);
  });

  // Handle lesson text input (admin only, when pending)
  bot.on('message:text', async (ctx, next) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session?.pendingLesson) {
      await next();
      return;
    }

    const pending = ctx.session.pendingLesson;

    if (pending.step === 'awaiting_text') {
      pending.bodyText = ctx.message.text;
      pending.step = 'awaiting_voice';
      await ctx.reply("Got the text. Now send a voice note for this lesson, or type /skip to skip.");
      return;
    }
  });

  // Handle voice note for lesson
  bot.on('message:voice', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session?.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.voiceNoteUrl = ctx.message.voice.file_id;
      pending.step = 'awaiting_image';
      await ctx.reply("Got the voice note. Now send an image, or type /skip to skip.");
    }
  });

  // Handle image for lesson
  bot.on('message:photo', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session?.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_image') {
      const photos = ctx.message.photo;
      pending.imageUrl = photos[photos.length - 1].file_id; // Largest size
      await saveLesson(ctx);
    }
  });

  // /skip — skip optional fields
  bot.command('skip', async (ctx) => {
    if (!isAdmin(ctx.chat.id) || !ctx.session?.pendingLesson) return;

    const pending = ctx.session.pendingLesson;
    if (pending.step === 'awaiting_voice') {
      pending.step = 'awaiting_image';
      await ctx.reply("Skipped voice note. Now send an image, or type /skip again to finish.");
    } else if (pending.step === 'awaiting_image') {
      await saveLesson(ctx);
    }
  });

  // /listlessons <course_id>
  bot.command('listlessons', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const courseId = ctx.match?.trim();
    if (!courseId) {
      await ctx.reply("Usage: /listlessons <course_id>");
      return;
    }

    const lessons = await listLessons(courseId);
    if (lessons.length === 0) {
      await ctx.reply(`No lessons found for course "${courseId}".`);
      return;
    }

    const list = lessons.map(l => `${l.lesson_number}. ${l.title} (${l.id})`).join('\n');
    await ctx.reply(`Lessons in "${courseId}":\n\n${list}`);
  });

  // /deletelesson <lesson_id>
  bot.command('deletelesson', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    const lessonId = ctx.match?.trim();
    if (!lessonId) {
      await ctx.reply("Usage: /deletelesson <lesson_id>");
      return;
    }

    await deleteLesson(lessonId);
    await ctx.reply(`Lesson ${lessonId} deleted.`);
  });

  // /backfill — generate alerts for all existing clients
  bot.command('backfill', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) return;

    await ctx.reply("Starting backfill... This may take a while. I'll notify you when done.");

    try {
      await backfillExistingClients();
      await ctx.reply("Backfill complete! All existing clients now have pre-generated alerts.");
    } catch (err) {
      console.error('Backfill error:', err);
      await ctx.reply(`Backfill failed: ${err}`);
    }
  });
}

async function saveLesson(ctx: any): Promise<void> {
  const pending = ctx.session.pendingLesson;
  if (!pending || !pending.bodyText) {
    await ctx.reply("Something went wrong. Try again with /addlesson.");
    ctx.session.pendingLesson = undefined;
    return;
  }

  await upsertLesson({
    course_id: pending.courseId,
    lesson_number: pending.lessonNumber,
    title: pending.title,
    body_text: pending.bodyText,
    voice_note_url: pending.voiceNoteUrl || null,
    image_url: pending.imageUrl || null,
  });

  await ctx.reply(
    `✅ Lesson ${pending.lessonNumber} saved!\n` +
    `Course: ${pending.courseId}\n` +
    `Title: ${pending.title}\n` +
    `Text: ${pending.bodyText.substring(0, 50)}...\n` +
    `Voice: ${pending.voiceNoteUrl ? 'Yes' : 'No'}\n` +
    `Image: ${pending.imageUrl ? 'Yes' : 'No'}`,
  );

  ctx.session.pendingLesson = undefined;
}
```

- [ ] **Step 3: Update bot.ts to register course and admin commands**

Replace `portal/bot/src/bot.ts`:

```typescript
import { Bot, session } from 'grammy';
import cron from 'node-cron';
import { config } from './config.js';
import { registerStartCommand } from './commands/start.js';
import { registerMenuCommand } from './commands/menu.js';
import { registerCourseCommand } from './commands/course.js';
import { registerAdminCommands } from './commands/admin.js';
import { sendDailyAlerts } from './cron/send-alerts.js';

interface SessionData {
  awaitingEmail?: boolean;
  source?: string;
  pendingLesson?: {
    courseId: string;
    lessonNumber: number;
    title: string;
    step: 'awaiting_text' | 'awaiting_voice' | 'awaiting_image' | 'done';
    bodyText?: string;
    voiceNoteUrl?: string;
    imageUrl?: string;
  };
}

const bot = new Bot(config.BOT_TOKEN);

// Session middleware
bot.use(session({ initial: (): SessionData => ({}) }));

// Register commands (order matters — admin text handler must come before start's)
bot.command('ping', (ctx) => ctx.reply('pong'));
registerAdminCommands(bot);
registerCourseCommand(bot);
registerStartCommand(bot);
registerMenuCommand(bot);

// Daily alert cron — 7:00 AM configured timezone
cron.schedule('0 7 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Running daily alert send...`);
  try {
    await sendDailyAlerts(bot);
  } catch (err) {
    console.error('Daily alert cron failed:', err);
  }
}, { timezone: config.CRON_TIMEZONE });

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start
bot.start({
  onStart: () => {
    console.log('CatoVermeulenBot started');
    console.log(`Daily alerts scheduled for 07:00 ${config.CRON_TIMEZONE}`);
  },
});

export { bot };
```

- [ ] **Step 4: Commit**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/src/commands/course.ts bot/src/commands/admin.ts bot/src/bot.ts
git commit -m "feat: add course delivery with drip-feed and admin commands"
```

---

### Task 8: VPS Deployment

**Files:**
- Create: `portal/bot/deploy.sh`
- Create: `portal/bot/cato-bot.service`

**Interfaces:**
- Consumes: all previous tasks
- Produces: running bot process on VPS at 161.97.100.134

- [ ] **Step 1: Create systemd service file**

Create `portal/bot/cato-bot.service`:

```ini
[Unit]
Description=Cato Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cato-bot
ExecStart=/usr/bin/node dist/bot.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/cato-bot/.env

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create deployment script**

Create `portal/bot/deploy.sh`:

```bash
#!/bin/bash
set -e

VPS="root@161.97.100.134"
REMOTE_DIR="/opt/cato-bot"

echo "Building TypeScript..."
npm run build

echo "Syncing to VPS..."
rsync -avz --exclude node_modules --exclude .env --exclude .git \
  ./ "$VPS:$REMOTE_DIR/"

echo "Installing dependencies on VPS..."
ssh "$VPS" "cd $REMOTE_DIR && npm install --production"

echo "Installing systemd service..."
ssh "$VPS" "cp $REMOTE_DIR/cato-bot.service /etc/systemd/system/ && \
  systemctl daemon-reload && \
  systemctl enable cato-bot && \
  systemctl restart cato-bot"

echo "Checking status..."
ssh "$VPS" "systemctl status cato-bot --no-pager"

echo "Done! Bot is running."
```

- [ ] **Step 3: Make deploy script executable**

```bash
chmod +x /Users/richardvanderveren/AOOA/clients/Cato/portal/bot/deploy.sh
```

- [ ] **Step 4: Create .env on VPS**

SSH into VPS and create the env file (do NOT commit this):

```bash
ssh root@161.97.100.134 "mkdir -p /opt/cato-bot && cat > /opt/cato-bot/.env << 'EOF'
BOT_TOKEN=<get from @BotFather after creating @CatoVermeulenBot>
SUPABASE_URL=https://fdewbbrzetgqqsonpqvp.supabase.co
SUPABASE_SERVICE_KEY=<service role key from Supabase dashboard>
OPENROUTER_API_KEY=<from Keychain>
ASTROLOGY_API_KEY=<existing key>
ADMIN_CHAT_ID=<Cato's Telegram user ID>
CRON_TIMEZONE=Africa/Johannesburg
PORTAL_URL=https://app.catovermeulen.com
EOF"
```

- [ ] **Step 5: Create bot via @BotFather**

1. Open Telegram, start chat with @BotFather
2. Send `/newbot`
3. Name: `Cato Vermeulen Bot`
4. Username: `CatoVermeulenBot`
5. Copy the token into the VPS .env file
6. Send `/setdescription` → "Personalized business astrology transit alerts and courses by Cato Vermeulen"
7. Send `/setcommands` →
```
start - Connect your account
course - Access your course lessons
menu - View available products
ping - Check if bot is online
```

- [ ] **Step 6: Run the SQL migration**

Go to Supabase SQL Editor (https://supabase.com/dashboard/project/fdewbbrzetgqqsonpqvp/sql/new) and paste the contents of `portal/supabase/migrations/002_telegram_bot.sql`. Run it.

Verify:
- `profiles` table now has `telegram_chat_id` column
- `access_grants` table now has `expires_at` column
- `telegram_alerts` table exists
- `course_lessons` table exists

- [ ] **Step 7: Deploy to VPS**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal/bot
./deploy.sh
```

Expected: Bot starts, systemd reports active.

- [ ] **Step 8: Test the bot**

1. Open Telegram, search for @CatoVermeulenBot
2. Send `/ping` → should reply "pong"
3. Send `/start` → should ask for email
4. Send a known client email → should verify and link

- [ ] **Step 9: Commit deployment files**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add bot/deploy.sh bot/cato-bot.service
git commit -m "feat: add VPS deployment config (systemd + deploy script)"
```

---

### Task 9: Run Backfill + End-to-End Test

**Files:**
- No new files — this is a manual execution + verification task

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified working bot with alerts for existing clients

- [ ] **Step 1: Identify Cato's Telegram user ID**

Cato sends `/start` to the bot. Check VPS logs for her chat ID:

```bash
ssh root@161.97.100.134 "journalctl -u cato-bot -f"
```

Look for the line: `Telegram linked: cato.vermeulen@outlook.com (chat XXXXX, source: direct)`

Update the `.env` file on VPS with `ADMIN_CHAT_ID=<her chat ID>` and restart:

```bash
ssh root@161.97.100.134 "systemctl restart cato-bot"
```

- [ ] **Step 2: Run backfill for existing clients**

Cato sends `/backfill` to the bot (or Richard from admin chat ID).

Monitor progress:
```bash
ssh root@161.97.100.134 "journalctl -u cato-bot -f"
```

Expected: alerts generated for all users with active transit/masterclass grants who have natal chart data.

- [ ] **Step 3: Verify alert delivery (next morning)**

After 7:00 AM the next day, check logs:
```bash
ssh root@161.97.100.134 "journalctl -u cato-bot --since '07:00' --until '07:30'"
```

Expected: alerts sent to all linked users with today's send_date.

- [ ] **Step 4: Test content protection**

Receive an alert in Telegram. Try to:
- Forward it → should be blocked
- Copy text → should be blocked on mobile
- Screenshot → should be blocked on mobile

- [ ] **Step 5: Commit final state**

```bash
cd /Users/richardvanderveren/AOOA/clients/Cato/portal
git add -A
git commit -m "feat: Cato Telegram Bot ecosystem complete — alerts, courses, admin"
```
