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
  const ringLabel = attainment != null ? formatPercent(attainment) : '—'
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <article className="card group relative flex flex-col gap-4 p-5 transition-shadow duration-300 hover:shadow-card-hover">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{kpi.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xs font-medium text-ink-muted">
            <StatusDot status={status} />
            {STATUS_LABEL[status]}
          </p>
        </div>
        {target != null && (
          <span className="chip shrink-0">
            Target {formatValue(target, kpi)}
          </span>
        )}
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <AnimatedNumber
            value={value}
            format={(n) => formatValue(n, kpi)}
            className="tnum block font-display text-[2.6rem] font-semibold leading-none tracking-tight text-ink"
          />
          {delta != null && (
            <span
              className={cn(
                'mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                delta === 0
                  ? 'bg-surface-2 text-ink-muted'
                  : deltaGood
                    ? 'bg-good-soft text-good'
                    : 'bg-bad-soft text-bad',
              )}
            >
              <DeltaIcon size={13} strokeWidth={2.5} />
              <span className="tnum">{formatDelta(delta, kpi)}</span>
              <span className="font-medium opacity-70">vs last mo</span>
            </span>
          )}
        </div>
        <ProgressRing progress={attainment ?? 0} status={status} size={104} stroke={9} label={ringLabel} sublabel="of target" />
      </div>

      <div className="mt-auto">
        <Sparkline data={spark} status={status} height={42} />
      </div>
    </article>
  )
}
