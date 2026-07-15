import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { activeKpis, teamBonus, type MemberBonusKpi } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import type { BonusBaseUpsert, KpiMarketConfigUpsert } from '@/data/datasource'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { BonusPlanEditor } from '@/components/settings/BonusPlanEditor'

interface Props {
  data: DashboardData
  period: string
  saving: boolean
  onSave: (config: KpiMarketConfigUpsert[], base: BonusBaseUpsert[]) => void
}

type View = 'score' | 'weights'

const eur = (n: number) => formatValue(n, { format: 'currency' })

export function TeamBonusTable({ data, period, saving, onSave }: Props) {
  const [view, setView] = useState<View>('score')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SegmentedControl
          ariaLabel="Team bonus view"
          size="sm"
          segments={[
            { value: 'score', label: 'Scoreboard' },
            { value: 'weights', label: 'Weights' },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
      </div>

      {view === 'score' ? (
        <Scoreboard data={data} period={period} />
      ) : (
        <BonusPlanEditor data={data} period={period} saving={saving} onSave={onSave} />
      )}
    </div>
  )
}

function Scoreboard({ data, period }: { data: DashboardData; period: string }) {
  const bonus = useMemo(() => teamBonus(data, period), [data, period])
  const kpis = useMemo(() => activeKpis(data), [data])

  const hasPlan = bonus.some((mb) => mb.coreKpis.length > 0 || mb.additionalKpis.length > 0 || mb.extras.length > 0)
  if (!hasPlan) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-soft">
        No bonus plan for this month yet. Open the <strong className="font-semibold text-ink">Weights</strong> tab to set
        each market's weights and each person's base pool.
      </div>
    )
  }

  // Quick lookup: member → kpiId → the scored row (core, additional or extra).
  const byMember = new Map<string, Map<string, MemberBonusKpi>>()
  for (const mb of bonus) {
    const m = new Map<string, MemberBonusKpi>()
    for (const r of [...mb.coreKpis, ...mb.additionalKpis, ...mb.extras]) m.set(r.kpi.id, r)
    byMember.set(mb.member.id, m)
  }

  const colTotal = (kpiId: string) =>
    bonus.reduce((s, mb) => s + (byMember.get(mb.member.id)?.get(kpiId)?.bonus ?? 0), 0)
  const baseTotal = bonus.reduce((s, mb) => s + mb.maxBonus, 0)
  const finalTotal = bonus.reduce((s, mb) => s + mb.finalBonus, 0)

  const th = 'border border-line px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted align-bottom'
  const td = 'border border-line px-3 py-2 tnum text-right text-sm'

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2/60">
              <th className={cn(th, 'sticky left-0 z-10 bg-surface-2/60 text-left')}>Member</th>
              {kpis.map((k) => (
                <th key={k.id} className={cn(th, 'min-w-[5.5rem] text-right')} title={k.name}>
                  {k.name}
                </th>
              ))}
              <th className={cn(th, 'text-right')}>Base</th>
              <th className={cn(th, 'text-right text-brand-ink')}>Final</th>
            </tr>
          </thead>
          <tbody>
            {bonus.map((mb) => (
              <tr key={mb.member.id} className="hover:bg-surface-2/30">
                <td className="sticky left-0 z-10 border border-line bg-surface px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Avatar initials={mb.member.initials} color={mb.member.color} avatar={mb.member.avatar} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{mb.member.name}</span>
                    {mb.market && <Flag code={mb.market.code} size={14} />}
                  </span>
                </td>
                {kpis.map((k) => (
                  <Cell key={k.id} className={td} row={byMember.get(mb.member.id)?.get(k.id)} />
                ))}
                <td className={cn(td, 'text-ink-muted')}>{eur(mb.maxBonus)}</td>
                <td className={cn(td, 'font-semibold text-ink')}>{eur(mb.finalBonus)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2/40 font-semibold">
              <td className="sticky left-0 z-10 border border-line bg-surface-2/60 px-3 py-2 text-sm text-ink">Team total</td>
              {kpis.map((k) => (
                <td key={k.id} className={cn(td, 'text-ink-soft')}>{eur(colTotal(k.id))}</td>
              ))}
              <td className={cn(td, 'text-ink-soft')}>{eur(baseTotal)}</td>
              <td className={cn(td, 'text-ink')}>{eur(finalTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-2xs text-ink-muted">
        Each cell is the € that KPI pays the person this month. “—” means it isn't part of that market's plan; €0 means
        it didn't reach its row's floor (or the extra-bonus seller count is 0). Hover a cell for the role, attainment
        and floor/cap behind the number.
      </p>
    </div>
  )
}

const ROLE_LABEL: Record<MemberBonusKpi['role'], string> = {
  core: 'Core KPI',
  additional: 'Additional (on top of the pool)',
  extra: 'Extra bonus',
}

function Cell({ row, className }: { row: MemberBonusKpi | undefined; className: string }) {
  if (!row) return <td className={cn(className, 'text-ink-muted/40')}>—</td>
  const paid = row.bonus > 0
  const title =
    row.role === 'extra'
      ? `${ROLE_LABEL.extra} · ${row.value ?? 0} × €${row.eurRate}`
      : `${ROLE_LABEL[row.role]} · attainment ${
          row.attainment == null ? '—' : `${Math.round(row.attainment * 100)}%`
        } · pays from ${row.floorPct}% up to ${row.capPct}%`
  return (
    <td className={cn(className, paid ? 'font-semibold text-ink' : 'text-ink-muted')} title={title}>
      {eur(row.bonus)}
    </td>
  )
}
