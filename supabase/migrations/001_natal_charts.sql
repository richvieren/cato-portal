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
