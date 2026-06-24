-- ============================================================================
-- KPIeve — test data for Mar–Jun 2026 (run AFTER migrate-v5-quality-kpis.sql)
-- The app isn't in use yet, so this populates the live DB so every page has data.
-- Idempotent: entries use ON CONFLICT; sellers are guarded by an existence check.
-- Today is assumed ~2026-06-24, so June is the in-progress month.
-- ============================================================================

-- ---------- One market per member (1:1) ----------
delete from public.member_markets
  where member_id in (select id from public.members
    where name in ('Greta Kazlauskaitė','Karl Tamm','Marta Kowalska','Rūta Bērziņa'));

insert into public.member_markets (member_id, market_id)
select m.id, mk.id
from public.members m
join (values
  ('Greta Kazlauskaitė','LT'),
  ('Karl Tamm','EE'),
  ('Marta Kowalska','PL'),
  ('Rūta Bērziņa','LV')
) as a(name, code) on a.name = m.name
join public.markets mk on mk.code = a.code
on conflict do nothing;

-- ---------- Targets per (kpi, market, month) for Mar–Jul ----------
-- Uses each KPI's default_target across all markets (assortment = 100%).
insert into public.targets (kpi_id, market_id, period, value)
select k.id, mk.id, g.period, k.default_target
from public.kpis k
cross join public.markets mk
cross join (select generate_series('2026-03-01'::date, '2026-07-01'::date, interval '1 month')::date as period) g
where k.default_target is not null and k.active
on conflict (kpi_id, market_id, period) do nothing;

-- ---------- Base bonus pool per member for Mar–Jul ----------
insert into public.bonus_base (period, member_id, max_bonus)
select g.period, m.id, b.base
from public.members m
join (values
  ('Greta Kazlauskaitė', 1000),
  ('Karl Tamm',           900),
  ('Marta Kowalska',     1100),
  ('Rūta Bērziņa',        950)
) as b(name, base) on b.name = m.name
cross join (select generate_series('2026-03-01'::date, '2026-07-01'::date, interval '1 month')::date as period) g
on conflict (period, member_id) do nothing;

-- ---------- Copy July's per-market KPI config back to Mar–Jun ----------
-- (migrate-v5 seeded July; here we reuse the same structure for the test history.)
insert into public.bonus_kpi_markets (period, market_id, kpi_id, role, weight, eur_rate)
select g.period, b.market_id, b.kpi_id, b.role, b.weight, b.eur_rate
from public.bonus_kpi_markets b
cross join (select generate_series('2026-03-01'::date, '2026-06-01'::date, interval '1 month')::date as period) g
where b.period = '2026-07-01'
on conflict (period, market_id, kpi_id) do nothing;

-- ---------- Entries + per-seller assortment (deterministic, varied) ----------
do $$
declare
  rec record;
  m_idx int;
  v_period date;
  v_day1 date;
  v_day2 date;
  v_ramp numeric;
  v_lr numeric;
  v_active numeric;
  v_npass int;
  s int;
  v_total_sellers int := 5;
  karl_id uuid;
  k record;
  active_kpi uuid;
  first_order_kpi uuid;
  phh_setup_kpi uuid;
  phh_live_kpi uuid;
  fbp_kpi uuid;
  late_kpi uuid;
  d1 numeric;
  d2 numeric;
