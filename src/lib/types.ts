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
  /**
   * Avatar source. Either a preset key ("preset:w1".."preset:w10", "preset:m1")
   * or an image data URL / URL. Null → tinted initials fallback.
   */
  avatar?: string | null
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

/**
 * Per-country, per-month configurable target.
 * `period` is a month start (yyyy-MM-01). One row per (kpi, market, month).
 */
export interface Target {
  kpi_id: string
  market_id: string
  period: string // month start, yyyy-MM-01
  value: number
}

/**
 * A user-typed projection for next month, per (kpi, market, month).
 * Structurally identical to a Target, but semantically a forecast: `period` is the
 * month being forecast and `value` is the projected fact for that country.
 */
export interface Forecast {
  kpi_id: string
  market_id: string
  period: string // month start, yyyy-MM-01
  value: number
}

/**
 * Bonus weight: the share of a member's max bonus tied to one KPI.
 * `weight` is a percentage (0–100). One row per (member, kpi).
 */
export interface BonusWeight {
  member_id: string
  kpi_id: string
  weight: number // percent, 0..100
}

/** Per-member maximum bonus (the payout at 100% attainment across all KPIs). */
export interface BonusSetting {
  member_id: string
  max_bonus: number
}

/** Convenience bundle of everything the dashboard needs in one shot. */
export interface DashboardData {
  markets: Market[]
  members: Member[]
  kpis: Kpi[]
  entries: Entry[]
  targets: Target[]
  forecasts: Forecast[]
  bonusWeights: BonusWeight[]
  bonusSettings: BonusSetting[]
}

export type TimeRange = 'today' | 'week' | 'month'
