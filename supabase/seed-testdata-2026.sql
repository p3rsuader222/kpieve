-- ============================================================================
-- KPIeve — test data for Mar–Jun 2026 (run AFTER migrate-v5-quality-kpis.sql)
-- The app isn't in use yet, so this populates the live DB so every page has data.
-- Works with WHATEVER members exist in your database — it reads each member's
-- own market assignment (member_markets); no names are hardcoded.
-- Idempotent and safe to re-run — entries use ON CONFLICT, sellers are guarded.
-- All four months are fully populated (no dependency on the server's clock).
-- ============================================================================

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
select g.period, m.id, 1000
from public.members m
cross join (select generate_series('2026-03-01'::date, '2026-07-01'::date, interval '1 month')::date as period) g
where m.active
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
-- Loops over every active member, using their assigned market. A per-member
-- "row number" drives deterministic strength + assortment pass-rate so some
-- KPIs clear their bar and some don't. The 2nd member gets no 1st active offer
-- in March, which exercises the extra-bonus gate.
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

  for rec in
    select sub.member_id, sub.market_id, sub.rn,
           (0.82 + ((sub.rn - 1) % 5) * 0.06)::numeric as strength,
           (0.40 + ((sub.rn - 1) % 4) * 0.20)::numeric as passrate
    from (
      select m.id as member_id,
             (select mm.market_id from public.member_markets mm
                where mm.member_id = m.id order by mm.market_id limit 1) as market_id,
             row_number() over (order by m.sort_order, m.id) as rn
      from public.members m
      where m.active
    ) sub
    where sub.market_id is not null
  loop
    for m_idx in 0..3 loop
      v_period := ('2026-03-01'::date + (m_idx || ' months')::interval)::date;
      v_ramp   := 0.82 + 0.06 * m_idx;
      v_day1   := v_period + 9;   -- 10th
      v_day2   := v_period + 19;  -- 20th

      -- 1st active offer (2nd member has none in March → tests the extra-bonus gate).
      v_active := round(14 * rec.strength * v_ramp);
      if rec.rn = 2 and m_idx = 0 then v_active := 0; end if;

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
          if d1 > 0 then
            insert into public.entries (kpi_id, member_id, market_id, date, value, source)
            values (k.kpi_id, rec.member_id, rec.market_id, v_day1, d1, 'manual')
            on conflict (kpi_id, member_id, market_id, date) do nothing;
          end if;
          if d2 > 0 then
            insert into public.entries (kpi_id, member_id, market_id, date, value, source)
            values (k.kpi_id, rec.member_id, rec.market_id, v_day2, d2, 'manual')
            on conflict (kpi_id, member_id, market_id, date) do nothing;
          end if;
        end if;
      end loop;

      -- Late rate (AVG percent, lower is better) — one reading per update day.
      v_lr := round((4 + (1 - rec.strength) * 8) * (1.12 - 0.03 * m_idx), 1);
      insert into public.entries (kpi_id, member_id, market_id, date, value, source)
      values (late_kpi, rec.member_id, rec.market_id, v_day1, v_lr, 'manual')
      on conflict (kpi_id, member_id, market_id, date) do nothing;
      insert into public.entries (kpi_id, member_id, market_id, date, value, source)
      values (late_kpi, rec.member_id, rec.market_id, v_day2, round(v_lr * 1.05, 1), 'manual')
      on conflict (kpi_id, member_id, market_id, date) do nothing;

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

-- Done. Reload the app: Dashboard / Forecast / Activity / Team Bonus now have all 4 months.
-- Note: each member must have a market assigned (Settings → member) to receive data.
