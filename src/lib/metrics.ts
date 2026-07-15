import {
  addDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import type { AssortmentSeller, BonusRole, DashboardData, Entry, Kpi, KpiAggregation, KpiMarketConfig, Market, Member, TimeRange } from './types'
import { attainment, deltaIsGood, statusFromAttainment, type Status } from './status'

// ---------- Monthly periods (v2) ----------

/** Normalise any ISO date to its month-start string (yyyy-MM-01). */
export function monthStart(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(startOfMonth(d), 'yyyy-MM-dd')
}

/** The month immediately before `period`. */
export function prevPeriod(period: string): string {
  return format(subMonths(parseISO(period), 1), 'yyyy-MM-dd')
}

export function nextPeriod(period: string): string {
  return format(subMonths(parseISO(period), -1), 'yyyy-MM-dd')
}

/** Distinct month-start periods present in the data, ascending. */
export function listPeriods(data: DashboardData): string[] {
  const set = new Set<string>()
  for (const e of data.entries) set.add(monthStart(e.date))
  for (const t of data.targets) set.add(t.period)
  return [...set].sort()
}

/** Most recent month present (falls back to the current month). */
export function latestPeriod(data: DashboardData): string {
  const periods = listPeriods(data)
  return periods.length ? periods[periods.length - 1] : monthStart(new Date())
}

/** Authoritative per-country target for (kpi, market, month); falls back to default_target. */
export function periodTarget(
  data: DashboardData,
  kpiId: string,
  marketId: string,
  period: string,
): number | null {
  const row = data.targets.find(
    (t) => t.kpi_id === kpiId && t.market_id === marketId && t.period === period,
  )
  if (row) return row.value
  const kpi = data.kpis.find((k) => k.id === kpiId)
  return kpi?.default_target ?? null
}

/** Sum of country targets across all markets for (kpi, month) — the TOTAL target. */
export function totalTarget(data: DashboardData, kpi: Kpi, period: string): number | null {
  const vals = data.markets
    .map((m) => periodTarget(data, kpi.id, m.id, period))
    .filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return kpi.aggregation === 'sum' ? vals.reduce((s, v) => s + v, 0) : vals.reduce((s, v) => s + v, 0) / vals.length
}

/** Last day of the month that `period` (a month-start) belongs to. */
export function monthEnd(period: string): string {
  return format(endOfMonth(parseISO(period)), 'yyyy-MM-dd')
}

/**
 * Aggregated FACT for (kpi, month) optionally scoped to a market/member.
 * Rolls up ALL daily entries within the month: SUM KPIs add up across days
 * (and members/markets), AVG KPIs take the mean over the period.
 */
export function periodFact(
  data: DashboardData,
  kpi: Kpi,
  period: string,
  scope: Pick<EntryFilter, 'memberId' | 'marketId'> = {},
): number | null {
  // Derived KPIs (assortment) come from the sellers table, not rolled-up entries.
  if (kpi.compute === 'assortment') return assortmentFact(data, period, scope)
  const rows = filterEntries(data.entries, { kpiId: kpi.id, ...scope, start: period, end: monthEnd(period) })
  return aggregate(rows, kpi.aggregation).value
}

/** Whether one seller cleared their assortment bar (≤100 SKUs → 80%, >100 → 50%). */
export function assortmentPassed(s: AssortmentSeller): boolean {
  if (s.planned_skus <= 0) return false
  const bar = s.planned_skus <= 100 ? 0.8 : 0.5
  return s.activated_skus / s.planned_skus >= bar
}

/**
 * Derived "Planned assortment completeness" fact: % of onboarded sellers (in scope,
 * for `period`) who passed their own 80/50 bar. Null when no sellers were recorded.
 */
export function assortmentFact(
  data: DashboardData,
  period: string,
  scope: Pick<EntryFilter, 'memberId' | 'marketId'> = {},
): number | null {
  const considered = data.assortmentSellers.filter(
    (s) =>
      s.period === period &&
      s.planned_skus > 0 &&
      (scope.marketId === undefined || s.market_id === scope.marketId) &&
      (scope.memberId === undefined || s.member_id === scope.memberId),
  )
  if (considered.length === 0) return null
  const passed = considered.filter(assortmentPassed).length
  return (passed / considered.length) * 100
}

export type Granularity = 'day' | 'week' | 'month'

function clampToday(d: Date): Date {
  const now = new Date()
  return d > now ? now : d
}

/** Ascending bucket-start strings for the trend at a given granularity. */
export function trendBuckets(data: DashboardData, granularity: Granularity, period: string): string[] {
  if (granularity === 'month') return listPeriods(data)
  const start = parseISO(period)
  const end = clampToday(parseISO(monthEnd(period)))
  if (start > end) return []
  if (granularity === 'day') {
    return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'))
  }
  return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((d) =>
    format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  )
}

function bucketEndOf(start: string, granularity: Granularity): string {
  if (granularity === 'month') return monthEnd(start)
  if (granularity === 'week') return format(addDays(parseISO(start), 6), 'yyyy-MM-dd')
  return start
}

/**
 * Aggregated fact for a single trend bucket (day / week / month).
 * `period` names the month being charted — needed for day/week buckets because
 * week buckets can straddle month boundaries.
 */
export function bucketFact(
  data: DashboardData,
  kpi: Kpi,
  start: string,
  granularity: Granularity,
  scope: Pick<EntryFilter, 'memberId' | 'marketId'> = {},
  period?: string,
): number | null {
  // Assortment is a monthly, per-seller derived metric — only meaningful per month.
  if (kpi.compute === 'assortment') {
    return granularity === 'month' ? assortmentFact(data, monthStart(start), scope) : null
  }
  if (granularity === 'month') {
    const rows = filterEntries(data.entries, { kpiId: kpi.id, ...scope, start, end: bucketEndOf(start, granularity) })
    return aggregate(rows, kpi.aggregation).value
  }
  // Entries are monthly running totals, so day/week views reconstruct the
  // month's progression from the change log instead of summing daily rows.
  return auditSnapshotFact(data, kpi, period ?? monthStart(start), bucketEndOf(start, granularity), scope)
}

/**
 * Running-total snapshot at end of `day`: for each (member, market) cell, the
 * latest logged value for (kpi, month) at or before that moment — summed for
 * SUM KPIs, averaged for AVG KPIs. Null when nothing was logged yet.
 */
function auditSnapshotFact(
  data: DashboardData,
  kpi: Kpi,
  month: string,
  day: string,
  scope: Pick<EntryFilter, 'memberId' | 'marketId'>,
): number | null {
  const cutoff = endOfDay(parseISO(day))
  const latest = new Map<string, number | null>()
  // entryAudit is ordered by changed_at ascending, so the last write per cell wins.
  for (const a of data.entryAudit) {
    if (a.kpi_id !== kpi.id || a.period !== month) continue
    if (scope.memberId !== undefined && a.member_id !== scope.memberId) continue
    if (scope.marketId !== undefined && a.market_id !== scope.marketId) continue
    if (new Date(a.changed_at) > cutoff) continue
    latest.set(`${a.member_id}:${a.market_id}`, a.new_value)
  }
  const vals = [...latest.values()].filter((v): v is number => v != null)
  if (vals.length === 0) return null
  const sum = vals.reduce((s, v) => s + v, 0)
  return kpi.aggregation === 'sum' ? sum : sum / vals.length
}

/** Local calendar day (yyyy-MM-dd) an audit change happened on. */
export function changeDay(changedAt: string): string {
  return format(new Date(changedAt), 'yyyy-MM-dd')
}

/** One cell's NET change over one local day: first old value → last new value. */
export interface NetChange {
  kpi_id: string
  member_id: string | null
  market_id: string | null
  period: string // month the edited entry belongs to
  day: string // local yyyy-MM-dd the edits happened on
  old_value: number | null
  new_value: number | null
  changed_at: string // last edit that day
}

/**
 * The change log as Eve reads it: repeated edits to the same cell within one
 * day collapse into a single first → last change, and cells that end the day
 * exactly where they started drop out entirely. Raw events stay in entry_audit;
 * this is a display-level rollup. Ordered chronologically by first edit.
 */
export function netChanges(data: DashboardData): NetChange[] {
  const byKey = new Map<string, NetChange>()
  for (const a of data.entryAudit) {
    // entryAudit is ordered by changed_at ascending.
    const day = changeDay(a.changed_at)
    const key = `${a.kpi_id}:${a.member_id}:${a.market_id}:${a.period}:${day}`
    const cur = byKey.get(key)
    if (cur) {
      cur.new_value = a.new_value
      cur.changed_at = a.changed_at
    } else {
      byKey.set(key, {
        kpi_id: a.kpi_id,
        member_id: a.member_id,
        market_id: a.market_id,
        period: a.period,
        day,
        old_value: a.old_value,
        new_value: a.new_value,
        changed_at: a.changed_at,
      })
    }
  }
  return [...byKey.values()].filter((c) => c.old_value !== c.new_value)
}

/**
 * Per-day CHANGE activity for `period`'s month: how many cells NET-changed on
 * each local day. Keyed by ISO day; only days with at least one net change are
 * present. Feeds the change-log calendar.
 */
export function changeActivityInMonth(data: DashboardData, period: string): Map<string, number> {
  const end = monthEnd(period)
  const out = new Map<string, number>()
  for (const c of netChanges(data)) {
    if (c.day >= period && c.day <= end) out.set(c.day, (out.get(c.day) ?? 0) + 1)
  }
  return out
}

// ---------- Filtering & ranges ----------

export interface EntryFilter {
  kpiId?: string
  memberId?: string
  marketId?: string
  start?: string // inclusive ISO date
  end?: string // inclusive ISO date
}

export function filterEntries(entries: Entry[], f: EntryFilter): Entry[] {
  return entries.filter(
    (e) =>
      (f.kpiId === undefined || e.kpi_id === f.kpiId) &&
      (f.memberId === undefined || e.member_id === f.memberId) &&
      (f.marketId === undefined || e.market_id === f.marketId) &&
      (f.start === undefined || e.date >= f.start) &&
      (f.end === undefined || e.date <= f.end),
  )
}

export function latestDate(entries: Entry[]): string {
  let max = ''
  for (const e of entries) if (e.date > max) max = e.date
  return max || format(new Date(), 'yyyy-MM-dd')
}

const RANGE_DAYS: Record<TimeRange, number> = { today: 1, week: 7, month: 30 }

export interface Bounds {
  start: string
  end: string
}

export function rangeBounds(range: TimeRange, latest: string): Bounds {
  const end = parseISO(latest)
  const span = RANGE_DAYS[range] - 1
  return { start: format(addDays(end, -span), 'yyyy-MM-dd'), end: latest }
}

/** The window of equal length immediately preceding `b`. */
export function previousBounds(b: Bounds, range: TimeRange): Bounds {
  const len = RANGE_DAYS[range]
  const prevEnd = addDays(parseISO(b.start), -1)
  return {
    start: format(addDays(prevEnd, -(len - 1)), 'yyyy-MM-dd'),
    end: format(prevEnd, 'yyyy-MM-dd'),
  }
}

// ---------- Aggregation ----------

export interface Agg {
  value: number | null
  target: number | null
  count: number
}

export function aggregate(entries: Entry[], aggregation: KpiAggregation): Agg {
  if (entries.length === 0) return { value: null, target: null, count: 0 }
  let vSum = 0
  let tSum = 0
  let tCount = 0
  for (const e of entries) {
    vSum += e.value
    if (e.target != null) {
      tSum += e.target
      tCount++
    }
  }
  if (aggregation === 'sum') {
    return { value: vSum, target: tCount ? tSum : null, count: entries.length }
  }
  return {
    value: vSum / entries.length,
    target: tCount ? tSum / tCount : null,
    count: entries.length,
  }
}

// ---------- Time series ----------

export interface SeriesPoint {
  date: string
  value: number | null
  target: number | null
}

/** One aggregated point per day (sorted ascending) for the given entry set. */
export function seriesByDay(entries: Entry[], aggregation: KpiAggregation): SeriesPoint[] {
  const byDate = new Map<string, Entry[]>()
  for (const e of entries) {
    const arr = byDate.get(e.date)
    if (arr) arr.push(e)
    else byDate.set(e.date, [e])
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => {
      const a = aggregate(byDate.get(date)!, aggregation)
      return { date, value: a.value, target: a.target }
    })
}

// ---------- KPI snapshot (for cards) ----------

export interface KpiSnapshot {
  kpi: Kpi
  value: number | null
  target: number | null
  attainment: number | null
  status: Status
  delta: number | null
  deltaGood: boolean
  spark: SeriesPoint[]
}

const SPARK_DAYS = 16

export function kpiSnapshot(
  data: DashboardData,
  kpi: Kpi,
  range: TimeRange,
  scope: Pick<EntryFilter, 'memberId' | 'marketId'> = {},
): KpiSnapshot {
  const latest = latestDate(data.entries)
  const b = rangeBounds(range, latest)
  const pb = previousBounds(b, range)

  const cur = aggregate(
    filterEntries(data.entries, { kpiId: kpi.id, ...scope, start: b.start, end: b.end }),
    kpi.aggregation,
  )
  const prev = aggregate(
    filterEntries(data.entries, { kpiId: kpi.id, ...scope, start: pb.start, end: pb.end }),
    kpi.aggregation,
  )

  const a = attainment(cur.value, cur.target, kpi.direction, kpi.risk_grace)
  const delta = cur.value != null && prev.value != null ? cur.value - prev.value : null

  const spark = seriesByDay(
    filterEntries(data.entries, { kpiId: kpi.id, ...scope }),
    kpi.aggregation,
  ).slice(-SPARK_DAYS)

  return {
    kpi,
    value: cur.value,
    target: cur.target,
    attainment: a,
    status: statusFromAttainment(a),
    delta,
    deltaGood: delta == null ? true : deltaIsGood(delta, kpi.direction),
    spark,
  }
}

export function kpiSnapshots(data: DashboardData, range: TimeRange): KpiSnapshot[] {
  return activeKpis(data).map((k) => kpiSnapshot(data, k, range))
}

// ---------- Breakdowns ----------

export interface BreakdownRow<T> {
  entity: T
  value: number | null
  target: number | null
  attainment: number | null
  status: Status
}

export function byMarket(data: DashboardData, kpi: Kpi, range: TimeRange): BreakdownRow<Market>[] {
  const b = rangeBounds(range, latestDate(data.entries))
  return [...data.markets]
    .sort((a, z) => a.sort_order - z.sort_order)
    .map((market) => {
      const agg = aggregate(
        filterEntries(data.entries, { kpiId: kpi.id, marketId: market.id, start: b.start, end: b.end }),
        kpi.aggregation,
      )
      const a = attainment(agg.value, agg.target, kpi.direction, kpi.risk_grace)
      return { entity: market, value: agg.value, target: agg.target, attainment: a, status: statusFromAttainment(a) }
    })
}

export function byMember(data: DashboardData, kpi: Kpi, range: TimeRange): BreakdownRow<Member>[] {
  const b = rangeBounds(range, latestDate(data.entries))
  return activeMembers(data).map((member) => {
    const agg = aggregate(
      filterEntries(data.entries, { kpiId: kpi.id, memberId: member.id, start: b.start, end: b.end }),
      kpi.aggregation,
    )
    const a = attainment(agg.value, agg.target, kpi.direction, kpi.risk_grace)
    return { entity: member, value: agg.value, target: agg.target, attainment: a, status: statusFromAttainment(a) }
  })
}

// ---------- Adherence (share of KPIs on track) ----------

function adherence(snapshots: { status: Status }[]): number | null {
  const scored = snapshots.filter((s) => s.status !== 'none')
  if (scored.length === 0) return null
  return scored.filter((s) => s.status === 'good').length / scored.length
}

export function overallAdherence(data: DashboardData, range: TimeRange): number | null {
  return adherence(kpiSnapshots(data, range))
}

export function memberAdherence(data: DashboardData, member: Member, range: TimeRange): number | null {
  const b = rangeBounds(range, latestDate(data.entries))
  const snaps = activeKpis(data).map((kpi) => {
    const agg = aggregate(
      filterEntries(data.entries, { kpiId: kpi.id, memberId: member.id, start: b.start, end: b.end }),
      kpi.aggregation,
    )
    return { status: statusFromAttainment(attainment(agg.value, agg.target, kpi.direction, kpi.risk_grace)) }
  })
  return adherence(snaps)
}

// ---------- Heatmap (member × market) ----------

export interface HeatCell {
  memberId: string
  marketId: string
  covered: boolean
  attainment: number | null
  status: Status
}

/**
 * Member × market grid of attainment. With `kpi` → that KPI; without → mean
 * attainment across all active KPIs for the cell.
 */
export function heatmap(data: DashboardData, range: TimeRange, kpi?: Kpi): HeatCell[] {
  const b = rangeBounds(range, latestDate(data.entries))
  const kpis = kpi ? [kpi] : activeKpis(data)
  const cells: HeatCell[] = []
  for (const member of activeMembers(data)) {
    for (const market of data.markets) {
      const covered = member.marketIds.includes(market.id)
      if (!covered) {
        cells.push({ memberId: member.id, marketId: market.id, covered: false, attainment: null, status: 'none' })
        continue
      }
      const vals: number[] = []
      for (const k of kpis) {
        const agg = aggregate(
          filterEntries(data.entries, { kpiId: k.id, memberId: member.id, marketId: market.id, start: b.start, end: b.end }),
          k.aggregation,
        )
        const a = attainment(agg.value, agg.target, k.direction, k.risk_grace)
        if (a != null) vals.push(Math.min(a, 1.25))
      }
      const mean = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null
      cells.push({ memberId: member.id, marketId: market.id, covered: true, attainment: mean, status: statusFromAttainment(mean) })
    }
  }
  return cells
}

// ---------- Small helpers ----------

export function activeKpis(data: DashboardData): Kpi[] {
  return data.kpis.filter((k) => k.active).sort((a, z) => a.sort_order - z.sort_order)
}

export function activeMembers(data: DashboardData): Member[] {
  return data.members.filter((m) => m.active).sort((a, z) => a.sort_order - z.sort_order)
}

export function marketById(data: DashboardData, id: string | null): Market | undefined {
  return id ? data.markets.find((m) => m.id === id) : undefined
}

// ============================================================
//  Period-based engine (v2 — country-first, monthly cadence)
// ============================================================

export interface PeriodScope {
  memberId?: string
  marketId?: string
}

/** Active members covering a market. */
export function coveringMembers(data: DashboardData, marketId: string): Member[] {
  return activeMembers(data).filter((m) => m.marketIds.includes(marketId))
}

/**
 * Target to compare a single member×market cell against: the country target is
 * split evenly across covering members for SUM KPIs (each owns a share), and kept
 * whole for AVG KPIs (everyone aims at the same average).
 */
export function cellTarget(data: DashboardData, kpi: Kpi, marketId: string, period: string): number | null {
  const ct = periodTarget(data, kpi.id, marketId, period)
  if (ct == null) return null
  if (kpi.aggregation !== 'sum') return ct
  const n = Math.max(1, coveringMembers(data, marketId).length)
  return ct / n
}

/** A member's target for a KPI/month: sum of their per-market shares (sum KPIs) or the mean target (avg KPIs). */
export function memberTargetForPeriod(data: DashboardData, kpi: Kpi, member: Member, period: string): number | null {
  const vals = member.marketIds
    .map((mid) => (kpi.aggregation === 'sum' ? cellTarget(data, kpi, mid, period) : periodTarget(data, kpi.id, mid, period)))
    .filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return kpi.aggregation === 'sum' ? vals.reduce((s, v) => s + v, 0) : vals.reduce((s, v) => s + v, 0) / vals.length
}

/** Monthly fact/target series across every period present (one point per month). */
export function monthlySeries(data: DashboardData, kpi: Kpi, scope: PeriodScope = {}): SeriesPoint[] {
  return listPeriods(data).map((period) => ({
    date: period,
    value: periodFact(data, kpi, period, scope),
    target: scope.marketId
      ? periodTarget(data, kpi.id, scope.marketId, period)
      : totalTarget(data, kpi, period),
  }))
}

/** Snapshot for a single month, scoped to a market (country), the whole team (TOTAL), or a member. */
export function snapshotForPeriod(
  data: DashboardData,
  kpi: Kpi,
  period: string,
  scope: PeriodScope = {},
): KpiSnapshot {
  const value = periodFact(data, kpi, period, scope)
  const target = scope.memberId
    ? memberTargetForPeriod(data, kpi, data.members.find((m) => m.id === scope.memberId)!, period)
    : scope.marketId
      ? periodTarget(data, kpi.id, scope.marketId, period)
      : totalTarget(data, kpi, period)
  const a = attainment(value, target, kpi.direction, kpi.risk_grace)
  const prev = periodFact(data, kpi, prevPeriod(period), scope)
  const delta = value != null && prev != null ? value - prev : null
  const spark = monthlySeries(data, kpi, scope)
    .filter((p) => p.date <= period)
    .slice(-6)
  return {
    kpi,
    value,
    target,
    attainment: a,
    status: statusFromAttainment(a),
    delta,
    deltaGood: delta == null ? true : deltaIsGood(delta, kpi.direction),
    spark,
  }
}

export function snapshotsForPeriod(data: DashboardData, period: string, scope: PeriodScope = {}): KpiSnapshot[] {
  return activeKpis(data).map((k) => snapshotForPeriod(data, k, period, scope))
}

export function byMarketPeriod(data: DashboardData, kpi: Kpi, period: string): BreakdownRow<Market>[] {
  return [...data.markets]
    .sort((a, z) => a.sort_order - z.sort_order)
    .map((market) => {
      const value = periodFact(data, kpi, period, { marketId: market.id })
      const target = periodTarget(data, kpi.id, market.id, period)
      const a = attainment(value, target, kpi.direction, kpi.risk_grace)
      return { entity: market, value, target, attainment: a, status: statusFromAttainment(a) }
    })
}

export function byMemberPeriod(data: DashboardData, kpi: Kpi, period: string): BreakdownRow<Member>[] {
  return activeMembers(data).map((member) => {
    const value = periodFact(data, kpi, period, { memberId: member.id })
    const target = memberTargetForPeriod(data, kpi, member, period)
    const a = attainment(value, target, kpi.direction, kpi.risk_grace)
    return { entity: member, value, target, attainment: a, status: statusFromAttainment(a) }
  })
}

export function memberAdherencePeriod(data: DashboardData, member: Member, period: string): number | null {
  const snaps = activeKpis(data).map((kpi) => {
    const value = periodFact(data, kpi, period, { memberId: member.id })
    const target = memberTargetForPeriod(data, kpi, member, period)
    return { status: statusFromAttainment(attainment(value, target, kpi.direction, kpi.risk_grace)) }
  })
  return adherence(snaps)
}

export function overallAdherencePeriod(data: DashboardData, period: string): number | null {
  return adherence(snapshotsForPeriod(data, period))
}

/** Member × market grid of attainment for one month (mean across KPIs, or one KPI). */
export function heatmapPeriod(data: DashboardData, period: string, kpi?: Kpi): HeatCell[] {
  const kpis = kpi ? [kpi] : activeKpis(data)
  const cells: HeatCell[] = []
  for (const member of activeMembers(data)) {
    for (const market of data.markets) {
      const covered = member.marketIds.includes(market.id)
      if (!covered) {
        cells.push({ memberId: member.id, marketId: market.id, covered: false, attainment: null, status: 'none' })
        continue
      }
      const vals: number[] = []
      for (const k of kpis) {
        const value = periodFact(data, k, period, { memberId: member.id, marketId: market.id })
        const a = attainment(value, cellTarget(data, k, market.id, period), k.direction, k.risk_grace)
        if (a != null) vals.push(Math.min(a, 1.25))
      }
      const mean = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null
      cells.push({ memberId: member.id, marketId: market.id, covered: true, attainment: mean, status: statusFromAttainment(mean) })
    }
  }
  return cells
}

export interface MatrixCell {
  fact: number | null
  target: number | null
  attainment: number | null
  status: Status
}

export interface MatrixRow {
  /** null marks the TOTAL row. */
  market: Market | null
  id: string
  code: string
  name: string
  cells: Record<string, MatrixCell>
  adherence: number | null
}

/** The country × KPI matrix (LT/LV/EE/PL rows + TOTAL), the dashboard centerpiece. */
export function countryMatrix(data: DashboardData, period: string): MatrixRow[] {
  const kpis = activeKpis(data)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)

  const build = (market: Market | null): MatrixRow => {
    const cells: Record<string, MatrixCell> = {}
    const statuses: { status: Status }[] = []
    for (const kpi of kpis) {
      const scope: PeriodScope = market ? { marketId: market.id } : {}
      const fact = periodFact(data, kpi, period, scope)
      const target = market ? periodTarget(data, kpi.id, market.id, period) : totalTarget(data, kpi, period)
      const a = attainment(fact, target, kpi.direction, kpi.risk_grace)
      const status = statusFromAttainment(a)
      cells[kpi.id] = { fact, target, attainment: a, status }
      statuses.push({ status })
    }
    return {
      market,
      id: market?.id ?? 'total',
      code: market?.code ?? 'ALL',
      name: market?.name ?? 'Total',
      cells,
      adherence: adherence(statuses),
    }
  }

  return [...markets.map(build), build(null)]
}

