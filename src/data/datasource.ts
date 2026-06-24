import { format, subDays } from 'date-fns'
import type {
  AssortmentSeller,
  BonusBase,
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
} from '@/lib/types'
import { buildMockData } from '@/lib/mock'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * Single seam between the UI and its data.
 *  - Mock mode  (no Supabase env): deterministic in-memory dataset, no auth.
 *  - Live mode  (env present):     Supabase Postgres behind the auth gate.
 */
export const usingMockData = !isSupabaseConfigured

const HISTORY_DAYS = 180

function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Add credentials to enable saving.')
  return supabase
}

// ---------- Read ----------

export async function fetchDashboard(): Promise<DashboardData> {
  if (!supabase) return delay(buildMockData())

  const cutoff = format(subDays(new Date(), HISTORY_DAYS), 'yyyy-MM-dd')

  const [
    markets, members, memberMarkets, kpis, entries, targets, forecasts, bonusWeights, bonusSettings,
    kpiMarketConfig, bonusBase, assortmentSellers,
  ] = await Promise.all([
    supabase.from('markets').select('id, code, name, sort_order').order('sort_order'),
    supabase.from('members').select('id, name, initials, color, active, sort_order, avatar').order('sort_order'),
    supabase.from('member_markets').select('member_id, market_id'),
    supabase.from('kpis').select('*').order('sort_order'),
    supabase
      .from('entries')
      .select('id, kpi_id, member_id, market_id, date, value, target, note, source')
      .gte('date', cutoff),
    supabase.from('targets').select('kpi_id, market_id, period, value').gte('period', cutoff),
    supabase.from('forecasts').select('kpi_id, market_id, period, value').gte('period', cutoff),
    supabase.from('bonus_weights').select('member_id, kpi_id, weight'),
    supabase.from('bonus_settings').select('member_id, max_bonus'),
    supabase.from('bonus_kpi_markets').select('period, market_id, kpi_id, role, weight, eur_rate').gte('period', cutoff),
    supabase.from('bonus_base').select('period, member_id, max_bonus').gte('period', cutoff),
    supabase
      .from('assortment_sellers')
      .select('id, member_id, market_id, period, name, planned_skus, activated_skus, note')
      .gte('period', cutoff),
  ])

  const err =
    markets.error || members.error || memberMarkets.error || kpis.error || entries.error || targets.error ||
    forecasts.error || bonusWeights.error || bonusSettings.error ||
    kpiMarketConfig.error || bonusBase.error || assortmentSellers.error
  if (err) throw err

  const coverage = new Map<string, string[]>()
  for (const row of memberMarkets.data ?? []) {
    const arr = coverage.get(row.member_id) ?? []
    arr.push(row.market_id)
    coverage.set(row.member_id, arr)
  }

  return {
    markets: (markets.data ?? []) as Market[],
    members: (members.data ?? []).map(
      (m): Member => ({ ...m, marketIds: coverage.get(m.id) ?? [] }),
    ),
    kpis: (kpis.data ?? []).map(
      (k): Kpi => ({ ...k, default_target: k.default_target == null ? null : Number(k.default_target) }),
    ),
    entries: (entries.data ?? []).map(
      (e): Entry => ({ ...e, value: Number(e.value), target: e.target == null ? null : Number(e.target) }),
    ),
    targets: (targets.data ?? []).map(
      (t): Target => ({ ...t, value: Number(t.value) }),
    ),
    forecasts: (forecasts.data ?? []).map(
      (f): Forecast => ({ ...f, value: Number(f.value) }),
    ),
    bonusWeights: (bonusWeights.data ?? []).map(
      (b): BonusWeight => ({ ...b, weight: Number(b.weight) }),
    ),
    bonusSettings: (bonusSettings.data ?? []).map(
      (b): BonusSetting => ({ ...b, max_bonus: Number(b.max_bonus) }),
    ),
    kpiMarketConfig: (kpiMarketConfig.data ?? []).map(
      (c): KpiMarketConfig => ({ ...c, weight: Number(c.weight), eur_rate: Number(c.eur_rate) }),
    ),
    bonusBase: (bonusBase.data ?? []).map(
      (b): BonusBase => ({ ...b, max_bonus: Number(b.max_bonus) }),
    ),
    assortmentSellers: (assortmentSellers.data ?? []).map(
      (s): AssortmentSeller => ({
        ...s,
        planned_skus: Number(s.planned_skus),
        activated_skus: Number(s.activated_skus),
      }),
    ),
  }
}

// ---------- Mutations ----------

export interface EntryUpsert {
  kpi_id: string
  member_id: string
  market_id: string
  date: string
  value: number
  target: number | null
  source?: 'manual' | 'sheet'
}

export async function upsertEntries(rows: EntryUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client
    .from('entries')
    .upsert(
      rows.map((r) => ({ ...r, source: r.source ?? 'manual' })),
      { onConflict: 'kpi_id,member_id,market_id,date' },
    )
  if (error) throw error
}

export interface EntryKey {
  kpi_id: string
  member_id: string
  market_id: string
  date: string
}

