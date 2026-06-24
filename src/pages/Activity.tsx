import { useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { entryActivityInMonth, monthStart, prevPeriod } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { useDashboard } from '@/hooks/useDashboard'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function Activity() {
  const { data, isLoading } = useDashboard()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [selected, setSelected] = useState(todayStr)

  const thisMonth = monthStart(new Date())
  const lastMonth = prevPeriod(thisMonth)

  // Per-day activity for both months, merged into one lookup keyed by ISO day.
  const activity = useMemo(() => {
    if (!data) return new Map<string, { count: number; byKpi: { kpiId: string; count: number }[] }>()
    const merged = new Map(entryActivityInMonth(data, lastMonth))
    for (const [date, v] of entryActivityInMonth(data, thisMonth)) merged.set(date, v)
    return merged
  }, [data, lastMonth, thisMonth])

  if (isLoading || !data) return <ActivitySkeleton />

  return (
    <div className="max-w-[1120px] space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface">
          <CalendarCheck size={22} className="text-brand" />
        </span>
        <div>
          <p className="eyebrow">Update history</p>
          <h1 className="mt-1 font-heading text-[1.6rem] font-semibold leading-none tracking-tight text-ink">Activity</h1>
          <p className="mt-1.5 text-sm text-ink-muted">When you logged KPI values — pick a day to see which and how many.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
          <MonthCalendar
            period={lastMonth}
            activity={activity}
            selected={selected}
            today={todayStr}
            onSelect={setSelected}
          />
          <MonthCalendar
            period={thisMonth}
            activity={activity}
            selected={selected}
            today={todayStr}
            onSelect={setSelected}
          />
        </div>

        <DayDetail data={data} date={selected} />
      </div>
    </div>
  )
}

interface CalendarProps {
  period: string
  activity: Map<string, { count: number; byKpi: { kpiId: string; count: number }[] }>
  selected: string
  today: string
  onSelect: (date: string) => void
}

function MonthCalendar({ period, activity, selected, today, onSelect }: CalendarProps) {
  const first = parseISO(period)
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <Panel eyebrow="Month" title={format(first, 'MMMM yyyy')}>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-2xs font-semibold uppercase tracking-wider text-ink-muted">
            {w}
          </div>
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, first)
          const entry = activity.get(dateStr)
          const count = entry?.count ?? 0
          const isToday = dateStr === today
          const isSelected = dateStr === selected
          const isFuture = dateStr > today

          if (!inMonth) return <div key={dateStr} />

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              disabled={isFuture}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-center transition-colors',
                isSelected
                  ? 'border-brand bg-brand-soft'
                  : count > 0
                    ? 'border-line bg-surface-2/40 hover:bg-surface-2'
                    : 'border-transparent hover:bg-surface-2/60',
                isFuture && 'cursor-not-allowed opacity-35',
              )}
            >
              <span
                className={cn(
                  'tnum text-xs font-semibold leading-none',
                  isToday ? 'text-brand' : isSelected ? 'text-brand-ink' : 'text-ink',
                )}
              >
                {format(day, 'd')}
              </span>
              {count > 0 ? (
                <span className="tnum rounded-full bg-brand px-1.5 text-2xs font-bold leading-tight text-brand-contrast">
                  +{count}
                </span>
              ) : (
                <span className="tnum text-2xs leading-tight text-ink-muted/40">0</span>
              )}
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function DayDetail({ data, date }: { data: DashboardData; date: string }) {
  const kpiById = useMemo(() => new Map(data.kpis.map((k) => [k.id, k])), [data.kpis])
  const memberById = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members])
  const marketById = useMemo(() => new Map(data.markets.map((m) => [m.id, m])), [data.markets])

  const dayEntries = useMemo(() => data.entries.filter((e) => e.date === date), [data.entries, date])
  const groups = useMemo(() => {
    const byKpi = new Map<string, typeof dayEntries>()
    for (const e of dayEntries) {
      const arr = byKpi.get(e.kpi_id) ?? []
      arr.push(e)
      byKpi.set(e.kpi_id, arr)
    }
    return [...byKpi.entries()]
      .map(([kpiId, rows]) => ({ kpi: kpiById.get(kpiId), rows }))
      .filter((g) => g.kpi)
      .sort((a, z) => (a.kpi!.sort_order ?? 0) - (z.kpi!.sort_order ?? 0))
  }, [dayEntries, kpiById])

  return (
    <Panel
      eyebrow={format(parseISO(date), 'EEEE')}
      title={format(parseISO(date), 'd MMM yyyy')}
    >
      {dayEntries.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">No KPI values logged on this day.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-2xs text-ink-muted">
            {dayEntries.length} value{dayEntries.length === 1 ? '' : 's'} across {groups.length} KPI
            {groups.length === 1 ? '' : 's'}.
          </p>
          {groups.map(({ kpi, rows }) => (
            <div key={kpi!.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-ink">{kpi!.name}</span>
                <span className="chip shrink-0">{rows.length} value{rows.length === 1 ? '' : 's'}</span>
              </div>
              <ul className="space-y-1">
                {rows.map((e) => {
                  const member = e.member_id ? memberById.get(e.member_id) : null
                  const market = e.market_id ? marketById.get(e.market_id) : null
                  return (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 rounded-lg bg-surface-2/40 px-2.5 py-1.5"
                    >
                      {member && (
                        <Avatar initials={member.initials} color={member.color} avatar={member.avatar} size="sm" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                        {member?.name ?? 'Team'}
                      </span>
                      {market && <Flag code={market.code} size={16} />}
                      <span className="tnum text-sm font-semibold text-ink">{formatValue(e.value, kpi!)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function ActivitySkeleton() {
  return (
    <div className="max-w-[1120px] space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
