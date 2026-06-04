import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Database, Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, activeMembers, cellTarget, monthStart, periodTarget } from '@/lib/metrics'
import { formatCompact } from '@/lib/format'
import type { DashboardData, Kpi } from '@/lib/types'
import { usingMockData, type EntryUpsert } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useUpsertEntries } from '@/hooks/useEntryMutations'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'

const keyOf = (kpiId: string, memberId: string, marketId: string) => `${kpiId}:${memberId}:${marketId}`

/** Round an even-split target sensibly for storage on a member entry. */
function splitTargetValue(data: DashboardData, kpi: Kpi, marketId: string, period: string): number | null {
  const t = cellTarget(data, kpi, marketId, period)
  if (t == null) return null
  return Math.round(t * 100) / 100
}

export function Update() {
  const { data, isLoading } = useDashboard()
  const upsert = useUpsertEntries()
  const toast = useToast()

  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const period = `${month}-01`
  const [values, setValues] = useState<Record<string, string>>({})
  const [activeKpiId, setActiveKpiId] = useState<string | null>(null)

  const kpis = data ? activeKpis(data) : []
  const members = data ? activeMembers(data) : []
  const activeKpi = kpis.find((k) => k.id === activeKpiId) ?? kpis[0]

  // Prefill from entries already saved for the chosen month.
  useEffect(() => {
    if (!data) return
    const next: Record<string, string> = {}
    for (const e of data.entries) {
      if (monthStart(e.date) === period && e.member_id && e.market_id) {
        next[keyOf(e.kpi_id, e.member_id, e.market_id)] = String(e.value)
      }
    }
    setValues(next)
  }, [data, period])

  const dirtyRows = useMemo(() => collectRows(values, data, period), [values, data, period])

  if (isLoading || !data || !activeKpi) return <UpdateSkeleton />

  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const filledForKpi = members.reduce(
    (n, m) => n + m.marketIds.filter((mk) => values[keyOf(activeKpi.id, m.id, mk)]?.trim()).length,
    0,
  )
  const totalForKpi = members.reduce((n, m) => n + m.marketIds.length, 0)

  async function onSave() {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save entries.')
      return
    }
    if (dirtyRows.length === 0) {
      toast.info('Nothing to save yet.')
      return
    }
    try {
      await upsert.mutateAsync(dirtyRows)
      const label = format(parseISO(period), 'MMMM yyyy')
      toast.success(`Saved ${dirtyRows.length} value${dirtyRows.length === 1 ? '' : 's'} for ${label}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  const cols = `minmax(132px, 1.6fr) repeat(${markets.length}, minmax(84px, 1fr))`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Monthly entry</p>
          <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight text-ink">Update KPIs</h1>
          <p className="mt-2 text-sm text-ink-muted">Enter each member's monthly number per country, then save.</p>
        </div>
        <div className="flex items-end gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Month</span>
            <input
              type="month"
              value={month}
              max={format(new Date(), 'yyyy-MM')}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <Button variant="primary" size="md" onClick={onSave} disabled={upsert.isPending}>
            <Save size={16} />
            {upsert.isPending ? 'Saving…' : 'Save all'}
          </Button>
        </div>
      </div>

      {usingMockData && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-brand-soft/60 px-4 py-3 text-sm text-ink-soft">
          <Database size={17} className="shrink-0 text-brand" />
          <span>
            <strong className="font-semibold text-ink">Demo mode.</strong> You can try the form, but values won't
            persist until Supabase is connected.
          </span>
        </div>
      )}

      <Panel eyebrow={`${filledForKpi} of ${totalForKpi} entered`} title={activeKpi.name}>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {kpis.map((k) => (
            <button
              key={k.id}
              onClick={() => setActiveKpiId(k.id)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                k.id === activeKpi.id
                  ? 'bg-brand text-brand-contrast'
                  : 'border border-line bg-surface text-ink-muted hover:text-ink',
              )}
            >
              {k.name}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[460px]">
            <div className="grid items-end gap-2 pb-2" style={{ gridTemplateColumns: cols }}>
              <span className="eyebrow">Member</span>
              {markets.map((m) => {
                const t = periodTarget(data, activeKpi.id, m.id, period)
                return (
                  <div key={m.id} className="text-center">
                    <span className="block text-2xs font-semibold uppercase tracking-wider text-ink-muted">{m.code}</span>
                    <span className="tnum mt-0.5 block text-2xs text-ink-muted/80">
                      tgt {t != null ? formatCompact(t, activeKpi.format) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }}>
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar initials={member.initials} color={member.color} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{member.name}</span>
                  </div>
                  {markets.map((market) => {
                    const covered = member.marketIds.includes(market.id)
                    const k = keyOf(activeKpi.id, member.id, market.id)
                    if (!covered) {
                      return (
                        <div key={market.id} className="grid h-9 place-items-center rounded-lg border border-dashed border-line text-ink-muted/40">
                          ·
                        </div>
                      )
                    }
                    const share = splitTargetValue(data, activeKpi, market.id, period)
                    return (
                      <input
                        key={market.id}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={values[k] ?? ''}
                        placeholder={share != null ? String(share) : ''}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                        className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function collectRows(
  values: Record<string, string>,
  data: DashboardData | undefined,
  period: string,
): EntryUpsert[] {
  if (!data) return []
  const kpiById = new Map<string, Kpi>(data.kpis.map((k) => [k.id, k]))
  const rows: EntryUpsert[] = []
  for (const [key, raw] of Object.entries(values)) {
    if (raw == null || raw.trim() === '') continue
    const num = Number(raw)
    if (Number.isNaN(num)) continue
    const [kpi_id, member_id, market_id] = key.split(':')
    const kpi = kpiById.get(kpi_id)
    rows.push({
      kpi_id,
      member_id,
      market_id,
      date: period, // month start yyyy-MM-01
      value: num,
      target: kpi ? splitTargetValue(data, kpi, market_id, period) : null,
    })
  }
  return rows
}

function UpdateSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
