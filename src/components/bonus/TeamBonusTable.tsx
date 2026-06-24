import { useMemo } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { teamBonus, BONUS_CAP, BONUS_THRESHOLD, type MemberBonus } from '@/lib/metrics'
import { formatCompact, formatPercent, formatValue } from '@/lib/format'
import type { DashboardData, Market } from '@/lib/types'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  period: string
}

const eur = (n: number) => formatValue(n, { format: 'currency' })

export function TeamBonusTable({ data, period }: Props) {
  const bonus = useMemo(() => teamBonus(data, period), [data, period])

  // Group members by their single market (sorted), keeping member order within.
  const groups = useMemo(() => {
    const byMarket = new Map<string, { market: Market | null; rows: MemberBonus[] }>()
    for (const mb of bonus) {
      const key = mb.market?.id ?? 'none'
      const g = byMarket.get(key) ?? { market: mb.market, rows: [] }
      g.rows.push(mb)
      byMarket.set(key, g)
    }
    return [...byMarket.values()].sort(
      (a, z) => (a.market?.sort_order ?? 99) - (z.market?.sort_order ?? 99),
    )
  }, [bonus])

  const teamTotal = bonus.reduce((s, mb) => s + mb.finalBonus, 0)
  const hasPlan = bonus.some((mb) => mb.coreKpis.length > 0 || mb.extras.length > 0)

  return (
    <div className="space-y-4">
      {!hasPlan && (
        <div className="rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-soft">
          No bonus plan set for this month yet. Configure per-market weights, rates and base pools in{' '}
          <strong className="font-semibold text-ink">Settings → Bonus plan</strong>.
        </div>
      )}

      {groups.map((g) => (
        <MarketBonusCard key={g.market?.id ?? 'none'} market={g.market} rows={g.rows} />
      ))}

      {/* Team total + explanation — collapsed by default. */}
      <details className="group rounded-xl border border-line bg-surface px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink-soft marker:content-none">
          <span>Team total &amp; how it works</span>
          <ChevronDown size={16} className="text-ink-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="flex items-baseline justify-between">
            <span className="text-sm text-ink-soft">Team total this month</span>
            <span className="tnum font-display text-lg font-semibold text-ink">{eur(teamTotal)}</span>
          </p>
          <p className="text-2xs leading-relaxed text-ink-muted">
            Each person is scored against <strong className="font-semibold text-ink-soft">their own market's plan</strong>.
            Core KPIs pay <strong className="font-semibold text-ink-soft">weight × base</strong> scaled by attainment — only
            once a KPI reaches <strong className="font-semibold text-ink-soft">{Math.round(BONUS_THRESHOLD * 100)}%</strong>,
            never more than <strong className="font-semibold text-ink-soft">{Math.round(BONUS_CAP * 100)}%</strong> of its
            share. Extra bonuses pay <strong className="font-semibold text-ink-soft">€ × qualifying sellers</strong>, only
            for members with a 1st active offer.
          </p>
        </div>
      </details>
    </div>
  )
}

function MarketBonusCard({ market, rows }: { market: Market | null; rows: MemberBonus[] }) {
  // All members in a market share the same plan; take the core KPI set from the first row.
  const coreKpis = rows[0]?.coreKpis.map((k) => k.kpi) ?? []
  const cols = `minmax(150px,1.2fr) repeat(${Math.max(coreKpis.length, 1)}, minmax(80px,1fr)) minmax(132px,1.1fr) 76px 92px`

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-2.5 border-b border-line bg-surface-2/40 px-4 py-2.5">
        {market && <Flag code={market.code} size={20} />}
        <span className="font-display text-sm font-semibold text-ink">{market?.name ?? 'Unassigned'}</span>
        <span className="text-2xs text-ink-muted">· {rows.length} member{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid items-end gap-2 border-b border-line px-4 py-2.5" style={{ gridTemplateColumns: cols }}>
            <span className="eyebrow self-end">Member</span>
            {coreKpis.map((k) => (
              <span key={k.id} className="text-center text-2xs font-semibold uppercase leading-tight tracking-wide text-ink-muted" title={k.name}>
                {k.name}
              </span>
            ))}
            <span className="self-end text-2xs font-semibold uppercase tracking-wide text-ink-muted">Extra bonuses</span>
            <span className="self-end text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted">Base</span>
            <span className="justify-self-end self-end text-2xs font-semibold uppercase tracking-wide text-brand-ink">Final</span>
          </div>

          <div className="divide-y divide-line">
            {rows.map((mb) => (
              <div key={mb.member.id} className="grid items-center gap-2 px-4 py-2.5 transition-colors hover:bg-surface-2/30" style={{ gridTemplateColumns: cols }}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={mb.member.initials} color={mb.member.color} avatar={mb.member.avatar} size="sm" />
                  <span className="truncate text-sm font-medium text-ink">{mb.member.name}</span>
                </span>

                {mb.coreKpis.map((r) => {
                  const capped = r.attainment != null && r.attainment >= BONUS_CAP
                  return (
                    <span key={r.kpi.id} className="flex flex-col items-center leading-tight">
                      {r.attainment == null ? (
                        <span className="text-sm text-ink-muted">—</span>
                      ) : r.met ? (
                        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-good">
                          <Check size={13} strokeWidth={3} />
                          {formatPercent(r.attainment)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-warn">
                          <X size={12} strokeWidth={3} />
                          {formatPercent(r.attainment)}
                        </span>
                      )}
                      <span className="tnum text-2xs text-ink-muted">
                        {formatCompact(r.value, r.kpi.format)}
                        {capped ? ' · cap' : ''}
                      </span>
                    </span>
                  )
                })}

                <span className="min-w-0">
                  {mb.extras.length === 0 ? (
                    <span className="text-2xs text-ink-muted">—</span>
                  ) : (
                    <span className="flex flex-col gap-0.5">
                      {mb.extras.map((x) => (
                        <span key={x.kpi.id} className="flex items-baseline justify-between gap-1.5 text-2xs">
                          <span className="truncate text-ink-soft" title={x.kpi.name}>{x.kpi.name}</span>
                          <span className={cn('tnum shrink-0 font-semibold', x.bonus > 0 ? 'text-ink' : 'text-ink-muted')}>
                            {x.value ?? 0}×{eur(x.eurRate)}
                          </span>
                        </span>
                      ))}
                      {!mb.hasActiveOffer && (
                        <span className="text-2xs text-ink-muted">gated · no 1st active offer</span>
                      )}
                    </span>
                  )}
                </span>

                <span className="tnum justify-self-center text-xs text-ink-muted">{eur(mb.maxBonus)}</span>
                <span className="tnum justify-self-end text-base font-semibold text-ink">{eur(mb.finalBonus)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
