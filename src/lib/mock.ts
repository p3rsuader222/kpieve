import { addDays, format, isWeekend, startOfDay, subDays } from 'date-fns'
import type { DashboardData, Entry, Kpi, Market, Member } from './types'

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
  { id: 'mem-1', name: 'Greta Kazlauskaitė', initials: 'GK', color: '#3457b8', active: true, sort_order: 1, marketIds: ['mk-lt', 'mk-lv'] },
  { id: 'mem-2', name: 'Karl Tamm', initials: 'KT', color: '#0e9488', active: true, sort_order: 2, marketIds: ['mk-ee', 'mk-lt'] },
  { id: 'mem-3', name: 'Marta Kowalska', initials: 'MK', color: '#b8567a', active: true, sort_order: 3, marketIds: ['mk-pl', 'mk-lv'] },
  { id: 'mem-4', name: 'Rūta Bērziņa', initials: 'RB', color: '#c2730e', active: true, sort_order: 4, marketIds: ['mk-pl', 'mk-ee'] },
]

const KPIS: Kpi[] = [
  { id: 'kpi-clients', name: 'Clients onboarded', description: 'New clients fully onboarded.', unit: 'clients', format: 'number', direction: 'higher_better', aggregation: 'sum', default_target: 3, sort_order: 1, active: true },
  { id: 'kpi-tto', name: 'Avg time-to-onboard', description: 'Mean elapsed time from signup to activation.', unit: null, format: 'duration', direction: 'lower_better', aggregation: 'avg', default_target: 2880, sort_order: 2, active: true },
  { id: 'kpi-completion', name: 'Completion rate', description: 'Share of started onboardings completed.', unit: null, format: 'percent', direction: 'higher_better', aggregation: 'avg', default_target: 95, sort_order: 3, active: true },
  { id: 'kpi-csat', name: 'CSAT', description: 'Post-onboarding satisfaction score.', unit: '/ 5', format: 'number', direction: 'higher_better', aggregation: 'avg', default_target: 4.5, sort_order: 4, active: true },
  { id: 'kpi-sla', name: 'SLA adherence', description: 'First-response within agreed SLA.', unit: null, format: 'percent', direction: 'higher_better', aggregation: 'avg', default_target: 98, sort_order: 5, active: true },
]

// Per-KPI generation profile: base value + spread + drift over the window.
const PROFILE: Record<string, { base: number; spread: number; drift: number; min: number; max: number; decimals: number }> = {
  'kpi-clients': { base: 3.0, spread: 1.6, drift: 0.5, min: 0, max: 8, decimals: 0 },
  'kpi-tto': { base: 2950, spread: 650, drift: -260, min: 1500, max: 4600, decimals: 0 },
  'kpi-completion': { base: 92.5, spread: 6, drift: 3, min: 72, max: 100, decimals: 1 },
  'kpi-csat': { base: 4.35, spread: 0.35, drift: 0.18, min: 3.4, max: 5, decimals: 1 },
  'kpi-sla': { base: 95.5, spread: 5, drift: 1.8, min: 84, max: 100, decimals: 1 },
}

function round(n: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

const DAYS_BACK = 74

/** Build a full, deterministic mock dataset ending today. */
export function buildMockData(): DashboardData {
  const rng = mulberry32(20260604)
  const today = startOfDay(new Date())
  const start = subDays(today, DAYS_BACK)

  // Weekday business days only (onboarding happens Mon–Fri).
  const days: Date[] = []
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (!isWeekend(d)) days.push(d)
  }

  // Stable per (member,market) skill factor and per-day phase offsets.
  const skill: Record<string, number> = {}
  for (const m of MEMBERS) {
    for (const mk of m.marketIds) skill[`${m.id}:${mk}`] = (rng() - 0.5) * 0.9
  }

  const entries: Entry[] = []
  let id = 0

  for (const kpi of KPIS) {
    const p = PROFILE[kpi.id]
    for (const member of MEMBERS) {
      for (const marketId of member.marketIds) {
        const s = skill[`${member.id}:${marketId}`]
        const seriesSeed = rng() // unique-ish per series
        days.forEach((day, i) => {
          const progress = i / Math.max(1, days.length - 1)
          const weekly = Math.sin((i / 5) * Math.PI * 2 + seriesSeed * 6) * (p.spread * 0.28)
          const noise = (rng() - 0.5) * p.spread
          // Skill nudges higher-is-better up; for lower-is-better, invert sign.
          const skillNudge = (kpi.direction === 'higher_better' ? s : -s) * p.spread * 0.7
          let v = p.base + p.drift * progress + weekly + noise + skillNudge
          // Inject a couple of rough patches so some cells read at-risk / off-track.
          if (i > days.length * 0.45 && i < days.length * 0.58) {
            v += (kpi.direction === 'higher_better' ? -1 : 1) * p.spread * 0.6
          }
          v = Math.min(p.max, Math.max(p.min, v))
          entries.push({
            id: `e${id++}`,
            kpi_id: kpi.id,
            member_id: member.id,
            market_id: marketId,
            date: format(day, 'yyyy-MM-dd'),
            value: round(v, p.decimals),
            target: kpi.default_target,
            note: null,
            source: 'manual',
          })
        })
      }
    }
  }

  return { markets: MARKETS, members: MEMBERS, kpis: KPIS, entries }
}
