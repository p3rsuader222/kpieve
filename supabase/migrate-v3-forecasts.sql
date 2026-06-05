-- ============================================================================
-- KPIeve — v3 migration (Forecast: per-country next-month projections)
-- Run this ONCE on an existing v2 database (Supabase → SQL → New query).
-- Idempotent: safe to re-run. A brand-new project can just run schema.sql,
-- which already includes everything below.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- New table: per-country / per-month forecasts ----------
-- A forecast is a manual projection of next month's fact. Same shape as
-- `targets`; `period` is the month being forecast (yyyy-MM-01).

create table if not exists public.forecasts (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.kpis(id)    on delete cascade,
  market_id  uuid not null references public.markets(id) on delete cascade,
  period     date not null,                 -- month start, yyyy-MM-01
  value      numeric not null,
  constraint forecasts_uniq unique (kpi_id, market_id, period)
);

create index if not exists forecasts_period_idx on public.forecasts(period);

-- ---------- Row Level Security ----------
-- Authenticated users (the shared dashboard account) get full access; anonymous
-- requests are denied by default → the shipped anon key stays safe.

alter table public.forecasts enable row level security;
drop policy if exists "authenticated full access" on public.forecasts;
create policy "authenticated full access" on public.forecasts
  for all to authenticated using (true) with check (true);

-- Done. Reload the app — the new Forecast page can now save per-country
-- projections for next month. No seed data: projections are typed by the team.
