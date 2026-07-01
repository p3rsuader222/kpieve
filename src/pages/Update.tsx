import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Database, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  activeKpis,
  activeMembers,
  entryActivityInMonth,
  listPeriods,
  monthStart,
  periodFact,
  periodTarget,
} from '@/lib/metrics'
import { formatCompact } from '@/lib/format'
import type { DashboardData, Kpi } from '@/lib/types'
import { usingMockData, type EntryKey, type EntryUpsert } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useDeleteEntries, useDeleteEntriesForDate, useUpsertEntries } from '@/hooks/useEntryMutations'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssortmentEditor } from '@/components/update/AssortmentEditor'
import { DayDetail, EntryCalendar } from '@/components/update/EntryCalendar'
import { MonthNav } from '@/components/dashboard/MonthNav'

const keyOf = (kpiId: string, memberId: string, marketId: string) => `${kpiId}:${memberId}:${marketId}`

export function Update() {
  const { data, isLoading } = useDashboard()
  const upsert = useUpsertEntries()
  const deleteCells = useDeleteEntries()
  const deleteDay = useDeleteEntriesForDate()
  const toast = useToast()

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const period = monthStart(date)
  // Month the calendar displays — decoupled from `date` so paging through
  // history doesn't itself swap the day loaded into the edit grid below.
  const [viewedPeriod, setViewedPeriod] = useState(() => monthStart(date))
  const [values, setValues] = useState<Record<string, string>>({})
  const [activeKpiId, setActiveKpiId] = useState<string | null>(null)

  function jumpToDate(next: string) {
    setDate(next)
    setViewedPeriod(monthStart(next))
  }

  // Assortment is derived from per-seller data (own editor), so it's not a grid cell.
  const kpis = data ? activeKpis(data).filter((k) => k.compute === 'entries') : []
  const members = data ? activeMembers(data) : []
  const activeKpi = kpis.find((k) => k.id === activeKpiId) ?? kpis[0]

  // Prefill from entries already saved for the chosen day.
  useEffect(() => {
    if (!data) return
    const next: Record<string, string> = {}
    for (const e of data.entries) {
      if (e.date === date && e.member_id && e.market_id) {
        next[keyOf(e.kpi_id, e.member_id, e.market_id)] = String(e.value)
      }
    }
    setValues(next)
  }, [data, date])

  const dirtyRows = useMemo(() => collectRows(values, data, date), [values, data, date])
  const activity = useMemo(
    () =>
      data
        ? entryActivityInMonth(data, viewedPeriod)
        : new Map<string, { count: number; byKpi: { kpiId: string; count: number }[] }>(),
    [data, viewedPeriod],
  )
  const periods = useMemo(() => (data ? listPeriods(data) : []), [data])

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
    // Cells that had a saved value for this day but were cleared → delete them.
    const cleared: EntryKey[] = []
    for (const e of data.entries) {
      if (e.date === date && e.member_id && e.market_id) {
        const v = values[keyOf(e.kpi_id, e.member_id, e.market_id)]
        if (v == null || v.trim() === '') {
          cleared.push({ kpi_id: e.kpi_id, member_id: e.member_id, market_id: e.market_id, date })
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
      toast.success(`${parts.join(' · ')} for ${format(parseISO(date), 'd MMM')}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  async function onDeleteDay(day: string) {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to edit entries.')
      return
    }
    if (!window.confirm(`Delete all entries logged on ${format(parseISO(day), 'd MMM yyyy')}?`)) return
    try {
      await deleteDay.mutateAsync(day)
      toast.success(`Deleted entries for ${format(parseISO(day), 'd MMM')}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // Fixed member column; inputs flex to fill the panel evenly (no middle gap
  // from a ballooning name column, no empty gap on the right).
  const cols = `180px repeat(${markets.length}, minmax(72px, 1fr))`

  return (
    <div className="max-w-[1120px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Daily entry</p>
          <h1 className="mt-1.5 font-heading text-3xl font-semibold tracking-tight text-ink">Update KPIs</h1>
          <p className="mt-2 text-sm text-ink-muted">Log each member's numbers for the day — progress rolls up to the month.</p>
        </div>
        <div className="flex items-end gap-2.5">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Day</span>
            <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1">
              <button
                onClick={() => jumpToDate(format(addDays(parseISO(date), -1), 'yyyy-MM-dd'))}
                aria-label="Previous day"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft size={17} strokeWidth={2.2} />
              </button>
              <input
                type="date"
                value={date}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => jumpToDate(e.target.value)}
                className="tnum h-8 border-0 bg-transparent px-1 text-sm font-medium text-ink focus:outline-none"
              />
              <button
                onClick={() => {
                  const next = format(addDays(parseISO(date), 1), 'yyyy-MM-dd')
                  if (next <= todayStr) jumpToDate(next)
                }}
                disabled={date >= todayStr}
                aria-label="Next day"
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-lg transition-colors',
                  date >= todayStr ? 'cursor-not-allowed text-ink-muted/40' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                <ChevronRight size={17} strokeWidth={2.2} />
              </button>
            </div>
          </div>
          <Button
            variant="subtle"
            size="md"
            onClick={() => jumpToDate(todayStr)}
            disabled={date === todayStr}
            title="Jump to today"
          >
            Today
          </Button>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Entry grid */}
        <Panel
          className="lg:col-span-2"
          eyebrow={`${format(parseISO(date), 'EEEE, d MMM yyyy')} · ${filledForKpi}/${totalForKpi} entered`}
          title={activeKpi.name}
        >
          {/* KPI selector — its own island */}
          <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-line bg-surface-2/40 p-1.5">
            {kpis.map((k) => (
              <button
                key={k.id}
                onClick={() => setActiveKpiId(k.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  k.id === activeKpi.id
                    ? 'bg-brand text-brand-contrast shadow-card'
                    : 'text-ink-muted hover:bg-surface hover:text-ink',
                )}
              >
                {k.name}
              </button>
            ))}
          </div>

          {/* Aligned table island */}
          <div className="overflow-x-auto">
            <div className="w-full min-w-[480px] overflow-hidden rounded-xl border border-line">
              <div
                className="grid items-end gap-2.5 border-b border-line bg-surface-2/50 px-4 py-3"
                style={{ gridTemplateColumns: cols }}
              >
                <span className="eyebrow self-end">Member</span>
                {markets.map((m) => {
                  const t = periodTarget(data, activeKpi.id, m.id, period)
                  const mtd = periodFact(data, activeKpi, period, { marketId: m.id })
                  const cfg = data.kpiMarketConfig.find(
                    (c) => c.period === period && c.market_id === m.id && c.kpi_id === activeKpi.id,
                  )
                  return (
                    <div key={m.id} className="flex flex-col items-center gap-1">
                      <Flag code={m.code} size={22} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{m.code}</span>
                      {cfg?.role === 'extra' ? (
                        <span className="rounded-full bg-brand-soft px-1.5 text-2xs font-semibold text-brand-ink">
                          extra · €{cfg.eur_rate}/seller
                        </span>
                      ) : (
                        <span className="tnum text-2xs leading-tight text-ink-muted/80">
                          tgt {t != null ? formatCompact(t, activeKpi.format) : '—'}
                          {' · '}
                          {mtd != null ? formatCompact(mtd, activeKpi.format) : '0'} so far
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
        </Panel>

        {/* Calendar + day detail — browse full history, jump to any day */}
        <div className="space-y-5">
          <Panel
            eyebrow="Browse history"
            title="Calendar"
            actions={
              <MonthNav
                period={viewedPeriod}
                periods={periods}
                onChange={(p) => setViewedPeriod(periods[0] && p < periods[0] ? periods[0] : p)}
              />
            }
          >
            <EntryCalendar
              period={viewedPeriod}
              activity={activity}
              selected={date}
              today={todayStr}
              onSelect={jumpToDate}
            />
          </Panel>

          <Panel
            eyebrow={format(parseISO(date), 'EEEE')}
            title={format(parseISO(date), 'd MMM yyyy')}
            actions={
              <button
                onClick={() => onDeleteDay(date)}
                aria-label={`Delete entries for ${format(parseISO(date), 'd MMM')}`}
                title="Delete this day"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-bad-soft hover:text-bad"
              >
                <Trash2 size={15} />
              </button>
            }
          >
            <DayDetail data={data} date={date} />
          </Panel>
        </div>
      </div>

      {/* Per-seller assortment quality (feeds the Planned assortment completeness KPI) */}
      <Panel
        eyebrow={`Assortment quality · ${format(parseISO(period), 'MMMM yyyy')}`}
        title="Planned assortment completeness"
      >
        <AssortmentEditor data={data} period={period} />
      </Panel>
    </div>
  )
}

function collectRows(
  values: Record<string, string>,
  data: DashboardData | undefined,
  date: string,
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
      date, // a real day (yyyy-MM-dd); rolls up to the month in the engine
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
