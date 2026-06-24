import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { teamBonus, type MemberBonus } from '@/lib/metrics'
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
  const [open, setOpen] = useState<string | null>(null)

  const teamTotal = bonus.reduce((s, mb) => s + mb.finalBonus, 0)
  const hasPlan = bonus.some((mb) => mb.coreKpis.length > 0 || mb.extras.length > 0)

  if (!hasPlan) {
    return (
      <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-soft">
        No bonus plan for this month yet. Open the <strong className="font-semibold text-ink">Weights</strong> tab to set
        each market's weights and each person's base pool.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <ul className="divide-y divide-line">
        {bonus.map((mb) => {
          const met = mb.coreKpis.filter((k) => k.met).length
          const expanded = open === mb.member.id
          return (
            <li key={mb.member.id}>
              <button
                onClick={() => setOpen(expanded ? null : mb.member.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/40"
              >
                <Avatar initials={mb.member.initials} color={mb.member.color} avatar={mb.member.avatar} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{mb.member.name}</span>
                    {mb.market && <Flag code={mb.market.code} size={15} />}
                  </span>
                  <span className="text-2xs text-ink-muted">
                    {met}/{mb.coreKpis.length} KPIs met
                    {mb.extras.some((x) => x.bonus > 0) ? ' · + extras' : ''}
                  </span>
                </span>
                <span className="tnum text-base font-semibold text-ink">{eur(mb.finalBonus)}</span>
                <ChevronDown size={16} className={cn('text-ink-muted transition-transform', expanded && 'rotate-180')} />
              </button>

              {expanded && <Breakdown mb={mb} />}
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-line bg-surface-2/40 px-4 py-2.5">
        <span className="text-sm text-ink-soft">Team total</span>
        <span className="tnum font-display text-lg font-semibold text-ink">{eur(teamTotal)}</span>
      </div>
    </div>
  )
}

function Breakdown({ mb }: { mb: MemberBonus }) {
  return (
    <div className="space-y-2.5 border-t border-line bg-surface-2/20 px-4 py-3">
      <div className="space-y-1">
        {mb.coreKpis.map((k) => (
          <Row key={k.kpi.id} label={k.kpi.name} met={k.met} value={eur(k.bonus)} note={k.met ? undefined : 'below 80%'} />
        ))}
      </div>

      {mb.extras.length > 0 && (
        <div className="space-y-1 border-t border-line pt-2">
          {mb.extras.map((x) => (
            <Row
              key={x.kpi.id}
              label={x.kpi.name}
              met={x.bonus > 0}
              value={eur(x.bonus)}
              note={`${x.value ?? 0} × ${eur(x.eurRate)}${!mb.hasActiveOffer ? ' · needs 1st active offer' : ''}`}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
        <span className="text-ink-muted">Base pool {eur(mb.maxBonus)}</span>
        <span className="tnum font-semibold text-ink">Final {eur(mb.finalBonus)}</span>
      </div>
    </div>
  )
}

function Row({ label, met, value, note }: { label: string; met: boolean; value: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', met ? 'bg-good' : 'bg-line-strong')} />
      <span className="min-w-0 flex-1 truncate text-ink-soft">{label}</span>
      {note && <span className="shrink-0 text-2xs text-ink-muted">{note}</span>}
      <span className={cn('tnum shrink-0 font-semibold', met ? 'text-ink' : 'text-ink-muted')}>{value}</span>
    </div>
  )
}