// ============================================================
//  Team bonus
// ============================================================

/** Default attainment ceiling (percent) counted toward a bonus payout. */
export const DEFAULT_BONUS_CAP_PCT = 150
/** Default minimum attainment (percent) before a KPI pays any bonus. */
export const DEFAULT_BONUS_FLOOR_PCT = 80

/** Name of the gating KPI: extra bonuses pay only for sellers with a 1st active offer. */
export const ACTIVE_OFFER_KPI_NAME = 'Sellers with 1st active offer'

/** The single market a member belongs to (Eve's model: one market per person). */
export function memberMarketId(member: Member): string | null {
  return member.marketIds[0] ?? null
}

/** A member's base bonus pool for `period` (0 if unset). */
export function memberBaseBonus(data: DashboardData, memberId: string, period: string): number {
  return data.bonusBase.find((b) => b.member_id === memberId && b.period === period)?.max_bonus ?? 0
}

/** The bonus-plan config rows (core weights / extra rates) for a market in `period`. */
export function marketKpiConfig(data: DashboardData, period: string, marketId: string): KpiMarketConfig[] {
  return data.kpiMarketConfig.filter((c) => c.period === period && c.market_id === marketId)
}

export interface MemberBonusKpi {
  kpi: Kpi
  role: BonusRole
  weight: number // percent 0..100 (weighted part; 0 = none)
  value: number | null // the month's fact (doubles as the qualifying-seller count)
  target: number | null // weighted part only
  attainment: number | null // weighted part only
  cappedAttainment: number | null // min(attainment, row cap)
  /** Paid something: weighted part reached its floor, or the €/seller part paid. */
  met: boolean
  portion: number // base * weight/100 — the weighted payout at 100%
  eurRate: number // € per qualifying seller (additional only; 0 = none)
  floorPct: number // row floor (percent) for the weighted part
  capPct: number // row ceiling (percent) for the weighted part
  bonus: number
}

