-- ============================================================================
-- KPIeve — v5 migration (quality KPIs + per-market bonus config + per-seller assortment)
-- Run ONCE on an existing v4 database (Supabase → SQL → New query).
-- Idempotent: safe to re-run. A brand-new project runs schema.sql then this.
-- Effective from July 2026: Eve's quality-focused KPI overhaul.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- 1) KPIs ----------

-- New `compute` column: 'entries' (rolled up from the entries table, the default)
-- or 'assortment' (derived from public.assortment_sellers — % of sellers who passed).
alter table public.kpis
  add column if not exists compute text not null default 'entries'
  check (compute in ('entries','assortment'));

-- Clarify the existing PHH KPI (keeps its id, entries, weights).
update public.kpis
  set name = 'PHH account setup',
      description = 'Seller registered and set up their PHH ads account (logins).'
  where name = 'PHH ads';

-- New extra-bonus item (all markets): a genuinely live PHH campaign, not just setup.
insert into public.kpis (name, description, unit, format, direction, aggregation, default_target, sort_order, compute) values
  ('PHH live campaign', 'Sellers running a live PHH ad campaign (not just set up).', 'sellers', 'number', 'higher_better', 'sum', null, 6, 'entries')
on conflict (name) do nothing;

-- New quality KPI (all markets): % of onboarded sellers who hit their own 80/50 bar.
-- Fact is DERIVED from assortment_sellers, so compute = 'assortment'.
insert into public.kpis (name, description, unit, format, direction, aggregation, default_target, sort_order, compute) values
  ('Planned assortment completeness', 'Share of onboarded sellers who activated their declared assortment (>=80% if <=100 SKUs, >=50% if >100).', null, 'percent', 'higher_better', 'avg', 100, 7, 'assortment')
on conflict (name) do nothing;

-- ---------- 2) Per-month, per-market KPI config ----------
-- Each (month, market, kpi) is either a CORE weighted KPI (`weight` %, joins the
-- 100% pool with the 80%/150% rules) or an EXTRA flat bonus (`eur_rate` €/seller).
-- This lets a KPI be core in one market and extra in another (FBP: core LT, extra LV/EE/PL).
create table if not exists public.bonus_kpi_markets (
  period    date not null,                 -- scoring month, yyyy-MM-01
  market_id uuid not null references public.markets(id) on delete cascade,
  kpi_id    uuid not null references public.kpis(id)    on delete cascade,
  role      text not null default 'core' check (role in ('core','extra')),
  weight    numeric not null default 0,    -- percent 0..100, used when role = 'core'
  eur_rate  numeric not null default 0,    -- € per qualifying seller, used when role = 'extra'
  primary key (period, market_id, kpi_id)
);
create index if not exists bonus_kpi_markets_period_idx on public.bonus_kpi_markets(period);

-- ---------- 3) Per-month base bonus pool, per member ----------
-- Each member belongs to exactly one market, so the base pool is simply per member.
create table if not exists public.bonus_base (
  period    date not null,                 -- scoring month, yyyy-MM-01
  member_id uuid not null references public.members(id) on delete cascade,
  max_bonus numeric not null default 0,
  primary key (period, member_id)
);

-- ---------- 4) Per-seller assortment tracking ----------
-- Eve records each onboarded seller's declared (planned) SKUs and how many were
-- activated. The app derives the bar (<=100 → 80%, >100 → 50%) and pass/fail, and
-- aggregates to the "Planned assortment completeness" KPI fact (% passed).
create table if not exists public.assortment_sellers (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.members(id) on delete cascade,
  market_id      uuid not null references public.markets(id) on delete cascade,
  period         date not null,            -- onboarding month, yyyy-MM-01
  name           text,
  planned_skus   int not null default 0,
  activated_skus int not null default 0,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists assortment_sellers_period_idx on public.assortment_sellers(period);

-- ---------- Row Level Security ----------
alter table public.bonus_kpi_markets  enable row level security;
alter table public.bonus_base         enable row level security;
alter table public.assortment_sellers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bonus_kpi_markets','bonus_base','assortment_sellers'] loop
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- Seed: July 2026 per-market bonus plan (Eve's tables) ----------

-- LT — FBP stays a CORE KPI; PHH (setup + live) move to extra bonuses.
insert into public.bonus_kpi_markets (period, market_id, kpi_id, role, weight, eur_rate)
select '2026-07-01'::date, mk.id, k.id, c.role, c.weight, c.eur_rate
from (values
  ('Sellers with 1st active offer',     'core', 35, 0),
  ('Sellers with 1st order in 30 days', 'core', 30, 0),
  ('Planned assortment completeness',   'core', 15, 0),
  ('Late rate per portfolio CCD',       'core',  5, 0),
  ('FBP',                               'core', 15, 0),
  ('PHH account setup',                 'extra', 0, 10),
  ('PHH live campaign',                 'extra', 0, 10)
) as c(kpi_name, role, weight, eur_rate)
cross join (select id from public.markets where code = 'LT') mk
join public.kpis k on k.name = c.kpi_name
on conflict (period, market_id, kpi_id) do nothing;

-- LV / EE / PL — FBP drops to an extra bonus; PHH account setup becomes CORE.
insert into public.bonus_kpi_markets (period, market_id, kpi_id, role, weight, eur_rate)
select '2026-07-01'::date, mk.id, k.id, c.role, c.weight, c.eur_rate
from (values
  ('Sellers with 1st active offer',     'core', 35, 0),
  ('Sellers with 1st order in 30 days', 'core', 30, 0),
  ('PHH account setup',                 'core', 10, 0),
  ('Late rate per portfolio CCD',       'core',  5, 0),
  ('Planned assortment completeness',   'core', 20, 0),
  ('FBP',                               'extra', 0, 15),
  ('PHH live campaign',                 'extra', 0, 10)
) as c(kpi_name, role, weight, eur_rate)
cross join (select id from public.markets where code in ('LV','EE','PL')) mk
join public.kpis k on k.name = c.kpi_name
on conflict (period, market_id, kpi_id) do nothing;

-- Done. Base pools (per member) + per-seller assortment + history are seeded by
-- seed-testdata-2026.sql, or entered by the manager in the app (Settings → Bonus plan).
