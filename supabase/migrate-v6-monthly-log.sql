-- ============================================================================
-- KPIeve — v6 migration (monthly running totals + change log)
-- Run ONCE on an existing v5 database (Supabase → SQL → New query).
-- Idempotent: safe to re-run.
--
-- Model change: entries hold ONE row per (kpi, member, market, MONTH), dated at
-- the month start (yyyy-MM-01). The value is the month's running total, which
-- Eve overwrites as it grows (15 → 17), not daily increments. Every change is
-- recorded in entry_audit by a trigger — the Update page's calendar shows this
-- change log, and the dashboard's day/week trends are reconstructed from it.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- 1) Collapse existing entries to one month-start row per cell ----------
-- Keep the LATEST value per (kpi, member, market, month) — running-total
-- semantics — and preserve created_at so the seeded log keeps real history.
-- Delete-then-reinsert avoids unique-constraint collisions on (…, date).
do $$
begin
  if exists (select 1 from public.entries where date <> date_trunc('month', date)::date) then
    create temp table _collapsed on commit drop as
    select distinct on (kpi_id, member_id, market_id, date_trunc('month', date))
           kpi_id, member_id, market_id,
           date_trunc('month', date)::date as mstart,
           value, target, note, source, created_at
    from public.entries
    order by kpi_id, member_id, market_id, date_trunc('month', date), date desc, updated_at desc;

    delete from public.entries;

    insert into public.entries (kpi_id, member_id, market_id, date, value, target, note, source, created_at)
    select kpi_id, member_id, market_id, mstart, value, target, note, source, created_at
    from _collapsed;
  end if;
end $$;

-- ---------- 2) Change log ----------
create table if not exists public.entry_audit (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.kpis(id)    on delete cascade,
  member_id  uuid references public.members(id)          on delete cascade,
  market_id  uuid references public.markets(id)          on delete cascade,
  period     date not null,            -- month start of the affected entry
  old_value  numeric,                  -- null → value was created
  new_value  numeric,                  -- null → value was removed
  changed_at timestamptz not null default now()
);

create index if not exists entry_audit_changed_at_idx on public.entry_audit(changed_at);
create index if not exists entry_audit_period_idx     on public.entry_audit(period);

-- ---------- 3) Row Level Security ----------
alter table public.entry_audit enable row level security;
drop policy if exists "authenticated full access" on public.entry_audit;
create policy "authenticated full access" on public.entry_audit
  for all to authenticated using (true) with check (true);

-- ---------- 4) Trigger: log every value change on entries ----------
-- UPDATE logs only real value changes — the Update grid re-saves every filled
-- cell on Save, and unchanged upserts must not spam the log.
create or replace function public.log_entry_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.entry_audit (kpi_id, member_id, market_id, period, old_value, new_value)
    values (new.kpi_id, new.member_id, new.market_id, new.date, null, new.value);
  elsif tg_op = 'UPDATE' then
    if new.value is distinct from old.value then
      insert into public.entry_audit (kpi_id, member_id, market_id, period, old_value, new_value)
      values (new.kpi_id, new.member_id, new.market_id, new.date, old.value, new.value);
    end if;
  else
    insert into public.entry_audit (kpi_id, member_id, market_id, period, old_value, new_value)
    values (old.kpi_id, old.member_id, old.market_id, old.date, old.value, null);
  end if;
  return null;
end $$;

drop trigger if exists trg_entries_audit on public.entries;
create trigger trg_entries_audit
  after insert or update or delete on public.entries
  for each row execute function public.log_entry_change();

-- ---------- 5) Seed the log from existing entries (run-once) ----------
-- One "created" event per current entry, timestamped when it was really entered.
insert into public.entry_audit (kpi_id, member_id, market_id, period, old_value, new_value, changed_at)
select kpi_id, member_id, market_id, date, null, value, created_at
from public.entries
where not exists (select 1 from public.entry_audit);

-- Done. Entries are monthly running totals; entry_audit records every change.
