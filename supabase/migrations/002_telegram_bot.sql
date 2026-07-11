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

-- 5. Client type on profiles (paid, influencer, friend)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'paid'
  CHECK (client_type IN ('paid', 'influencer', 'friend'));

-- 6. Grant source on access_grants (stripe, manual, comp)
ALTER TABLE public.access_grants
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe'
  CHECK (source IN ('stripe', 'manual', 'comp'));
