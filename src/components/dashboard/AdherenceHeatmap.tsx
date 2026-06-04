import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { activeMembers, heatmapPeriod } from '@/lib/metrics'
import { STATUS_SOFT_BG, STATUS_TEXT } from '@/lib/status'
import type { DashboardData, Kpi } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  period: string
  kpi?: Kpi
  /** Emphasise this market's column (selected country). */
  highlightMarket?: string | null
}

export function AdherenceHeatmap({ data, period, kpi, highlightMarket }: Props) {
  const members = activeMembers(data)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const cells = useMemo(() => heatmapPeriod(data, period, kpi), [data, period, kpi])
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
        <div className="grid items-end gap-2 border-b border-line pb-2.5" style={{ gridTemplateColumns: cols }}>
          <span className="eyebrow self-end">Member</span>
          {markets.map((m) => {
            const hi = highlightMarket === m.id
            return (
              <div key={m.id} className={cn('flex flex-col items-center gap-1 transition-opacity', highlightMarket && !hi && 'opacity-40')}>
                <Flag code={m.code} size={20} />
                <span className={cn('text-2xs font-bold uppercase tracking-wider', hi ? 'text-brand-ink' : 'text-ink-muted')}>{m.code}</span>
              </div>
            )
          })}
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }}>
              <div className="flex min-w-0 items-center gap-2">
                <Avatar initials={member.initials} color={member.color} avatar={member.avatar} size="sm" />
                <span className="truncate text-xs font-semibold text-ink">{member.name.split(' ')[0]}</span>
              </div>
              {markets.map((market) => {
                const hi = highlightMarket === market.id
                const dim = highlightMarket && !hi
                const cell = cellMap.get(`${member.id}:${market.id}`)
                if (!cell?.covered) {
                  return (
                    <div
                      key={market.id}
                      className={cn(
                        'grid h-11 place-items-center rounded-lg border border-dashed border-line text-ink-muted/50 transition-opacity',
                        dim && 'opacity-40',
                      )}
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
                      'tnum grid h-11 place-items-center rounded-lg text-xs font-bold transition-all duration-200 hover:scale-[1.04]',
                      STATUS_SOFT_BG[cell.status],
                      STATUS_TEXT[cell.status],
                      hi && 'ring-2 ring-inset ring-brand/40',
                      dim && 'opacity-40',
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