begin
  select id into active_kpi      from public.kpis where name = 'Sellers with 1st active offer';
  select id into first_order_kpi from public.kpis where name = 'Sellers with 1st order in 30 days';
  select id into phh_setup_kpi   from public.kpis where name = 'PHH account setup';
  select id into phh_live_kpi    from public.kpis where name = 'PHH live campaign';
  select id into fbp_kpi         from public.kpis where name = 'FBP';
  select id into late_kpi        from public.kpis where name = 'Late rate per portfolio CCD';
  select id into karl_id         from public.members where name = 'Karl Tamm';

  for rec in
    select m.id as member_id, mk.id as market_id, a.strength, a.passrate
    from public.members m
    join (values
      ('Greta Kazlauskaitė','LT', 1.05, 0.90),
      ('Karl Tamm',         'EE', 0.85, 0.60),
      ('Marta Kowalska',    'PL', 1.00, 0.80),
      ('Rūta Bērziņa',      'LV', 0.90, 0.50)
    ) as a(name, code, strength, passrate) on a.name = m.name
    join public.markets mk on mk.code = a.code
  loop
    for m_idx in 0..3 loop
      v_period := ('2026-03-01'::date + (m_idx || ' months')::interval)::date;
      v_ramp   := 0.82 + 0.06 * m_idx;
      v_day1   := v_period + 9;   -- 10th
      v_day2   := v_period + 19;  -- 20th

      -- 1st active offer (Karl has none in March → tests the extra-bonus gate).
      v_active := round(14 * rec.strength * v_ramp);
      if rec.member_id = karl_id and m_idx = 0 then v_active := 0; end if;

      -- Count KPIs (all SUM numbers) — split each month's total across two days.
      for k in
        select * from (values
          (active_kpi,      v_active),
          (first_order_kpi, round(8  * rec.strength * v_ramp)),
          (phh_setup_kpi,   round(10 * rec.strength * v_ramp)),
          (phh_live_kpi,    round(4  * rec.strength * v_ramp)),
          (fbp_kpi,         round(5  * rec.strength * v_ramp))
        ) as t(kpi_id, monthly)
      loop
        if k.monthly > 0 then
          d1 := ceil(k.monthly / 2.0);
          d2 := k.monthly - d1;
          if d1 > 0 and v_day1 <= current_date then
            insert into public.entries (kpi_id, member_id, market_id, date, value, source)
            values (k.kpi_id, rec.member_id, rec.market_id, v_day1, d1, 'manual')
            on conflict (kpi_id, member_id, market_id, date) do nothing;
          end if;
          if d2 > 0 and v_day2 <= current_date then
            insert into public.entries (kpi_id, member_id, market_id, date, value, source)
            values (k.kpi_id, rec.member_id, rec.market_id, v_day2, d2, 'manual')
            on conflict (kpi_id, member_id, market_id, date) do nothing;
          end if;
        end if;
      end loop;

      -- Late rate (AVG percent, lower is better) — one reading per update day.
      v_lr := round((4 + (1 - rec.strength) * 8) * (1.12 - 0.03 * m_idx), 1);
      if v_day1 <= current_date then
        insert into public.entries (kpi_id, member_id, market_id, date, value, source)
        values (late_kpi, rec.member_id, rec.market_id, v_day1, v_lr, 'manual')
        on conflict (kpi_id, member_id, market_id, date) do nothing;
      end if;
      if v_day2 <= current_date then
        insert into public.entries (kpi_id, member_id, market_id, date, value, source)
        values (late_kpi, rec.member_id, rec.market_id, v_day2, round(v_lr * 1.05, 1), 'manual')
        on conflict (kpi_id, member_id, market_id, date) do nothing;
      end if;

      -- Per-seller assortment (5 sellers; passrate drives how many clear their bar).
      if not exists (select 1 from public.assortment_sellers
                     where member_id = rec.member_id and period = v_period) then
        v_npass := round(rec.passrate * v_total_sellers);
        for s in 1..v_total_sellers loop
          if s <= v_npass then
            -- ≤100 SKUs, activated 70/80 = 87.5% ≥ 80% → PASS
            insert into public.assortment_sellers (member_id, market_id, period, name, planned_skus, activated_skus)
            values (rec.member_id, rec.market_id, v_period, 'Seller ' || s, 80, 70);
          else
            -- ≤100 SKUs, activated 40/80 = 50% < 80% → FAIL
            insert into public.assortment_sellers (member_id, market_id, period, name, planned_skus, activated_skus)
            values (rec.member_id, rec.market_id, v_period, 'Seller ' || s, 80, 40);
          end if;
        end loop;
      end if;
    end loop;
  end loop;
end $$;

-- Done. Reload the app: Dashboard / Forecast / Activity / Team Bonus now have Mar–Jun data.
-- Note: Karl Tamm has no 1st active offer in March, so his extra bonuses are gated off that month.
