import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { activeMembers, heatmap } from '@/lib/metrics'
import { STATUS_SOFT_BG, STATUS_TEXT } from '@/lib/status'
import type { DashboardData, Kpi, TimeRange } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'

interface Props {
  data: DashboardData
  range: TimeRange
  kpi?: Kpi
}

export function AdherenceHeatmap({ data, range, kpi }: Props) {
  const members = activeMembers(data)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const cells = useMemo(() => heatmap(data, range, kpi), [data, range, kpi])
  const cellMap = useMemo(() => {
    const m = new Map<string, (typeof cells)[number]>()
    for (const c of cells) m.set(`${c.memberId}:${c.marketId}`, c)
    return m
  }, [cells])

  const cols = `minmax(104px, 1.4fr) repeat(${markets.length}, minmax(48px, 1fr))`

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[360px]">
        {/* header */}
        <div className="grid items-center gap-2 pb-2" style={{ gridTemplateColumns: cols }}>
          <span className="eyebrow">Member</span>
          {markets.map((m) => (
            <span key={m.id} className="text-center text-2xs font-semibold uppercase tracking-wider text-ink-muted">
              {m.code}
            </span>
          ))}
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }}>
              <div className="flex min-w-0 items-center gap-2">
                <Avatar initials={member.initials} color={member.color} size="sm" />
                <span className="truncate text-xs font-semibold text-ink">{member.name.split(' ')[0]}</span>
              </div>
              {markets.map((market) => {
                const cell = cellMap.get(`${member.id}:${market.id}`)
                if (!cell?.covered) {
                  return (
                    <div
                      key={market.id}
                      className="grid h-11 place-items-center rounded-lg border border-dashed border-line text-ink-muted/50"
                    >
                      <span className="text-2xs">·</span>
                    </div>
                  )
                }
                return (
                  <div
                    key={market.id}
                    title={`${member.name} · ${market.name}: ${cell.attainment != null ? Math.round(cell.attainment * 100) + '%' : '—'}`}
                    className={cn(
                      'tnum grid h-11 place-items-center rounded-lg text-xs font-bold transition-transform duration-200 hover:scale-[1.04]',
                      STATUS_SOFT_BG[cell.status],
                      STATUS_TEXT[cell.status],
                    )}
                  >
                    {cell.attainment != null ? `${Math.round(cell.attainment * 100)}%` : '—'}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
