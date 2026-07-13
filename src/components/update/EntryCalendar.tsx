import { useMemo } from 'react'
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
import { MoveRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { monthStart, netChanges, type NetChange } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface EntryCalendarProps {
  period: string
  /** Change count per local day (yyyy-MM-dd) — see changeActivityInMonth. */
  activity: Map<string, number>
  selected: string
  today: string
  onSelect: (date: string) => void
}

/** One month's day grid — every day is shown and clickable (not just active ones). */
export function EntryCalendar({ period, activity, selected, today, onSelect }: EntryCalendarProps) {
  const first = parseISO(period)
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((w) => (
        <div key={w} className="pb-1 text-center text-2xs font-semibold uppercase tracking-wider text-ink-muted">
          {w}
        </div>
      ))}
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const inMonth = isSameMonth(day, first)
        const count = activity.get(dateStr) ?? 0
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
                {count}
              </span>
            ) : (
              <span className="tnum text-2xs leading-tight text-ink-muted/40">·</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Everything that NET-changed on one day: per KPI, who changed which total from → to. */
export function ChangeDetail({ data, date }: { data: DashboardData; date: string }) {
  const kpiById = useMemo(() => new Map(data.kpis.map((k) => [k.id, k])), [data.kpis])
  const memberById = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data.members])
  const marketById = useMemo(() => new Map(data.markets.map((m) => [m.id, m])), [data.markets])

  // Same-cell edits within the day are already collapsed to first → last.
  const dayChanges = useMemo(
    () => netChanges(data).filter((c) => c.day === date),
    [data, date],
  )
  const groups = useMemo(() => {
    const byKpi = new Map<string, NetChange[]>()
    for (const c of dayChanges) {
      const arr = byKpi.get(c.kpi_id) ?? []
      arr.push(c)
      byKpi.set(c.kpi_id, arr)
    }
    return [...byKpi.entries()]
      .map(([kpiId, rows]) => ({ kpi: kpiById.get(kpiId), rows }))
      .filter((g) => g.kpi)
      .sort((a, z) => (a.kpi!.sort_order ?? 0) - (z.kpi!.sort_order ?? 0))
  }, [dayChanges, kpiById])

  if (dayChanges.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No changes logged on this day.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-2xs text-ink-muted">
        {dayChanges.length} change{dayChanges.length === 1 ? '' : 's'} across {groups.length} KPI
        {groups.length === 1 ? '' : 's'}.
      </p>
      {groups.map(({ kpi, rows }) => (
        <div key={kpi!.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink">{kpi!.name}</span>
            <span className="chip shrink-0">{rows.length} change{rows.length === 1 ? '' : 's'}</span>
          </div>
          <ul className="space-y-1">
            {rows.map((c) => {
              const member = c.member_id ? memberById.get(c.member_id) : null
              const market = c.market_id ? marketById.get(c.market_id) : null
              return (
                <li
                  key={`${c.kpi_id}:${c.member_id}:${c.market_id}:${c.period}`}
                  className="flex items-center gap-2 rounded-lg bg-surface-2/40 px-2.5 py-1.5"
                >
                  {member && (
                    <Avatar initials={member.initials} color={member.color} avatar={member.avatar} size="sm" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                    {member?.name ?? 'Team'}
                  </span>
                  {/* Corrections to another month's total are tagged with that month. */}
                  {c.period !== monthStart(c.day) && (
                    <span className="chip shrink-0">{format(parseISO(c.period), 'MMM')}</span>
                  )}
                  {market && <Flag code={market.code} size={16} />}
                  <span className="tnum flex shrink-0 items-center gap-1 text-sm font-semibold text-ink">
                    {c.old_value != null && (
                      <>
                        <span className="font-medium text-ink-muted line-through decoration-ink-muted/50">
                          {formatValue(c.old_value, kpi!)}
                        </span>
                        <MoveRight size={12} className="text-ink-muted" />
                      </>
                    )}
                    {c.new_value != null ? (
                      formatValue(c.new_value, kpi!)
                    ) : (
                      <span className="font-medium text-bad">removed</span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-2xs text-ink-muted">
                    {format(new Date(c.changed_at), 'HH:mm')}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
