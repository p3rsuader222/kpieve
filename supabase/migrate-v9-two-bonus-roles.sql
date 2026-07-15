-- ============================================================================
-- KPIeve — v9 migration (two bonus roles)
-- Run ONCE on an existing v8 database. Idempotent: safe to re-run.
--
-- Simplification: a bonus-plan row is either CORE (mandatory — weighted share
-- of the 100% pool) or ADDITIONAL (non-mandatory — on top of the pool).
-- The former 'extra' role folds into 'additional': € per seller is just one
-- way an additional row can pay (the other being a % on top; both can be set).
-- ============================================================================

update public.bonus_kpi_markets set role = 'additional' where role = 'extra';

alter table public.bonus_kpi_markets drop constraint if exists bonus_kpi_markets_role_check;
alter table public.bonus_kpi_markets add constraint bonus_kpi_markets_role_check
  check (role in ('core','additional'));
