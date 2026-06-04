-- ============================================================================
-- KPIeve — v2 migration (country-first, monthly cadence, real KPIs)
-- Run this ONCE on an existing v1 database (Supabase → SQL → New query).
-- Idempotent: safe to re-run. If you have a brand-new project, just run
-- schema.sql instead — it already includes everything below.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- 1. New table: per-country / per-month targets ----------

create table if not exists public.targets (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.kpis(id)    on delete cascade,
  market_id  uuid not null references public.markets(id) on delete cascade,
  period     date not null,                 -- month start, yyyy-MM-01
  value      numeric not null,
  constraint targets_uniq unique (kpi_id, market_id, period)
);

create index if not exists targets_period_idx on public.targets(period);

alter table public.targets enable row level security;
drop policy if exists "authenticated full access" on public.targets;
create policy "authenticated full access" on public.targets
  for all to authenticated using (true) with check (true);

-- ---------- 2. Replace the placeholder KPIs with the real ones ----------
-- v1 KPIs were placeholders and (in a fresh deploy) carry no entries, so this
-- is safe. Deleting a KPI cascades to its entries/targets.

delete from public.kpis
where name in ('Clients onboarded','Avg time-to-onboard','Completion rate','CSAT','SLA adherence');

insert into public.kpis (name, description, unit, format, direction, aggregation, default_target, sort_order) values
  ('Sellers with 1st active offer',     'New sellers who published their first active offer.',                   'sellers', 'number',  'higher_better', 'sum', 12, 1),
  ('Sellers with 1st order in 30 days', 'Sellers reaching their first order within 30 days of an active offer.', 'sellers', 'number',  'higher_better', 'sum', 7,  2),
  ('PHH ads',                           'Premium home & hardware ads published.',                                'ads',     'number',  'higher_better', 'sum', 12, 3),
  ('Late rate per portfolio CCD',       'Share of portfolio CCDs delivered late (lower is better).',             null,      'percent', 'lower_better',  'avg', 5,  4),
  ('FBP',                               'Fulfilled business plan sellers.',                                      null,      'number',  'higher_better', 'sum', 5,  5)
on conflict do nothing;

-- ---------- 3. (Optional) refresh member accent colors to the new palette ----------

update public.members set color = '#C15F3C' where initials = 'GK';
update public.members set color = '#5B8C4F' where initials = 'KT';
update public.members set color = '#C2840E' where initials = 'MK';
update public.members set color = '#7A6BC0' where initials = 'RB';

-- ---------- 4. Seed current-month targets (per country) ----------

insert into public.targets (kpi_id, market_id, period, value)
select k.id, mk.id, date_trunc('month', current_date)::date, t.value
from (values
  ('Sellers with 1st active offer',     'LT', 16), ('Sellers with 1st active offer',     'LV', 12), ('Sellers with 1st active offer',     'EE', 12), ('Sellers with 1st active offer',     'PL', 12),
  ('Sellers with 1st order in 30 days', 'LT', 10), ('Sellers with 1st order in 30 days', 'LV',  7), ('Sellers with 1st order in 30 days', 'EE',  7), ('Sellers with 1st order in 30 days', 'PL',  7),
  ('PHH ads',                           'LT', 16), ('PHH ads',                           'LV', 12), ('PHH ads',                           'EE', 12), ('PHH ads',                           'PL', 12),
  ('Late rate per portfolio CCD',       'LT',  5), ('Late rate per portfolio CCD',       'LV',  5), ('Late rate per portfolio CCD',       'EE',  5), ('Late rate per portfolio CCD',       'PL',  5),
  ('FBP',                               'LT',  5), ('FBP',                               'LV',  5), ('FBP',                               'EE',  5), ('FBP',                               'PL',  5)
) as t(kpi_name, market_code, value)
join public.kpis k     on k.name  = t.kpi_name
join public.markets mk on mk.code = t.market_code
on conflict (kpi_id, market_id, period) do nothing;

-- Done. Reload the app — the dashboard now shows the 5 real KPIs with
-- per-country monthly targets. Enter facts on /update; tune targets on /settings.