export interface MemberBonus {
  member: Member
  market: Market | null
  maxBonus: number // the member's base pool for the month
  weightSum: number // sum of CORE weights (percent) — should be 100
  coreKpis: MemberBonusKpi[]
  /** Non-mandatory rows: pay on top of the pool — pure upside. */
  additionalKpis: MemberBonusKpi[]
  coreBonus: number
  additionalBonus: number
  finalBonus: number
  /** €/seller payouts are gated on the member having ≥1 seller with a 1st active offer. */
  hasActiveOffer: boolean
}

/**
 * Each member's bonus for `period`, scored against THEIR single market's plan:
 *  - CORE (mandatory) KPIs pay `base × weight/100 × attainment` (per-row cap),
 *    only once attainment reaches the row's floor; weights should sum to 100%;
 *  - ADDITIONAL (non-mandatory) KPIs pay on top of the pool: a weight % scored
 *    the same way, and/or `count × €/seller` (gated on a 1st active offer).
 * Members/markets with no plan rows for the month contribute 0.
 */
export function teamBonus(data: DashboardData, period: string): MemberBonus[] {
  const kpiById = new Map(data.kpis.map((k) => [k.id, k]))
  const activeOffer = data.kpis.find((k) => k.name === ACTIVE_OFFER_KPI_NAME)

  return activeMembers(data).map((member) => {
    const marketId = memberMarketId(member)
    const market = marketId ? data.markets.find((m) => m.id === marketId) ?? null : null
    const base = memberBaseBonus(data, member.id, period)
    const config = marketId ? marketKpiConfig(data, period, marketId) : []

    const offerCount = activeOffer ? periodFact(data, activeOffer, period, { memberId: member.id }) ?? 0 : 0
    const hasActiveOffer = offerCount > 0

    const coreKpis: MemberBonusKpi[] = []
    const additionalKpis: MemberBonusKpi[] = []
    let weightSum = 0
    let coreBonus = 0
    let additionalBonus = 0

    for (const c of config) {
      const kpi = kpiById.get(c.kpi_id)
      if (!kpi || !kpi.active) continue
      const floorPct = c.floor_pct ?? DEFAULT_BONUS_FLOOR_PCT
      const capPct = c.cap_pct ?? DEFAULT_BONUS_CAP_PCT

      const value = periodFact(data, kpi, period, { memberId: member.id })

      // Weighted part (core rows always; additional rows when a weight is set).
      let att: number | null = null
      let cappedAttainment: number | null = null
      let weightedMet = false
      let weightedBonus = 0
      const portion = (base * c.weight) / 100
      if (c.weight > 0) {
        const target = memberTargetForPeriod(data, kpi, member, period)
        att = attainment(value, target, kpi.direction, kpi.risk_grace)
        cappedAttainment = att == null ? null : Math.min(att, capPct / 100)
        weightedMet = att != null && att >= floorPct / 100
        weightedBonus = weightedMet && cappedAttainment != null ? portion * cappedAttainment : 0
      }

      // €/seller part (additional rows only), gated on the 1st-active-offer rule.
      const count = value ?? 0
      const ratePaid = c.role === 'additional' && c.eur_rate > 0 && hasActiveOffer && count > 0
      const rateBonus = ratePaid ? count * c.eur_rate : 0

      const bonus = weightedBonus + rateBonus
      const row: MemberBonusKpi = {
        kpi,
        role: c.role,
        weight: c.weight,
        value,
        target: c.weight > 0 ? memberTargetForPeriod(data, kpi, member, period) : null,
        attainment: att,
        cappedAttainment,
        met: weightedMet || ratePaid,
        portion,
        eurRate: c.role === 'additional' ? c.eur_rate : 0,
        floorPct,
        capPct,
        bonus,
      }

      if (c.role === 'core') {
        weightSum += c.weight
        coreBonus += bonus
        coreKpis.push(row)
      } else {
        additionalBonus += bonus
        additionalKpis.push(row)
      }
    }

    coreKpis.sort((a, z) => a.kpi.sort_order - z.kpi.sort_order)
    additionalKpis.sort((a, z) => a.kpi.sort_order - z.kpi.sort_order)

    return {
      member,
      market,
      maxBonus: base,
      weightSum,
      coreKpis,
      additionalKpis,
      coreBonus,
      additionalBonus,
      finalBonus: coreBonus + additionalBonus,
      hasActiveOffer,
    }
  })
}

