import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { formatCompact, formatPercent } from '@/lib/format'
import { activeKpis, countryMatrix, type MatrixCell } from '@/lib/metrics'
import { STATUS_TEXT, type Status } from '@/lib/status'
import type { DashboardData } from '@/lib/types'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  period: string
  /** Selected market id, or null for TOTAL. */
  selected: string | null
  onSelect: (marketId: string | null) => void
}

const STATUS_BAR: Record<Status, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  none: 'bg-line-strong',
}

function Cell({ cell, format }: { cell: MatrixCell; format: ReturnType<typeof activeKpis>[number]['format'] }) {
  const pct = cell.attainment != null ? Math.max(0, Math.min(1, cell.attainment)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <span className="tnum text-sm font-semibold text-ink">{formatCompact(cell.fact, format)}</span>
        <span className="tnum text-2xs text-ink-muted">/ {formatCompact(cell.target, format)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span
            className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', STATUS_BAR[cell.status])}
            style={{ width: `${pct * 100}%` }}
          />
        </span>
        <span className={cn('tnum w-9 text-right text-2xs font-semibold', STATUS_TEXT[cell.status])}>
          {cell.attainment != null ? formatPercent(cell.attainment) : '—'}
        </span>
      </div>
    </div>
  )
}

export function CountryMatrix({ data, period, selected, onSelect }: Props) {
  const kpis = activeKpis(data)
  const rows = useMemo(() => countryMatrix(data, period), [data, period])
  const cols = `minmax(112px, 0.85fr) repeat(${kpis.length}, minmax(98px, 1fr))`

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[660px]">
        {/* Header */}
        <div
          className="grid items-end gap-3 border-b border-line px-3 pb-3"
          style={{ gridTemplateColumns: cols }}
        >
          <span className="eyebrow">Country</span>
          {kpis.map((k) => (
            <span
              key={k.id}
              title={k.name}
              className="text-2xs font-semibold uppercase leading-tight tracking-wider text-ink-muted"
            >
              {k.name}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="mt-1 space-y-1">
          {rows.map((row) => {
            const isTotal = row.market == null
            const isSelected = (row.market?.id ?? null) === selected
            const focused = selected !== null
            return (
              <button
                key={row.id}
                onClick={() => onSelect(row.market?.id ?? null)}
                aria-pressed={isSelected}
                className={cn(
                  'relative grid w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                  isSelected
                    ? 'border-brand bg-brand-soft shadow-card ring-2 ring-brand/25'
                    : cn('border-transparent hover:bg-surface-2', focused && 'opacity-45 hover:opacity-100'),
                  isTotal && !isSelected && 'border-line bg-surface-2/40',
                )}
                style={{ gridTemplateColumns: cols }}
              >
                {isSelected && (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand" aria-hidden="true" />
                )}
                <div className="flex items-center gap-2.5">
                  {isTotal ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink font-display text-2xs font-bold tracking-wide text-paper">
                      ALL
                    </span>
                  ) : (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-surface">
                      <Flag code={row.code} size={24} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                    <p className="tnum text-2xs text-ink-muted">
                      {row.adherence != null ? `${formatPercent(row.adherence)} on track` : 'No target'}
                    </p>
                  </div>
                </div>
                {kpis.map((k) => (
                  <Cell key={k.id} cell={row.cells[k.id]} format={k.format} />
                ))}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
