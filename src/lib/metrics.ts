import { addDays, format, parseISO } from 'date-fns'
import type { DashboardData, Entry, Kpi, KpiAggregation, Market, Member, TimeRange } from './types'
import { attainment, deltaIsGood, statusFromAttainment, type Status } from './status'

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

  const a = attainment(cur.value, cur.target, kpi.direction)
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
      const a = attainment(agg.value, agg.target, kpi.direction)
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
    const a = attainment(agg.value, agg.target, kpi.direction)
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
    return { status: statusFromAttainment(attainment(agg.value, agg.target, kpi.direction)) }
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
        const a = attainment(agg.value, agg.target, k.direction)
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
