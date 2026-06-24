import { format, startOfMonth, subMonths } from 'date-fns'
import type {
  AssortmentSeller,
  BonusBase,
  BonusRole,
  BonusSetting,
  BonusWeight,
  DashboardData,
  Entry,
  Forecast,
  Kpi,
  KpiMarketConfig,
  Market,
  Member,
  Target,
} from './types'

/** Deterministic PRNG so generated trends are stable between renders. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MARKETS: Market[] = [
  { id: 'mk-lt', code: 'LT', name: 'Lithuania', sort_order: 1 },
  { id: 'mk-lv', code: 'LV', name: 'Latvia', sort_order: 2 },
  { id: 'mk-ee', code: 'EE', name: 'Estonia', sort_order: 3 },
  { id: 'mk-pl', code: 'PL', name: 'Poland', sort_order: 4 },
]

// One market per person (Eve's quality model).
const MEMBERS: Member[] = [
  { id: 'mem-1', name: 'Greta Kazlauskaitė', initials: 'GK', color: '#0A7AFF', active: true, sort_order: 1, marketIds: ['mk-lt'], avatar: 'preset:w1' },
  { id: 'mem-2', name: 'Karl Tamm', initials: 'KT', color: '#1098AD', active: true, sort_order: 2, marketIds: ['mk-ee'], avatar: 'preset:m1' },
  { id: 'mem-3', name: 'Marta Kowalska', initials: 'MK', color: '#E8A100', active: true, sort_order: 3, marketIds: ['mk-pl'], avatar: 'preset:w4' },
  { id: 'mem-4', name: 'Rūta Bērziņa', initials: 'RB', color: '#7C5CFF', active: true, sort_order: 4, marketIds: ['mk-lv'], avatar: 'preset:w7' },
]

/** The real KPIs from Evelina's workbook (July 2026 quality overhaul). */
const KPIS: Kpi[] = [
  { id: 'kpi-active-offer', name: 'Sellers with 1st active offer', description: 'New sellers who published their first active offer.', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 12, sort_order: 1, active: true, compute: 'entries' },
  { id: 'kpi-first-order', name: 'Sellers with 1st order in 30 days', description: 'Sellers reaching their first order within 30 days of an active offer.', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 7, sort_order: 2, active: true, compute: 'entries' },
  { id: 'kpi-phh', name: 'PHH account setup', description: 'Seller registered and set up their PHH ads account (logins).', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 12, sort_order: 3, active: true, compute: 'entries' },
  { id: 'kpi-late-rate', name: 'Late rate per portfolio CCD', description: 'Share of portfolio CCDs delivered late (lower is better).', unit: null, format: 'percent', direction: 'lower_better', aggregation: 'avg', default_target: 5, sort_order: 4, active: true, compute: 'entries' },
  { id: 'kpi-fbp', name: 'FBP', description: 'Fulfilled business plan sellers.', unit: null, format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 5, sort_order: 5, active: true, compute: 'entries' },
  { id: 'kpi-phh-live', name: 'PHH live campaign', description: 'Sellers running a live PHH ad campaign (not just set up).', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: null, sort_order: 6, active: true, compute: 'entries' },
  { id: 'kpi-assort', name: 'Planned assortment completeness', description: 'Share of onboarded sellers who activated their declared assortment (≥80% if ≤100 SKUs, ≥50% if >100).', unit: null, format: 'percent', direction: 'higher_better', aggregation: 'avg', default_target: 100, sort_order: 7, active: true, compute: 'assortment' },
]

/** Per-country monthly targets (entries KPIs only; constant across the seeded months). */
const TARGET_TABLE: Record<string, Record<string, number>> = {
  'kpi-active-offer': { 'mk-lt': 16, 'mk-lv': 12, 'mk-ee': 12, 'mk-pl': 12 },
  'kpi-first-order': { 'mk-lt': 10, 'mk-lv': 7, 'mk-ee': 7, 'mk-pl': 7 },
  'kpi-phh': { 'mk-lt': 16, 'mk-lv': 12, 'mk-ee': 12, 'mk-pl': 12 },
  'kpi-late-rate': { 'mk-lt': 5, 'mk-lv': 5, 'mk-ee': 5, 'mk-pl': 5 },
  'kpi-fbp': { 'mk-lt': 5, 'mk-lv': 5, 'mk-ee': 5, 'mk-pl': 5 },
  'kpi-phh-live': { 'mk-lt': 5, 'mk-lv': 4, 'mk-ee': 4, 'mk-pl': 4 },
}

