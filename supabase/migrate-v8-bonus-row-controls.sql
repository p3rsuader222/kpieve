-- ============================================================================
-- KPIeve — v8 migration (per-row bonus scoring controls)
-- Run ONCE on an existing v7 database. Idempotent: safe to re-run.
--
--  floor_pct → minimum attainment (percent) before a core/additional KPI pays
--              anything (was the global 80%).
--  cap_pct   → attainment ceiling (percent) counted toward the payout
--              (was the global 150%).
--  role gains 'additional': scored like core (weight % × attainment with
--  floor/cap) but OUTSIDE the mandatory 100% weight pool — pure on-top upside.
-- ============================================================================

alter table public.bonus_kpi_markets
  add column if not exists floor_pct numeric not null default 80,
  add column if not exists cap_pct   numeric not null default 150;

alter table public.bonus_kpi_markets drop constraint if exists bonus_kpi_markets_role_check;
alter table public.bonus_kpi_markets add constraint bonus_kpi_markets_role_check
  check (role in ('core','extra','additional'));
