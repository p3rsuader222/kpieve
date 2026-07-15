import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Database, Save } from 'lucide-react'
import {
  activeKpis,
  activeMembers,
  changeActivityInMonth,
  listPeriods,
  monthStart,
  periodTarget,
} from '@/lib/metrics'
import { formatCompact } from '@/lib/format'
import type { DashboardData, Kpi } from '@/lib/types'
import { usingMockData, type EntryKey, type EntryUpsert } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useDeleteEntries, useUpsertEntries } from '@/hooks/useEntryMutations'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssortmentEditor } from '@/components/update/AssortmentEditor'
import { ChangeDetail, EntryCalendar } from '@/components/update/EntryCalendar'
import { KpiRail } from '@/components/ui/KpiRail'
import { MonthNav } from '@/components/dashboard/MonthNav'

const keyOf = (kpiId: string, memberId: string, marketId: string) => `${kpiId}:${memberId}:${marketId}`

export function Update() {
  const { data, isLoading } = useDashboard()
  const upsert = useUpsertEntries()
  const deleteCells = useDeleteEntries()
  const toast = useToast()

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const curMonth = monthStart(new Date())
  // Month whose running totals are being edited in the grid.
  const [period, setPeriod] = useState(curMonth)
  // Month the change-log calendar displays — browsed independently of the grid.
  const [viewedPeriod, setViewedPeriod] = useState(curMonth)
  // Day whose changes are shown in the detail panel.
  const [selectedDay, setSelectedDay] = useState(todayStr)
  const [values, setValues] = useState<Record<string, string>>({})
  const [activeKpiId, setActiveKpiId] = useState<string | null>(null)

  // Assortment-compute KPIs are derived from per-seller data (own editor), so they're not grid cells.
  const kpis = data ? activeKpis(data).filter((k) => k.compute === 'entries') : []
  const assortmentKpi = data ? activeKpis(data).find((k) => k.compute === 'assortment') : undefined
  const members = data ? activeMembers(data) : []
  const activeKpi = kpis.find((k) => k.id === activeKpiId) ?? kpis[0]

  // Prefill from the month's saved running totals.
  useEffect(() => {
    if (!data) return
    const next: Record<string, string> = {}
    for (const e of data.entries) {
      if (e.date === period && e.member_id && e.market_id) {
        next[keyOf(e.kpi_id, e.member_id, e.market_id)] = String(e.value)
      }
    }
    setValues(next)
  }, [data, period])

  const dirtyRows = useMemo(() => collectRows(values, data, period), [values, data, period])
  const activity = useMemo(
    () => (data ? changeActivityInMonth(data, viewedPeriod) : new Map<string, number>()),
    [data, viewedPeriod],
  )
  // Months browsable in the change-log calendar: every month with data, plus the
  // current one. (listPeriods can contain FUTURE months once forecast targets are
  // saved — filter those out so the forward clamp stays at the current month.)
  const calPeriods = useMemo(() => {
    if (!data) return [curMonth]
    const set = new Set(listPeriods(data).filter((p) => p <= curMonth))
    set.add(curMonth)
    return [...set].sort()
  }, [data, curMonth])

  if (isLoading || !data || !activeKpi) return <UpdateSkeleton />

  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const filledForKpi = members.reduce(
    (n, m) => n + m.marketIds.filter((mk) => values[keyOf(activeKpi.id, m.id, mk)]?.trim()).length,
    0,
  )
  const totalForKpi = members.reduce((n, m) => n + m.marketIds.length, 0)

  async function onSave() {
    if (!data) return
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save entries.')
      return
    }
    // Cells that had a saved total for this month but were cleared → delete them.
    const cleared: EntryKey[] = []
    for (const e of data.entries) {
      if (e.date === period && e.member_id && e.market_id) {
        const v = values[keyOf(e.kpi_id, e.member_id, e.market_id)]
        if (v == null || v.trim() === '') {
          cleared.push({ kpi_id: e.kpi_id, member_id: e.member_id, market_id: e.market_id, date: period })
        }
      }
    }
    if (dirtyRows.length === 0 && cleared.length === 0) {
      toast.info('Nothing to save yet.')
      return
    }
    try {
      if (dirtyRows.length) await upsert.mutateAsync(dirtyRows)
      if (cleared.length) await deleteCells.mutateAsync(cleared)
      const parts: string[] = []
      if (dirtyRows.length) parts.push(`saved ${dirtyRows.length}`)
      if (cleared.length) parts.push(`removed ${cleared.length}`)
      toast.success(`${parts.join(' · ')} for ${format(parseISO(period), 'MMMM yyyy')}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  // Fixed member column; inputs flex to fill the panel evenly (no middle gap
  // from a ballooning name column, no empty gap on the right).
  const cols = `180px repeat(${markets.length}, minmax(72px, 1fr))`

  return (
    <div className="max-w-[1720px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Monthly totals</p>
          <h1 className="mt-1.5 font-heading text-3xl font-semibold tracking-tight text-ink">Update KPIs</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Enter each member's running total for the month — overwrite the number whenever it grows.
          </p>
        </div>
        <div className="flex items-end gap-2.5">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Month</span>
            {/* Forward clamp pinned to the current month (listPeriods may contain
                future months once next month's targets are saved). Past months
                stay freely reachable for corrections. */}
            <MonthNav period={period} onChange={setPeriod} periods={[curMonth]} />
          </div>
          <Button variant="primary" size="md" onClick={onSave} disabled={upsert.isPending || deleteCells.isPending}>
            <Save size={16} />
            {upsert.isPending || deleteCells.isPending ? 'Saving…' : 'Save all'}
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

      {/* Entry grid takes the row; the change-log column keeps a fixed sane width on wide
          screens. items-start lets each card hug its content instead of stretching. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 2xl:grid-cols-[minmax(0,1fr)_430px]">
        {/* Entry grid */}
        <Panel
          className="lg:col-span-2 2xl:col-span-1"
          eyebrow={`${format(parseISO(period), 'MMMM yyyy')} · ${filledForKpi}/${totalForKpi} entered`}
          title={activeKpi.name}
        >
          <div className="flex flex-col gap-4 lg:flex-row">
          {/* KPI rail — vertical on desktop, wrapped chips on mobile */}
          <KpiRail
            ariaLabel="KPI"
            kpis={kpis}
            selectedIds={[activeKpi.id]}
            onSelect={setActiveKpiId}
          />

          {/* Aligned table island */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="w-full min-w-[480px] overflow-hidden rounded-xl border border-line">
              <div
                className="grid items-end gap-2.5 border-b border-line bg-surface-2/50 px-4 py-3"
                style={{ gridTemplateColumns: cols }}
              >
                <span className="eyebrow self-end">Member</span>
                {markets.map((m) => {
                  const t = periodTarget(data, activeKpi.id, m.id, period)
                  const cfg = data.kpiMarketConfig.find(
                    (c) => c.period === period && c.market_id === m.id && c.kpi_id === activeKpi.id,
                  )
                  return (
                    <div key={m.id} className="flex flex-col items-center gap-1">
                      <Flag code={m.code} size={22} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{m.code}</span>
                      {cfg?.role === 'additional' && cfg.eur_rate > 0 ? (
                        <span className="rounded-full bg-brand-soft px-1.5 text-2xs font-semibold text-brand-ink">
                          +€{cfg.eur_rate}/seller
                        </span>
                      ) : (
                        <span className="tnum text-2xs leading-tight text-ink-muted/80">
                          tgt {t != null ? formatCompact(t, activeKpi.format) : '—'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="divide-y divide-line">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="grid items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-surface-2/30"
                    style={{ gridTemplateColumns: cols }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar initials={member.initials} color={member.color} avatar={member.avatar} size="sm" />
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
                      return (
                        <input
                          key={market.id}
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={values[k] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                          className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm font-semibold text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </Panel>

        {/* Change log — when totals were edited, and what changed each day */}
        <div className="space-y-5">
          <Panel
            eyebrow="When totals changed"
            title="Change log"
            actions={
              <MonthNav
                period={viewedPeriod}
                periods={calPeriods}
                onChange={(p) => setViewedPeriod(calPeriods[0] && p < calPeriods[0] ? calPeriods[0] : p)}
              />
            }
          >
            <EntryCalendar
              period={viewedPeriod}
              activity={activity}
              selected={selectedDay}
              today={todayStr}
              onSelect={setSelectedDay}
            />
          </Panel>

          <Panel
            eyebrow={format(parseISO(selectedDay), 'EEEE')}
            title={format(parseISO(selectedDay), 'd MMM yyyy')}
          >
            <ChangeDetail data={data} date={selectedDay} />
          </Panel>
        </div>
      </div>

      {/* Per-seller assortment quality — only shown while a KPI is actually derived from it.
          Form editor: the card itself stays content-width. */}
      {assortmentKpi && (
        <Panel
          className="max-w-[920px]"
          eyebrow={`Assortment quality · ${format(parseISO(period), 'MMMM yyyy')}`}
          title={assortmentKpi.name}
        >
          <AssortmentEditor data={data} period={period} />
        </Panel>
      )}
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
    if (!kpiById.has(kpi_id)) continue
    rows.push({
      kpi_id,
      member_id,
      market_id,
      date: period, // month start (yyyy-MM-01) — one running total per cell per month
      value: num,
      target: null,
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <div className="space-y-5">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
