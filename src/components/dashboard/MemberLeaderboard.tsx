import { useMemo } from 'react'
import { formatPercent } from '@/lib/format'
import {
  activeKpis,
  activeMembers,
  memberAdherencePeriod,
  memberTargetForPeriod,
  periodFact,
} from '@/lib/metrics'
import { attainment, statusFromAttainment, STATUS_VAR, type Status } from '@/lib/status'
import type { DashboardData } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'

export function MemberLeaderboard({ data, period }: { data: DashboardData; period: string }) {
  const rows = useMemo(() => {
    const kpis = activeKpis(data)
    return activeMembers(data)
      .map((member) => {
        const statuses: { id: string; name: string; status: Status }[] = kpis.map((kpi) => {
          const value = periodFact(data, kpi, period, { memberId: member.id })
          const target = memberTargetForPeriod(data, kpi, member, period)
          return { id: kpi.id, name: kpi.name, status: statusFromAttainment(attainment(value, target, kpi.direction)) }
        })
        const markets = member.marketIds
          .map((id) => data.markets.find((m) => m.id === id)?.code)
          .filter(Boolean)
          .join(' · ')
        return { member, markets, adherence: memberAdherencePeriod(data, member, period), statuses }
      })
      .sort((a, z) => (z.adherence ?? -1) - (a.adherence ?? -1))
  }, [data, period])

  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li
          key={r.member.id}
          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
        >
          <span className="tnum w-4 text-center text-xs font-bold text-ink-muted">{i + 1}</span>
          <Avatar initials={r.member.initials} color={r.member.color} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{r.member.name}</p>
            <p className="text-2xs font-medium uppercase tracking-wider text-ink-muted">{r.markets}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {r.statuses.map((s) => (
              <span
                key={s.id}
                title={`${s.name}`}
                className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/5"
                style={{ background: STATUS_VAR[s.status] }}
              />
            ))}
          </div>
          <span className="tnum w-12 text-right text-sm font-bold text-ink">
            {r.adherence != null ? formatPercent(r.adherence) : '—'}
          </span>
        </li>
      ))}
    </ol>
  )
}
