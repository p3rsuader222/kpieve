import { formatPercent } from '@/lib/format'
import type { KpiSnapshot } from '@/lib/metrics'
import { STATUS_LABEL, type Status } from '@/lib/status'
import type { TimeRange } from '@/lib/types'
import { ProgressRing } from './ProgressRing'

const RANGE_LABEL: Record<TimeRange, string> = {
  today: 'latest day',
  week: 'last 7 days',
  month: 'last 30 days',
}

export function SummaryBar({ snaps, range }: { snaps: KpiSnapshot[]; range: TimeRange }) {
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
    <section className="card flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-5">
        <ProgressRing
          progress={adherence ?? 0}
          status={ringStatus}
          size={120}
          stroke={10}
          label={adherence != null ? formatPercent(adherence) : '—'}
          sublabel="on track"
        />
        <div>
          <p className="eyebrow">Team adherence</p>
          <h2 className="mt-1 max-w-[15ch] text-balance font-display text-xl font-semibold leading-tight text-ink">
            {counts.good} of {scored.length} KPIs meeting target
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Across the {RANGE_LABEL[range]}</p>
        </div>
      </div>

      <div className="hidden h-16 w-px bg-line sm:block" />

      <div className="grid flex-1 grid-cols-3 gap-3">
        {tallies.map((t) => (
          <div key={t.status} className="rounded-xl border border-line bg-surface-2/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: `hsl(var(--${t.status === 'good' ? 'good' : t.status === 'warn' ? 'warn' : 'bad'}))` }}
              />
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <p className="tnum mt-1.5 font-display text-3xl font-semibold leading-none text-ink">{t.n}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
