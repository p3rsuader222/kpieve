import { cn } from '@/lib/cn'
import type { Kpi } from '@/lib/types'

interface Props {
  kpis: Kpi[]
  selectedIds: string[]
  /** Single mode: switch to this KPI. Multi mode: toggle it. */
  onSelect: (id: string) => void
  multi?: boolean
  ariaLabel: string
}

/**
 * The shared KPI selector: a vertical rail on lg+ screens (grouped
 * Core / Additional), collapsing to wrapped chips on narrow ones.
 */
export function KpiRail({ kpis, selectedIds, onSelect, multi = false, ariaLabel }: Props) {
  const mandatory = kpis.filter((k) => !k.additional)
  const additional = kpis.filter((k) => k.additional)

  return (
    <nav
      aria-label={ariaLabel}
      className="flex flex-row flex-wrap gap-1.5 rounded-xl border border-line bg-surface-2/40 p-1.5 lg:w-44 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:self-start"
    >
      {mandatory.map((k) => (
        <RailButton key={k.id} kpi={k} selected={selectedIds.includes(k.id)} multi={multi} onSelect={onSelect} />
      ))}
      {additional.length > 0 && (
        <>
          <span className="hidden px-3 pb-0.5 pt-2 text-2xs font-semibold uppercase tracking-wider text-ink-muted lg:block">
            Additional
          </span>
          {additional.map((k) => (
            <RailButton key={k.id} kpi={k} selected={selectedIds.includes(k.id)} multi={multi} onSelect={onSelect} />
          ))}
        </>
      )}
    </nav>
  )
}

function RailButton({
  kpi,
  selected,
  multi,
  onSelect,
}: {
  kpi: Kpi
  selected: boolean
  multi: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(kpi.id)}
      role={multi ? 'checkbox' : 'tab'}
      aria-checked={multi ? selected : undefined}
      aria-selected={multi ? undefined : selected}
      title={kpi.additional ? `${kpi.name} — additional (non-mandatory)` : kpi.name}
      className={cn(
        'rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-colors lg:w-full',
        selected
          ? 'bg-brand text-brand-contrast shadow-card'
          : 'text-ink-muted hover:bg-surface hover:text-ink',
      )}
    >
      {kpi.name}
    </button>
  )
}
