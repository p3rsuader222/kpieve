-- ============================================================================
-- KPIeve — v7 migration (per-KPI flags)
-- Run ONCE on an existing v6 database. Idempotent: safe to re-run.
--
--  additional  → the KPI is tagged "Additional (non-mandatory)" across the UI.
--                Display-only: scoring/adherence math is unchanged.
--  risk_grace  → for lower-is-better KPIs: how far (percent of the target) the
--                value may overshoot the bar before counting as failed; the
--                overshoot zone reads as "at risk". E.g. target 5%, grace 20
--                → up to 6% is at risk, beyond 6% fails.
-- ============================================================================

alter table public.kpis add column if not exists additional boolean not null default false;
alter table public.kpis add column if not exists risk_grace numeric not null default 20;

-- Hardening (advisor lint 0011): pin the trigger functions' search_path.
alter function public.log_entry_change() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
