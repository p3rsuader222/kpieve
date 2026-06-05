import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { STATUS_VAR, type Status } from '@/lib/status'

// Apple-style deceleration: a long, soft ease-out (matches the `smooth` token).
const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const

interface Props {
  /** 0..1 (values >1 are clamped for the arc but can be shown in the label). */
  progress: number
  status: Status
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
  /** No data yet → render a neutral dashed ring instead of an empty 0% arc. */
  empty?: boolean
}

export function ProgressRing({ progress, status, size = 132, stroke = 11, label, sublabel, empty = false }: Props) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, progress))
  const offset = c * (1 - clamped)
  const labelSize = size >= 110 ? 'text-2xl' : size >= 84 ? 'text-base' : 'text-sm'

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={empty ? 'hsl(var(--line-strong))' : 'hsl(var(--surface-2))'}
          strokeWidth={empty ? 2 : stroke}
          strokeDasharray={empty ? '2 5' : undefined}
          strokeLinecap="round"
          opacity={empty ? 0.7 : 1}
        />
        {!empty && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={STATUS_VAR[status]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            // Fill in from empty on first paint, then ease smoothly between values.
            initial={reduce ? false : { strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={reduce ? { duration: 0 } : { duration: 1.4, ease: EASE_SMOOTH }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {label && <span className={cn('tnum font-display font-semibold leading-none text-ink', labelSize)}>{label}</span>}
        {sublabel && <span className="mt-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted">{sublabel}</span>}
      </div>
    </div>
  )
}
