import { format, startOfMonth, subMonths } from 'date-fns'
import type { DashboardData, Entry, Kpi, Market, Member, Target } from './types'

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

const MEMBERS: Member[] = [
  { id: 'mem-1', name: 'Greta Kazlauskaitė', initials: 'GK', color: '#0A7AFF', active: true, sort_order: 1, marketIds: ['mk-lt', 'mk-lv'], avatar: 'preset:w1' },
  { id: 'mem-2', name: 'Karl Tamm', initials: 'KT', color: '#1098AD', active: true, sort_order: 2, marketIds: ['mk-ee', 'mk-lt'], avatar: 'preset:m1' },
  { id: 'mem-3', name: 'Marta Kowalska', initials: 'MK', color: '#E8A100', active: true, sort_order: 3, marketIds: ['mk-pl', 'mk-lv'], avatar: 'preset:w4' },
  { id: 'mem-4', name: 'Rūta Bērziņa', initials: 'RB', color: '#7C5CFF', active: true, sort_order: 4, marketIds: ['mk-pl', 'mk-ee'], avatar: 'preset:w7' },
]

/** The real KPIs from Evelina's workbook. */
const KPIS: Kpi[] = [
  { id: 'kpi-active-offer', name: 'Sellers with 1st active offer', description: 'New sellers who published their first active offer.', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 12, sort_order: 1, active: true },
  { id: 'kpi-first-order', name: 'Sellers with 1st order in 30 days', description: 'Sellers reaching their first order within 30 days of an active offer.', unit: 'sellers', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 7, sort_order: 2, active: true },
  { id: 'kpi-phh', name: 'PHH ads', description: 'Premium home & hardware ads published.', unit: 'ads', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 12, sort_order: 3, active: true },
  { id: 'kpi-late-rate', name: 'Late rate per portfolio CCD', description: 'Share of portfolio CCDs delivered late (lower is better).', unit: null, format: 'percent', direction: 'lower_better', aggregation: 'avg', default_target: 5, sort_order: 4, active: true },
  { id: 'kpi-fbp', name: 'FBP', description: 'Fulfilled business plan sellers.', unit: null, format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 5, sort_order: 5, active: true },
]

/** Per-country monthly targets, read from the JULY workbook (constant across the seeded months). */
const TARGET_TABLE: Record<string, Record<string, number>> = {
  // kpiId -> marketId -> target
  'kpi-active-offer': { 'mk-lt': 16, 'mk-lv': 12, 'mk-ee': 12, 'mk-pl': 12 },
  'kpi-first-order': { 'mk-lt': 10, 'mk-lv': 7, 'mk-ee': 7, 'mk-pl': 7 },
  'kpi-phh': { 'mk-lt': 16, 'mk-lv': 12, 'mk-ee': 12, 'mk-pl': 12 },
  'kpi-late-rate': { 'mk-lt': 5, 'mk-lv': 5, 'mk-ee': 5, 'mk-pl': 5 },
  'kpi-fbp': { 'mk-lt': 5, 'mk-lv': 5, 'mk-ee': 5, 'mk-pl': 5 },
}

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
 * Build a full, deterministic mock dataset of ~4 months of DAILY entries.
 *
 * Entries are scattered across an update-day cadence at member×market level; the
 * metrics engine rolls them up to the month (SUM adds across days, AVG means them).
 * The current month only has entries up to "today" so it reads as in-progress.
 * Targets are per country/month and live in `targets` (authoritative).
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
    const isSum = kpi.aggregation === 'sum'
    const decimals = kpi.format === 'percent' ? 1 : 0

    for (const market of MARKETS) {
      const countryTarget = TARGET_TABLE[kpi.id][market.id]
      const members = coveringMembers(market.id)
      const n = Math.max(1, members.length)
      const seriesSeed = rng()

      periods.forEach((period, i) => {
        // Targets row (authoritative, per country/month). Could drift month-to-month;
        // kept constant here to match the workbook.
        targets.push({ kpi_id: kpi.id, market_id: market.id, period, value: countryTarget })

        const progress = periods.length > 1 ? i / (periods.length - 1) : 1
        // Country attainment factor: ramps toward target over the months.
        const drift = 0.12 * (progress - 0.5)
        const base = isSum ? 0.96 : 0.94
        const wobble = Math.sin(i * 1.3 + seriesSeed * 6) * 0.06
        const noise = (rng() - 0.5) * 0.14
        let factor = base + drift + wobble + noise

        // Inject a soft patch on one market mid-history so some cells read at-risk.
        if (market.id === 'mk-pl' && i === periods.length - 2) factor -= 0.18

        factor = Math.max(0.55, Math.min(1.25, factor))

        const prefix = period.slice(0, 7) // yyyy-MM
        for (const member of members) {
          const s = skill[`${member.id}:${market.id}`]

          if (isSum) {
            // Distribute the month's whole units across the update-day cadence.
            const share = countryTarget / n
            const monthTotal = Math.max(0, Math.round(share * factor * (1 + s * 0.4)))
            const perDay = new Array(CADENCE.length).fill(0)
            for (let u = 0; u < monthTotal; u++) perDay[u % CADENCE.length]++
            CADENCE.forEach((day, di) => {
              const date = `${prefix}-${String(day).padStart(2, '0')}`
              if (date > todayStr || perDay[di] === 0) return
              entries.push({
                id: `e${id++}`,
                kpi_id: kpi.id,
                member_id: member.id,
                market_id: market.id,
                date,
                value: perDay[di],
                target: null,
                note: null,
                source: 'manual',
              })
            })
          } else {
            // AVG percent (late rate): one reading per update day; month = mean.
            CADENCE.forEach((day) => {
              const date = `${prefix}-${String(day).padStart(2, '0')}`
              if (date > todayStr) return
              const dayWobble = 1 + (rng() - 0.5) * 0.18
              const value = Math.max(0, round(countryTarget * factor * (1 + s * 0.3) * dayWobble, decimals))
              entries.push({
                id: `e${id++}`,
                kpi_id: kpi.id,
                member_id: member.id,
                market_id: market.id,
                date,
                value,
                target: null,
                note: null,
                source: 'manual',
              })
            })
          }
        }
      })
    }
  }

  return { markets: MARKETS, members: MEMBERS, kpis: KPIS, entries, targets }
}
