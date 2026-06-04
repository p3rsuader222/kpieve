import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  period: string // month start yyyy-MM-01
  onChange: (period: string) => void
  /** Available periods present in the data (ascending). Arrows beyond the range stay enabled but jump to empty months. */
  periods?: string[]
  /** Disallow stepping past the newest period (no future months). */
  clampFuture?: boolean
}

function shift(period: string, months: number): string {
  const d = parseISO(period)
  d.setMonth(d.getMonth() + months)
  return format(d, 'yyyy-MM-01')
}

export function MonthNav({ period, onChange, periods, clampFuture = true }: Props) {
  const newest = periods && periods.length ? periods[periods.length - 1] : undefined
  const next = shift(period, 1)
  const nextDisabled = clampFuture && newest ? next > newest : false

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
      <button
        onClick={() => onChange(shift(period, -1))}
        aria-label="Previous month"
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <ChevronLeft size={17} strokeWidth={2.2} />
      </button>
      <span className="min-w-[8.5rem] text-center font-display text-sm font-semibold text-ink">
        {format(parseISO(period), 'MMMM yyyy')}
      </span>
      <button
        onClick={() => !nextDisabled && onChange(next)}
        disabled={nextDisabled}
        aria-label="Next month"
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg transition-colors',
          nextDisabled
            ? 'cursor-not-allowed text-ink-muted/40'
            : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        <ChevronRight size={17} strokeWidth={2.2} />
      </button>
    </div>
  )
}
