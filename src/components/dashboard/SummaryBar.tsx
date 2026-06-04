import { format, parseISO } from 'date-fns'
import { Globe2, X } from 'lucide-react'
import { formatPercent } from '@/lib/format'
import type { KpiSnapshot } from '@/lib/metrics'
import { STATUS_LABEL, type Status } from '@/lib/status'
import { ProgressRing } from './ProgressRing'
import { Flag } from '@/components/ui/Flag'

interface Props {
  snaps: KpiSnapshot[]
  period: string
  scopeLabel?: string
  /** The selected country (code + name), or null for the all-countries view. */
  scopeCountry?: { code: string; name: string } | null
  onClearScope?: () => void
}

export function SummaryBar({ snaps, period, scopeLabel, scopeCountry, onClearScope }: Props) {
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
    <section className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      {/* Adherence */}
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

      {/* Compact status tallies (fixed width — never stretch) */}
      <div className="flex items-center gap-2.5">
        {tallies.map((t) => (
          <div key={t.status} className="w-[104px] rounded-xl border border-line bg-surface-2/60 px-3 py-2">
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

      {/* Persistent scope indicator (right) — present in both states, so no layout shift */}
      <div className="ml-auto">
        {scopeCountry ? (
          <div className="flex items-center gap-2.5 rounded-xl border-2 border-brand bg-brand-soft py-1.5 pl-2.5 pr-1.5">
            <Flag code={scopeCountry.code} size={26} />
            <div className="leading-tight">
              <p className="text-2xs font-semibold uppercase tracking-wider text-brand-ink">Viewing</p>
              <p className="font-display text-sm font-semibold text-ink">{scopeCountry.name}</p>
            </div>
            <button
              onClick={onClearScope}
              aria-label="Show all countries"
              title="Show all countries"
              className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-brand-ink transition-colors hover:bg-surface"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-sm font-medium text-ink-muted">
            <Globe2 size={16} strokeWidth={2} />
            All countries
          </div>
        )}
      </div>
    </section>
  )
}
