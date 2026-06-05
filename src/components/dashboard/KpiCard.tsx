import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDelta, formatPercent, formatValue } from '@/lib/format'
import type { KpiSnapshot } from '@/lib/metrics'
import { STATUS_LABEL } from '@/lib/status'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { StatusDot } from '@/components/ui/Status'
import { ProgressRing } from './ProgressRing'
import { Sparkline } from './Sparkline'

export function KpiCard({ snap }: { snap: KpiSnapshot }) {
  const { kpi, value, target, attainment, status, delta, deltaGood, spark } = snap
  const noData = value == null
  const ringLabel = attainment != null ? formatPercent(attainment) : '—'
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <article className="card group relative flex flex-col gap-2 p-3 transition-shadow duration-300 hover:shadow-card-hover">
      <header className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-ink" title={kpi.name}>
          {kpi.name}
        </h3>
        <p className="mt-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-2xs font-medium text-ink-muted">
            <StatusDot status={status} />
            {noData ? 'No data yet' : STATUS_LABEL[status]}
          </span>
          {target != null && (
            <span className="tnum text-2xs font-semibold text-ink-muted">
              / {formatValue(target, kpi)}
            </span>
          )}
        </p>
      </header>

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <AnimatedNumber
            value={value}
            format={(n) => formatValue(n, kpi)}
            className="tnum block truncate font-display text-[2rem] font-semibold leading-none tracking-tight text-ink"
          />
          {delta != null && (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-semibold',
                delta === 0
                  ? 'bg-surface-2 text-ink-muted'
                  : deltaGood
                    ? 'bg-good-soft text-good'
                    : 'bg-bad-soft text-bad',
              )}
            >
              <DeltaIcon size={11} strokeWidth={2.5} />
              <span className="tnum">{formatDelta(delta, kpi)}</span>
            </span>
          )}
        </div>
        <div className="shrink-0">
          <ProgressRing progress={attainment ?? 0} status={status} size={68} stroke={7} label={ringLabel} empty={noData} />
        </div>
      </div>

      <div className="mt-auto">
        <Sparkline data={spark} status={status} height={26} />
      </div>
    </article>
  )
}