// Per-market bonus plan (Eve's July tables) — reused for every seeded month in demo.
type ConfigRow = [kpiId: string, role: BonusRole, weight: number, eurRate: number]
const LT_CONFIG: ConfigRow[] = [
  ['kpi-active-offer', 'core', 35, 0],
  ['kpi-first-order', 'core', 30, 0],
  ['kpi-assort', 'core', 15, 0],
  ['kpi-late-rate', 'core', 5, 0],
  ['kpi-fbp', 'core', 15, 0],
  ['kpi-phh', 'extra', 0, 10],
  ['kpi-phh-live', 'extra', 0, 10],
]
const LVEEPL_CONFIG: ConfigRow[] = [
  ['kpi-active-offer', 'core', 35, 0],
  ['kpi-first-order', 'core', 30, 0],
  ['kpi-phh', 'core', 10, 0],
  ['kpi-late-rate', 'core', 5, 0],
  ['kpi-assort', 'core', 20, 0],
  ['kpi-fbp', 'extra', 0, 15],
  ['kpi-phh-live', 'extra', 0, 10],
]

const MAX_BONUS: Record<string, number> = { 'mem-1': 1000, 'mem-2': 900, 'mem-3': 1100, 'mem-4': 950 }
// How many of 5 onboarded sellers clear their assortment bar, per member.
const PASS_RATE: Record<string, number> = { 'mem-1': 0.8, 'mem-2': 0.6, 'mem-3': 1.0, 'mem-4': 0.4 }

const MONTHS_BACK = 3 // → 4 months of history including the current month

/** Day-of-month cadence Evelina enters updates on (used to scatter daily mock entries). */
const CADENCE = [4, 9, 14, 19, 24, 28]

