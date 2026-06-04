// Domain types — mirror the Supabase schema (see supabase/schema.sql).

export type KpiFormat = 'number' | 'percent' | 'currency' | 'duration'
export type KpiDirection = 'higher_better' | 'lower_better'
/** How per-(member,market) values roll up into totals. */
export type KpiAggregation = 'sum' | 'avg'
export type EntrySource = 'manual' | 'sheet'

export interface Market {
  id: string
  code: string // LT, LV, EE, PL
  name: string
  sort_order: number
}

export interface Member {
  id: string
  name: string
  initials: string
  color: string // hex accent used in charts/avatars
  active: boolean
  sort_order: number
  /** Market ids this member covers (from member_markets join). */
  marketIds: string[]
}

export interface Kpi {
  id: string
  name: string
  description: string | null
  /** Optional unit suffix for `number`/`duration` formats, e.g. "clients", "min". */
  unit: string | null
  format: KpiFormat
  direction: KpiDirection
  aggregation: KpiAggregation
  default_target: number | null
  sort_order: number
  active: boolean
}

export interface Entry {
  id: string
  kpi_id: string
  member_id: string | null
  market_id: string | null
  date: string // ISO yyyy-MM-dd
  value: number
  target: number | null
  note: string | null
  source: EntrySource
}

/** Convenience bundle of everything the dashboard needs in one shot. */
export interface DashboardData {
  markets: Market[]
  members: Member[]
  kpis: Kpi[]
  entries: Entry[]
}

export type TimeRange = 'today' | 'week' | 'month'
