-- ============================================================================
-- KPIeve — Supabase schema, security & seed
-- Run this once in the Supabase SQL editor (Project → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT where possible.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists public.markets (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  sort_order  int  not null default 0
);

create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  initials    text not null,
  color       text not null default '#0A7AFF',
  active      boolean not null default true,
  sort_order  int  not null default 0,
  avatar      text          -- preset key ("preset:w1") or image data URL / URL
);

create table if not exists public.member_markets (
  member_id uuid not null references public.members(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  primary key (member_id, market_id)
);

create table if not exists public.kpis (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  description    text,
  unit           text,
  format         text not null default 'number'        check (format in ('number','percent','currency','duration')),
  direction      text not null default 'higher_better' check (direction in ('higher_better','lower_better')),
  aggregation    text not null default 'sum'           check (aggregation in ('sum','avg')),
  default_target numeric,
  sort_order     int  not null default 0,
  active         boolean not null default true
);

create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.kpis(id)    on delete cascade,
  member_id  uuid references public.members(id)          on delete cascade,
  market_id  uuid references public.markets(id)          on delete cascade,
  date       date not null,
  value      numeric not null,
  target     numeric,
  note       text,
  source     text not null default 'manual' check (source in ('manual','sheet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Entries are logged per real day (yyyy-MM-dd) and rolled up to the month by the
  -- app. This unique key enforces one value per KPI / member / market / day → clean
  -- upserts on daily edits.
  constraint entries_uniq unique (kpi_id, member_id, market_id, date)
);

create index if not exists entries_date_idx on public.entries(date);
create index if not exists entries_kpi_idx  on public.entries(kpi_id);

-- Per-country, per-month targets (configurable; can change month to month).
create table if not exists public.targets (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.kpis(id)    on delete cascade,
  market_id  uuid not null references public.markets(id) on delete cascade,
  period     date not null,                 -- month start, yyyy-MM-01
  value      numeric not null,
  constraint targets_uniq unique (kpi_id, market_id, period)
);

create index if not exists targets_period_idx on public.targets(period);

-- Keep updated_at fresh on edits.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ----------
-- Authenticated users (the shared dashboard account) get full access.
-- Anonymous requests are denied by default → the shipped anon key is safe.

alter table public.markets        enable row level security;
alter table public.members        enable row level security;
alter table public.member_markets enable row level security;
alter table public.kpis           enable row level security;
alter table public.entries        enable row level security;
alter table public.targets        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['markets','members','member_markets','kpis','entries','targets'] loop
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- Seed: markets, team, KPIs ----------

insert into public.markets (code, name, sort_order) values
  ('LT', 'Lithuania', 1),
  ('LV', 'Latvia',    2),
  ('EE', 'Estonia',   3),
  ('PL', 'Poland',    4)
on conflict (code) do nothing;

insert into public.members (name, initials, color, sort_order, avatar) values
  ('Greta Kazlauskaitė', 'GK', '#0A7AFF', 1, 'preset:w1'),
  ('Karl Tamm',          'KT', '#1098AD', 2, 'preset:m1'),
  ('Marta Kowalska',     'MK', '#E8A100', 3, 'preset:w4'),
  ('Rūta Bērziņa',       'RB', '#7C5CFF', 4, 'preset:w7')
on conflict do nothing;

-- Coverage (members cover multiple markets).
insert into public.member_markets (member_id, market_id)
select mem.id, mk.id
from (values
  ('Greta Kazlauskaitė','LT'), ('Greta Kazlauskaitė','LV'),
  ('Karl Tamm','EE'),          ('Karl Tamm','LT'),
  ('Marta Kowalska','PL'),     ('Marta Kowalska','LV'),
  ('Rūta Bērziņa','PL'),       ('Rūta Bērziņa','EE')
) as pair(member_name, market_code)
join public.members mem on mem.name = pair.member_name
join public.markets mk  on mk.code  = pair.market_code
on conflict do nothing;

-- Real KPIs from Evelina's workbook.
insert into public.kpis (name, description, unit, format, direction, aggregation, default_target, sort_order) values
  ('Sellers with 1st active offer',     'New sellers who published their first active offer.',           'sellers', 'number',  'higher_better', 'sum', 12, 1),
  ('Sellers with 1st order in 30 days', 'Sellers reaching their first order within 30 days of an active offer.', 'sellers', 'number', 'higher_better', 'sum', 7,  2),
  ('PHH ads',                           'Premium home & hardware ads published.',                        'ads',     'number',  'higher_better', 'sum', 12, 3),
  ('Late rate per portfolio CCD',       'Share of portfolio CCDs delivered late (lower is better).',     null,      'percent', 'lower_better',  'avg', 5,  4),
  ('FBP',                               'Fulfilled business plan sellers.',                              null,      'number',  'higher_better', 'sum', 5,  5)
on conflict (name) do nothing;

-- ---------- Seed: current-month targets (per country) ----------
-- Targets are configurable per (KPI, country, month) on the Settings page;
-- these seed the current month from the workbook. Re-running is idempotent.
insert into public.targets (kpi_id, market_id, period, value)
select k.id, mk.id, date_trunc('month', current_date)::date, t.value
from (values
  ('Sellers with 1st active offer',     'LT', 16), ('Sellers with 1st active offer',     'LV', 12), ('Sellers with 1st active offer',     'EE', 12), ('Sellers with 1st active offer',     'PL', 12),
  ('Sellers with 1st order in 30 days', 'LT', 10), ('Sellers with 1st order in 30 days', 'LV',  7), ('Sellers with 1st order in 30 days', 'EE',  7), ('Sellers with 1st order in 30 days', 'PL',  7),
  ('PHH ads',                           'LT', 16), ('PHH ads',                           'LV', 12), ('PHH ads',                           'EE', 12), ('PHH ads',                           'PL', 12),
  ('Late rate per portfolio CCD',       'LT',  5), ('Late rate per portfolio CCD',       'LV',  5), ('Late rate per portfolio CCD',       'EE',  5), ('Late rate per portfolio CCD',       'PL',  5),
  ('FBP',                               'LT',  5), ('FBP',                               'LV',  5), ('FBP',                               'EE',  5), ('FBP',                               'PL',  5)
) as t(kpi_name, market_code, value)
join public.kpis k    on k.name  = t.kpi_name
join public.markets mk on mk.code = t.market_code
on conflict (kpi_id, market_id, period) do nothing;

-- Entries start empty — the team lead fills them per month via the Update page.
-- (To preview with live-looking data before entering any, leave Supabase
--  unconfigured locally and the app serves its built-in monthly mock dataset.)