/** Delete specific (kpi × member × market × day) entries — e.g. cells cleared during an edit. */
export async function deleteEntries(keys: EntryKey[]): Promise<void> {
  if (keys.length === 0) return
  const client = requireClient()
  for (const k of keys) {
    const { error } = await client
      .from('entries')
      .delete()
      .eq('kpi_id', k.kpi_id)
      .eq('member_id', k.member_id)
      .eq('market_id', k.market_id)
      .eq('date', k.date)
    if (error) throw error
  }
}

/** Delete every entry logged on a given day. */
export async function deleteEntriesForDate(date: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('entries').delete().eq('date', date)
  if (error) throw error
}

export interface TargetUpsert {
  kpi_id: string
  market_id: string
  period: string // month start yyyy-MM-01
  value: number
}

export async function upsertTargets(rows: TargetUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client
    .from('targets')
    .upsert(rows, { onConflict: 'kpi_id,market_id,period' })
  if (error) throw error
}

export async function saveTarget(row: TargetUpsert): Promise<void> {
  return upsertTargets([row])
}

/** Delete every per-country target for a given month (yyyy-MM-01). */
export async function deleteTargetsForPeriod(period: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('targets').delete().eq('period', period)
  if (error) throw error
}

export interface ForecastUpsert {
  kpi_id: string
  market_id: string
  period: string // month start yyyy-MM-01 (the month being forecast)
  value: number
}

export async function upsertForecasts(rows: ForecastUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client
    .from('forecasts')
    .upsert(rows, { onConflict: 'kpi_id,market_id,period' })
  if (error) throw error
}

export async function saveForecast(row: ForecastUpsert): Promise<void> {
  return upsertForecasts([row])
}

export interface BonusWeightUpsert {
  member_id: string
  kpi_id: string
  weight: number
}

export async function upsertBonusWeights(rows: BonusWeightUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client.from('bonus_weights').upsert(rows, { onConflict: 'member_id,kpi_id' })
  if (error) throw error
}

export interface BonusSettingUpsert {
  member_id: string
  max_bonus: number
}

export async function upsertBonusSettings(rows: BonusSettingUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client.from('bonus_settings').upsert(rows, { onConflict: 'member_id' })
  if (error) throw error
}

export interface KpiMarketConfigUpsert {
  period: string // yyyy-MM-01
  market_id: string
  kpi_id: string
  role: 'core' | 'extra'
  weight: number
  eur_rate: number
}

export async function upsertKpiMarketConfig(rows: KpiMarketConfigUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client
    .from('bonus_kpi_markets')
    .upsert(rows, { onConflict: 'period,market_id,kpi_id' })
  if (error) throw error
}

export interface BonusBaseUpsert {
  period: string // yyyy-MM-01
  member_id: string
  max_bonus: number
}

export async function upsertBonusBase(rows: BonusBaseUpsert[]): Promise<void> {
  if (rows.length === 0) return
  const client = requireClient()
  const { error } = await client.from('bonus_base').upsert(rows, { onConflict: 'period,member_id' })
  if (error) throw error
}

export interface AssortmentSellerInput {
  id?: string
  member_id: string
  market_id: string
  period: string // yyyy-MM-01
  name: string | null
  planned_skus: number
  activated_skus: number
  note: string | null
}

export async function saveAssortmentSeller(row: AssortmentSellerInput): Promise<void> {
  const client = requireClient()
  const { error } = row.id
    ? await client.from('assortment_sellers').update(row).eq('id', row.id)
    : await client.from('assortment_sellers').insert(row)
  if (error) throw error
}

export async function deleteAssortmentSeller(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('assortment_sellers').delete().eq('id', id)
  if (error) throw error
}

export type KpiInput = Omit<Kpi, 'id'>

export async function saveKpi(kpi: Partial<Kpi> & { id?: string }): Promise<void> {
  const client = requireClient()
  const { error } = kpi.id
    ? await client.from('kpis').update(kpi).eq('id', kpi.id)
    : await client.from('kpis').insert(kpi)
  if (error) throw error
}

export async function deleteKpi(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('kpis').delete().eq('id', id)
  if (error) throw error
}

export async function saveMember(
  member: Partial<Member> & { id?: string },
  marketIds?: string[],
): Promise<void> {
  const client = requireClient()
  const { marketIds: _omit, ...row } = member
  let memberId = member.id
  if (memberId) {
    const { error } = await client.from('members').update(row).eq('id', memberId)
    if (error) throw error
  } else {
    const { data, error } = await client.from('members').insert(row).select('id').single()
    if (error) throw error
    memberId = data.id
  }
  if (marketIds && memberId) {
    await client.from('member_markets').delete().eq('member_id', memberId)
    if (marketIds.length) {
      const { error } = await client
        .from('member_markets')
        .insert(marketIds.map((market_id) => ({ member_id: memberId, market_id })))
      if (error) throw error
    }
  }
}

export async function deleteMember(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('members').delete().eq('id', id)
  if (error) throw error
}
