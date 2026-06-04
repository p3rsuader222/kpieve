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
  color       text not null default '#3457b8',
  active      boolean not null default true,
  sort_order  int  not null default 0
);

create table if not exists public.member_markets (
  member_id uuid not null references public.members(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  primary key (member_id, market_id)
);

create table if not exists public.kpis (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
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
  -- One value per KPI / member / market / day → enables clean upserts.
  constraint entries_uniq unique (kpi_id, member_id, market_id, date)
);

create index if not exists entries_date_idx on public.entries(date);
create index if not exists entries_kpi_idx  on public.entries(kpi_id);

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

do $$
declare t text;
begin
  foreach t in array array['markets','members','member_markets','kpis','entries'] loop
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

insert into public.members (name, initials, color, sort_order) values
  ('Greta Kazlauskaitė', 'GK', '#3457b8', 1),
  ('Karl Tamm',          'KT', '#0e9488', 2),
  ('Marta Kowalska',     'MK', '#b8567a', 3),
  ('Rūta Bērziņa',       'RB', '#c2730e', 4)
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

insert into public.kpis (name, description, unit, format, direction, aggregation, default_target, sort_order) values
  ('Clients onboarded',   'New clients fully onboarded.',                 'clients', 'number',   'higher_better', 'sum', 3,    1),
  ('Avg time-to-onboard', 'Mean elapsed time from signup to activation.', null,      'duration', 'lower_better',  'avg', 2880, 2),
  ('Completion rate',     'Share of started onboardings completed.',      null,      'percent',  'higher_better', 'avg', 95,   3),
  ('CSAT',                'Post-onboarding satisfaction score.',          '/ 5',     'number',   'higher_better', 'avg', 4.5,  4),
  ('SLA adherence',       'First-response within agreed SLA.',            null,      'percent',  'higher_better', 'avg', 98,   5)
on conflict do nothing;

-- Entries start empty — the team lead fills them via the Update page.
-- (To preview with live-looking data before entering any, leave Supabase
--  unconfigured locally and the app serves its built-in mock dataset.)