function round(n: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** Members (active) covering a given market. */
function coveringMembers(marketId: string): Member[] {
  return MEMBERS.filter((m) => m.active && m.marketIds.includes(marketId))
}

/**
 * Build a full, deterministic mock dataset of ~4 months of DAILY entries plus the
 * per-market bonus plan and per-seller assortment data for the quality overhaul.
 */
export function buildMockData(): DashboardData {
  const rng = mulberry32(20260604)
  const thisMonth = startOfMonth(new Date())
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const periods: string[] = []
  for (let k = MONTHS_BACK; k >= 0; k--) {
    periods.push(format(subMonths(thisMonth, k), 'yyyy-MM-dd'))
  }

  // Stable per (member,market) skill factor.
  const skill: Record<string, number> = {}
  for (const m of MEMBERS) {
    for (const mk of m.marketIds) skill[`${m.id}:${mk}`] = (rng() - 0.5) * 0.5
  }

  const entries: Entry[] = []
  const targets: Target[] = []
  let id = 0

  for (const kpi of KPIS) {
    if (kpi.compute !== 'entries') continue // assortment is derived from sellers, not entries
    const isSum = kpi.aggregation === 'sum'
    const decimals = kpi.format === 'percent' ? 1 : 0

    for (const market of MARKETS) {
      const countryTarget = TARGET_TABLE[kpi.id]?.[market.id] ?? 0
      const members = coveringMembers(market.id)
      const n = Math.max(1, members.length)
      const seriesSeed = rng()

      periods.forEach((period, i) => {
        targets.push({ kpi_id: kpi.id, market_id: market.id, period, value: countryTarget })

        const progress = periods.length > 1 ? i / (periods.length - 1) : 1
        const drift = 0.12 * (progress - 0.5)
        const base = isSum ? 0.96 : 0.94
        const wobble = Math.sin(i * 1.3 + seriesSeed * 6) * 0.06
        const noise = (rng() - 0.5) * 0.14
        let factor = base + drift + wobble + noise

        if (market.id === 'mk-pl' && i === periods.length - 2) factor -= 0.18
        factor = Math.max(0.55, Math.min(1.25, factor))

        const prefix = period.slice(0, 7) // yyyy-MM
        for (const member of members) {
          const s = skill[`${member.id}:${market.id}`]

          if (isSum) {
            const share = countryTarget / n
            const monthTotal = Math.max(0, Math.round(share * factor * (1 + s * 0.4)))
            const perDay = new Array(CADENCE.length).fill(0)
            for (let u = 0; u < monthTotal; u++) perDay[u % CADENCE.length]++
            CADENCE.forEach((day, di) => {
              const date = `${prefix}-${String(day).padStart(2, '0')}`
              if (date > todayStr || perDay[di] === 0) return
              entries.push({ id: `e${id++}`, kpi_id: kpi.id, member_id: member.id, market_id: market.id, date, value: perDay[di], target: null, note: null, source: 'manual' })
            })
          } else {
            CADENCE.forEach((day) => {
              const date = `${prefix}-${String(day).padStart(2, '0')}`
              if (date > todayStr) return
              const dayWobble = 1 + (rng() - 0.5) * 0.18
              const value = Math.max(0, round(countryTarget * factor * (1 + s * 0.3) * dayWobble, decimals))
              entries.push({ id: `e${id++}`, kpi_id: kpi.id, member_id: member.id, market_id: market.id, date, value, target: null, note: null, source: 'manual' })
            })
          }
        }
      })
    }
  }

  // Saved next-month projections for the headline KPI (Forecast page demo).
  const nextMonth = format(subMonths(thisMonth, -1), 'yyyy-MM-dd')
  const forecasts: Forecast[] = [
    { kpi_id: 'kpi-active-offer', market_id: 'mk-lt', period: nextMonth, value: 17 },
    { kpi_id: 'kpi-active-offer', market_id: 'mk-lv', period: nextMonth, value: 13 },
    { kpi_id: 'kpi-active-offer', market_id: 'mk-ee', period: nextMonth, value: 11 },
    { kpi_id: 'kpi-active-offer', market_id: 'mk-pl', period: nextMonth, value: 12 },
  ]

  // Per-market bonus plan + per-member base pool, per seeded month.
  const kpiMarketConfig: KpiMarketConfig[] = []
  const bonusBase: BonusBase[] = []
  for (const period of periods) {
    for (const market of MARKETS) {
      const rows = market.code === 'LT' ? LT_CONFIG : LVEEPL_CONFIG
      for (const [kpi_id, role, weight, eur_rate] of rows) {
        kpiMarketConfig.push({ period, market_id: market.id, kpi_id, role, weight, eur_rate })
      }
    }
    for (const m of MEMBERS) bonusBase.push({ period, member_id: m.id, max_bonus: MAX_BONUS[m.id] ?? 1000 })
  }

  // Per-seller assortment: 5 sellers per member/month, pass-rate driven.
  const assortmentSellers: AssortmentSeller[] = []
  for (const member of MEMBERS) {
    const market = member.marketIds[0]
    const passRate = PASS_RATE[member.id] ?? 0.7
    const nPass = Math.round(passRate * 5)
    for (const period of periods) {
      for (let si = 1; si <= 5; si++) {
        const passed = si <= nPass
        assortmentSellers.push({
          id: `as-${member.id}-${period}-${si}`,
          member_id: member.id,
          market_id: market,
          period,
          name: `Seller ${si}`,
          planned_skus: 80,
          activated_skus: passed ? 70 : 40,
          note: null,
        })
      }
    }
  }

  // Legacy per-member weights/settings retained for back-compat (no longer scored).
  const bonusWeights: BonusWeight[] = []
  const bonusSettings: BonusSetting[] = MEMBERS.map((m) => ({ member_id: m.id, max_bonus: MAX_BONUS[m.id] ?? 1000 }))

  return {
    markets: MARKETS,
    members: MEMBERS,
    kpis: KPIS,
    entries,
    targets,
    forecasts,
    bonusWeights,
    bonusSettings,
    kpiMarketConfig,
    bonusBase,
    assortmentSellers,
  }
}
