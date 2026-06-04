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
  /** Selected country (code + name), or null for the all-countries view. */
  scopeCountry?: { code: string; name: string } | null
  onClearScope?: () => void
}

const DOT: Record<Exclude<Status, 'none'>, string> = { good: 'good', warn: 'warn', bad: 'bad' }

/** Compact, vertical adherence summary — designed to sit in the right column. */
export function SummaryBar({ snaps, period, scopeCountry, onClearScope }: Props) {
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
    <div className="space-y-4">
      {/* Scope indicator — always present (no layout shift) */}
      {scopeCountry ? (
        <div className="flex items-center gap-2.5 rounded-xl border-2 border-brand bg-brand-soft py-1.5 pl-2.5 pr-1.5">
          <Flag code={scopeCountry.code} size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-2xs font-semibold uppercase tracking-wider text-brand-ink">Viewing</p>
            <p className="truncate font-display text-sm font-semibold text-ink">{scopeCountry.name}</p>
          </div>
          <button
            onClick={onClearScope}
            aria-label="Show all countries"
            title="Show all countries"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-brand-ink transition-colors hover:bg-surface"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-sm font-medium text-ink-muted">
          <Globe2 size={16} strokeWidth={2} />
          All countries
        </div>
      )}

      {/* Adherence */}
      <div className="flex items-center gap-4">
        <ProgressRing
          progress={adherence ?? 0}
          status={ringStatus}
          size={76}
          stroke={8}
          label={adherence != null ? formatPercent(adherence) : '—'}
        />
        <div className="min-w-0">
          <p className="eyebrow">Team adherence</p>
          <h2 className="mt-1 font-display text-base font-semibold leading-tight text-ink">
            {counts.good} of {scored.length} KPIs on target
          </h2>
          <p className="mt-0.5 text-2xs text-ink-muted">{format(parseISO(period), 'MMMM yyyy')}</p>
        </div>
      </div>

      {/* Status tallies — stacked vertically */}
      <div className="space-y-1.5">
        {tallies.map((t) => (
          <div
            key={t.status}
            className="flex items-center justify-between rounded-lg border border-line bg-surface-2/50 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(var(--${DOT[t.status]}))` }} />
              {STATUS_LABEL[t.status]}
            </span>
            <span className="tnum font-display text-lg font-semibold leading-none text-ink">{t.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
