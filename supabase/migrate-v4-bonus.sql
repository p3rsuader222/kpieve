-- ============================================================================
-- KPIeve — v4 migration (Team Bonus: per-member KPI weights + max bonus)
-- Run this ONCE on an existing v3 database (Supabase → SQL → New query).
-- Idempotent: safe to re-run. A brand-new project can just run schema.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Per-member bonus weights (share of the max bonus tied to each KPI; percent 0..100).
create table if not exists public.bonus_weights (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  kpi_id     uuid not null references public.kpis(id)     on delete cascade,
  weight     numeric not null default 0,
  constraint bonus_weights_uniq unique (member_id, kpi_id)
);

-- Per-member maximum bonus (payout at 100% attainment across all KPIs).
create table if not exists public.bonus_settings (
  member_id  uuid primary key references public.members(id) on delete cascade,
  max_bonus  numeric not null default 0
);

-- ---------- Row Level Security ----------
alter table public.bonus_weights  enable row level security;
alter table public.bonus_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bonus_weights','bonus_settings'] loop
    execute format('drop policy if exists "authenticated full access" on public.%I;', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- Done. The Team Bonus page can now save per-member KPI weights and max bonuses.
-- No seed data: the manager enters weights and max bonuses in the app.
