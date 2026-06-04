-- ============================================================================
-- KPIeve — one-time cleanup for duplicated KPIs/targets
-- Run this ONCE in the Supabase SQL editor if Settings shows each KPI twice.
-- It keeps the oldest row per KPI name and adds a unique key so re-running any
-- seed/migration can never duplicate them again.
--
-- NOTE: removing a duplicate KPI cascades to ITS entries/targets. If you have
-- already entered real monthly numbers, tell us first — this keeps an arbitrary
-- copy. On a fresh setup (no real data yet) it is completely safe.
-- ============================================================================

begin;

-- 1. De-duplicate KPIs — keep the earliest physical row per name.
delete from public.kpis a
using public.kpis b
where a.name = b.name
  and a.ctid > b.ctid;

-- 2. Enforce uniqueness by name so future inserts are truly idempotent.
alter table public.kpis drop constraint if exists kpis_name_uniq;
alter table public.kpis add constraint kpis_name_uniq unique (name);

-- 3. Defensive: drop any duplicate target rows (the surviving KPI keeps one
--    row per country/month; cascades from step 1 already removed the rest).
delete from public.targets a
using public.targets b
where a.kpi_id = b.kpi_id
  and a.market_id = b.market_id
  and a.period = b.period
  and a.ctid > b.ctid;

commit;

-- Reload the app — Settings should now list exactly 5 KPIs.
