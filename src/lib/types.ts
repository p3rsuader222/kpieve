// Domain types — mirror the Supabase schema (see supabase/schema.sql).

export type KpiFormat = 'number' | 'percent' | 'currency' | 'duration'
export type KpiDirection = 'higher_better' | 'lower_better'
/** How per-(member,market) values roll up into totals. */
export type KpiAggregation = 'sum' | 'avg'
export type EntrySource = 'manual' | 'sheet'
/** Where a KPI's monthly fact comes from: rolled-up entries, or derived from sellers. */
export type KpiCompute = 'entries' | 'assortment'
/**
 * A KPI's role in a market+month bonus plan:
 * 'core' — weighted share of the mandatory 100% pool;
 * 'extra' — flat € per qualifying seller (gated on 1st active offer);
 * 'additional' — scored like core (weight × attainment, floor/cap apply) but
 *   OUTSIDE the 100% pool: pure on-top upside, missing it costs nothing.
 */
export type BonusRole = 'core' | 'extra' | 'additional'

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
  /** Fact source. 'entries' (default) rolls up the entries table; 'assortment' derives % of sellers who passed. */
  compute: KpiCompute
  /** Tagged "Additional (non-mandatory)" across the UI. Display-only — scoring is unaffected. */
  additional: boolean
  /**
   * Lower-is-better only: percent of the target the value may overshoot before
   * counting as failed (the overshoot zone reads as "at risk").
   * E.g. target 5%, grace 20 → up to 6% at risk, beyond fails.
   */
  risk_grace: number
}

export interface Entry {
  id: string
  kpi_id: string
  member_id: string | null
  market_id: string | null
  date: string // month start (yyyy-MM-01) — one row per kpi/member/market/month
  value: number // the month's running total, overwritten as it grows
  target: number | null
  note: string | null
  source: EntrySource
}

/**
 * One recorded change to an entry value (from the entry_audit table, written by
 * a DB trigger). old_value null → value created; new_value null → value removed.
 */
export interface EntryChange {
  id: string
  kpi_id: string
  member_id: string | null
  market_id: string | null
  period: string // month start of the affected entry, yyyy-MM-01
  old_value: number | null
  new_value: number | null
  changed_at: string // ISO timestamp
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

/**
 * Per-month, per-market role of one KPI in the bonus plan.
 * `core` → weighted share of the pool; `additional` → same scoring, on top of
 * the pool; `extra` → flat per-seller bonus (`eur_rate` € × qualifying sellers).
 * Floor/cap set per row where the KPI starts paying and stops counting.
 * One row per (period, market, kpi). Replaces per-member BonusWeight for scoring.
 */
export interface KpiMarketConfig {
  period: string // month start, yyyy-MM-01
  market_id: string
  kpi_id: string
  role: BonusRole
  weight: number // percent 0..100 (core/additional)
  eur_rate: number // € per qualifying seller (extra)
  floor_pct: number // min attainment (percent) before the KPI pays (core/additional)
  cap_pct: number // attainment ceiling (percent) counted toward the payout
}

/** Per-month base bonus pool for a member (each member belongs to one market). */
export interface BonusBase {
  period: string // month start, yyyy-MM-01
  member_id: string
  max_bonus: number
}

/**
 * One onboarded seller's assortment progress in a month. The app derives the bar
 * (≤100 planned SKUs → 80%, >100 → 50%) and pass/fail, then aggregates to the
 * "Planned assortment completeness" KPI (% of sellers who passed).
 */
export interface AssortmentSeller {
  id: string
  member_id: string
  market_id: string
  period: string // onboarding month, yyyy-MM-01
  name: string | null
  planned_skus: number
  activated_skus: number
  note: string | null
}

/** Convenience bundle of everything the dashboard needs in one shot. */
export interface DashboardData {
  markets: Market[]
  members: Member[]
  kpis: Kpi[]
  entries: Entry[]
  entryAudit: EntryChange[]
  targets: Target[]
  forecasts: Forecast[]
  bonusWeights: BonusWeight[]
  bonusSettings: BonusSetting[]
  kpiMarketConfig: KpiMarketConfig[]
  bonusBase: BonusBase[]
  assortmentSellers: AssortmentSeller[]
}

export type TimeRange = 'today' | 'week' | 'month'
