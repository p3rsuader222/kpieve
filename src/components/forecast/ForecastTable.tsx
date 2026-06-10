import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingUp } from 'lucide-react'
import { forecastRows, prevPeriod } from '@/lib/metrics'
import { formatCompact } from '@/lib/format'
import type { DashboardData, Kpi } from '@/lib/types'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  kpi: Kpi
  /** The month we're forecasting onboarding completions for. */
  period: string
}

// Country | Potential (previous calendar month) | 3-month average
const COLS = 'minmax(56px,1fr) 96px 96px'

/**
 * Read-only forecast for one KPI: per-country pipeline for `period`.
 * The "potential" to onboard in `period` is how many reached this KPI
 * (e.g. 1st active offer) in the immediately preceding calendar month — they typically
 * finalize about a month later. The 3-month average is a historical prediction.
 */
export function ForecastTable({ data, kpi, period }: Props) {
  const rows = useMemo(() => forecastRows(data, kpi, period), [data, kpi, period])
  const marketRows = rows.filter((r) => r.market)
  const totalRow = rows.find((r) => !r.market)!

  const sourceMonth = prevPeriod(period)
  const sourceLabel = format(parseISO(sourceMonth), 'MMMM')
  const monthLabel = format(parseISO(period), 'MMMM')

  return (
    <div className="card p-4">
      <div className="mb-3">
        <p className="eyebrow mb-0.5">Potential onboards · {monthLabel}</p>
        <h3 className="truncate font-heading text-base font-semibold text-ink" title={kpi.name}>
          {kpi.name}
        </h3>
      </div>

      {/* Headline total */}
      <div className="mb-3 flex items-end justify-between gap-3 rounded-xl bg-brand-soft/50 px-3 py-2.5">
        <div className="leading-tight">
          <span className="tnum font-display text-3xl font-semibold text-ink">
            {formatCompact(totalRow.prevActual, kpi.format)}
          </span>
          <span className="ml-1.5 text-sm font-medium text-ink-muted">likely to onboard</span>
          <p className="mt-0.5 text-2xs text-ink-muted">from {sourceLabel}'s {kpi.name.toLowerCase()}</p>
        </div>
        {totalRow.avg3 != null && (
          <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-medium text-ink-muted">
            <TrendingUp size={12} className="text-brand" />~{formatCompact(totalRow.avg3, kpi.format)} avg
          </span>
        )}
      </div>

      {/* Per-country breakdown */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div
          className="grid items-center gap-2 border-b border-line bg-surface-2/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted"
          style={{ gridTemplateColumns: COLS }}
        >
          <span>Country</span>
          <span className="text-right text-brand-ink">Potential</span>
          <span className="text-right">3-mo avg</span>
        </div>
        <div className="divide-y divide-line">
          {marketRows.map((r) => (
            <div key={r.id} className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: COLS }}>
              <span className="flex items-center gap-2">
                <Flag code={r.code} size={18} />
                <span className="text-sm font-medium text-ink">{r.code}</span>
              </span>
              <span className="tnum text-right text-base font-semibold text-ink">
                {formatCompact(r.prevActual, kpi.format)}
              </span>
              <span className="tnum text-right text-sm text-ink-soft">{formatCompact(r.avg3, kpi.format)}</span>
            </div>
          ))}
          <div
            className="grid items-center gap-2 border-t-2 border-line-strong px-3 py-2.5"
            style={{ gridTemplateColumns: COLS }}
          >
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="tnum text-right text-base font-semibold text-ink">
              {formatCompact(totalRow.prevActual, kpi.format)}
            </span>
            <span className="tnum text-right text-sm text-ink-soft">{formatCompact(totalRow.avg3, kpi.format)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
