import { format, subDays } from 'date-fns'
import type { DashboardData, Entry, Kpi, Market, Member, Target } from '@/lib/types'
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

  const [markets, members, memberMarkets, kpis, entries, targets] = await Promise.all([
    supabase.from('markets').select('id, code, name, sort_order').order('sort_order'),
    supabase.from('members').select('id, name, initials, color, active, sort_order, avatar').order('sort_order'),
    supabase.from('member_markets').select('member_id, market_id'),
    supabase.from('kpis').select('*').order('sort_order'),
    supabase
      .from('entries')
      .select('id, kpi_id, member_id, market_id, date, value, target, note, source')
      .gte('date', cutoff),
    supabase.from('targets').select('kpi_id, market_id, period, value').gte('period', cutoff),
  ])

  const err =
    markets.error || members.error || memberMarkets.error || kpis.error || entries.error || targets.error
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