// ============================================================
//  Forecast engine (next-month projection)
// ============================================================

/** A saved manual projection for (kpi, market, month); null when unset (no default fallback). */
export function savedForecast(
  data: DashboardData,
  kpiId: string,
  marketId: string,
  period: string,
): number | null {
  const row = data.forecasts.find(
    (f) => f.kpi_id === kpiId && f.market_id === marketId && f.period === period,
  )
  return row ? row.value : null
}

/**
 * The most recent `n` *completed* months strictly before `period` — i.e. months
 * whose end has already passed (`today`). The in-progress current month and any
 * future months between today and the forecast month are skipped, so a baseline
 * computed from these isn't dragged down by a half-finished month.
 */
export function completedMonthsBefore(period: string, n: number, today: Date = new Date()): string[] {
  const todayStr = format(today, 'yyyy-MM-dd')
  const out: string[] = []
  let p = prevPeriod(period)
  let guard = 0
  while (out.length < n && guard < 60) {
    if (monthEnd(p) < todayStr) out.push(p)
    p = prevPeriod(p)
    guard++
  }
  return out
}

/**
 * Mean FACT across the last `n` completed months before `period` (the suggested
 * forecast baseline). Months with no data are skipped; returns null when none of
 * the lookback months have data.
 */
export function avgLastNFact(
  data: DashboardData,
  kpi: Kpi,
  period: string,
  n: number,
  scope: PeriodScope = {},
): number | null {
  const vals = completedMonthsBefore(period, n)
    .map((p) => periodFact(data, kpi, p, scope))
    .filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

export interface ForecastRow {
  /** null marks the TOTAL row. */
  market: Market | null
  id: string
  code: string
  name: string
  /** Average fact over the last 3 completed months — the suggested baseline. */
  avg3: number | null
  /** Fact for the calendar month immediately preceding the forecast month (may be in progress). */
  prevActual: number | null
  /** Saved manual projection for this row, if any (null on the TOTAL row). */
  savedProjection: number | null
  /** Target for the forecast month (falls back to default_target). */
  target: number | null
}

/** Lookback window for the average-baseline suggestion. */
export const FORECAST_LOOKBACK = 3

/** Per-country (+ TOTAL) baseline rows for forecasting `kpi` in month `period`. */
export function forecastRows(data: DashboardData, kpi: Kpi, period: string): ForecastRow[] {
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const months = completedMonthsBefore(period, FORECAST_LOOKBACK)
  const prevMonth = prevPeriod(period)

  const build = (market: Market | null): ForecastRow => {
    const scope: PeriodScope = market ? { marketId: market.id } : {}
    const facts = months.map((p) => periodFact(data, kpi, p, scope)).filter((v): v is number => v != null)
    return {
      market,
      id: market?.id ?? 'total',
      code: market?.code ?? 'ALL',
      name: market?.name ?? 'Total',
      avg3: facts.length ? facts.reduce((s, v) => s + v, 0) / facts.length : null,
      prevActual: periodFact(data, kpi, prevMonth, scope),
      savedProjection: market ? savedForecast(data, kpi.id, market.id, period) : null,
      target: market ? periodTarget(data, kpi.id, market.id, period) : totalTarget(data, kpi, period),
    }
  }

  return [...markets.map(build), build(null)]
}
