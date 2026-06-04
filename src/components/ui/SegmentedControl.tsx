import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface Segment<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-1"
    >
      {segments.map((s) => {
        const active = s.value === value
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            className={cn(
              'relative rounded-lg font-semibold transition-colors duration-200',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink-soft',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${ariaLabel ?? 'x'}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-card"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
