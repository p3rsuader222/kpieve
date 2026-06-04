import { format, parseISO } from 'date-fns'
import { formatPercent } from '@/lib/format'
import type { KpiSnapshot } from '@/lib/metrics'
import { STATUS_LABEL, type Status } from '@/lib/status'
import { ProgressRing } from './ProgressRing'

export function SummaryBar({
  snaps,
  period,
  scopeLabel,
}: {
  snaps: KpiSnapshot[]
  period: string
  scopeLabel?: string
}) {
  const scored = snaps.filter((s) => s.status !== 'none')
  const counts: Record<Status, number> = { good: 0, warn: 0, bad: 0, none: 0 }
  for (const s of snaps) counts[s.status]++
  const adherence = scored.length ? counts.good / scored.length : null

  const tallies: { status: Exclude<Status, 'none'>; n: number }[] = [
    { status: 'good', n: counts.good },
    { status: 'warn', n: counts.warn },
    { status: 'bad', n: counts.bad },
  ]

  const ringStatus: Status = adherence == null ? 'none' : adherence >= 0.66 ? 'good' : adherence >= 0.34 ? 'warn' : 'bad'

  return (
    <section className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex items-center gap-4">
        <ProgressRing
          progress={adherence ?? 0}
          status={ringStatus}
          size={84}
          stroke={8}
          label={adherence != null ? formatPercent(adherence) : '—'}
        />
        <div>
          <p className="eyebrow">Team adherence</p>
          <h2 className="mt-1 max-w-[16ch] text-balance font-display text-lg font-semibold leading-tight text-ink">
            {counts.good} of {scored.length} KPIs on target
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {scopeLabel ? `${scopeLabel} · ` : ''}
            {format(parseISO(period), 'MMMM yyyy')}
          </p>
        </div>
      </div>

      <div className="hidden h-12 w-px bg-line sm:block" />

      <div className="grid flex-1 grid-cols-3 gap-2.5">
        {tallies.map((t) => (
          <div key={t.status} className="rounded-xl border border-line bg-surface-2/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: `hsl(var(--${t.status === 'good' ? 'good' : t.status === 'warn' ? 'warn' : 'bad'}))` }}
              />
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <p className="tnum mt-1 font-display text-2xl font-semibold leading-none text-ink">{t.n}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
