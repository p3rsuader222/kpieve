import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, teamBonus, type MemberBonusKpi } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import type { BonusBaseUpsert, KpiMarketConfigUpsert } from '@/data/datasource'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'
import { BonusPlanEditor } from '@/components/settings/BonusPlanEditor'

export type BonusView = 'score' | 'weights'

interface Props {
  data: DashboardData
  period: string
  /** Chosen in the page header (next to the month selector). */
  view: BonusView
  saving: boolean
  onSave: (config: KpiMarketConfigUpsert[], base: BonusBaseUpsert[]) => void
  /** Empty-state CTA: jump straight to the Weights view. */
  onOpenWeights: () => void
}

const eur = (n: number) => formatValue(n, { format: 'currency' })

export function TeamBonusTable({ data, period, view, saving, onSave, onOpenWeights }: Props) {
  return view === 'score' ? (
    <Scoreboard data={data} period={period} onOpenWeights={onOpenWeights} />
  ) : (
    <BonusPlanEditor data={data} period={period} saving={saving} onSave={onSave} />
  )
}

function Scoreboard({
  data,
  period,
  onOpenWeights,
}: {
  data: DashboardData
  period: string
  onOpenWeights: () => void
}) {
  const bonus = useMemo(() => teamBonus(data, period), [data, period])
  const kpis = useMemo(() => activeKpis(data), [data])

  const hasPlan = bonus.some((mb) => mb.coreKpis.length > 0 || mb.additionalKpis.length > 0)
  if (!hasPlan) {
    // Proper empty state: centered in the content area with one clear action,
    // instead of a thin full-width strip that leaves the page looking broken.
    return (
      <div className="card flex flex-col items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
          <SlidersHorizontal size={22} />
        </span>
        <h3 className="mt-4 font-heading text-lg font-semibold text-ink">
          No bonus plan for {format(parseISO(period), 'MMMM yyyy')} yet
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-ink-muted">
          Set each market's KPI weights and every person's base pool — the scoreboard fills in from there. You can also
          copy last month's plan in one click.
        </p>
        <Button variant="primary" size="md" className="mt-5" onClick={onOpenWeights}>
          <SlidersHorizontal size={15} />
          Set up the bonus plan
        </Button>
      </div>
    )
  }

  // Quick lookup: member → kpiId → the scored row (core or additional).
  const byMember = new Map<string, Map<string, MemberBonusKpi>>()
  for (const mb of bonus) {
    const m = new Map<string, MemberBonusKpi>()
    for (const r of [...mb.coreKpis, ...mb.additionalKpis]) m.set(r.kpi.id, r)
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
        it didn't reach its row's floor (or the extra-bonus seller count is 0). When a KPI overshoots its ceiling the
        cell shows the real attainment and how far past the cap it went (the payout counts only up to the cap). Hover a
        cell for role, attainment and floor/cap.
      </p>
    </div>
  )
}

const ROLE_LABEL: Record<MemberBonusKpi['role'], string> = {
  core: 'Core (mandatory)',
  additional: 'Additional (on top of the pool)',
}

function Cell({ row, className }: { row: MemberBonusKpi | undefined; className: string }) {
  if (!row) return <td className={cn(className, 'text-ink-muted/40')}>—</td>
  const paid = row.bonus > 0
  // Raw attainment beyond the row's cap: the payout stops counting there, but
  // the real number (and how far past the ceiling it went) stays visible.
  const overCap =
    row.weight > 0 && row.met && row.attainment != null && row.attainment > row.capPct / 100
      ? Math.round((row.attainment - row.capPct / 100) * 100)
      : null
  const parts: string[] = [ROLE_LABEL[row.role]]
  if (row.weight > 0) {
    parts.push(
      `attainment ${row.attainment == null ? '—' : `${Math.round(row.attainment * 100)}%`} · pays from ${row.floorPct}% up to ${row.capPct}%`,
    )
    if (overCap != null) {
      parts.push(`capped: reached ${Math.round(row.attainment! * 100)}%, ${overCap}% above the ceiling`)
    }
  }
  if (row.eurRate > 0) parts.push(`${row.value ?? 0} × €${row.eurRate}/seller`)
  return (
    <td className={cn(className, paid ? 'font-semibold text-ink' : 'text-ink-muted')} title={parts.join(' — ')}>
      {eur(row.bonus)}
      {overCap != null && (
        <span className="mt-0.5 block whitespace-nowrap text-2xs font-semibold leading-tight text-warn">
          ⤒ {Math.round(row.attainment! * 100)}% · +{overCap}% over cap
        </span>
      )}
    </td>
  )
}
