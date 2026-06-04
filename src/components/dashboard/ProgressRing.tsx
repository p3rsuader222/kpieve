import { useEffect, useState } from 'react'
import { STATUS_VAR, type Status } from '@/lib/status'

interface Props {
  /** 0..1 (values >1 are clamped for the arc but can be shown in the label). */
  progress: number
  status: Status
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
}

export function ProgressRing({ progress, status, size = 132, stroke = 11, label, sublabel }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, progress))
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(clamped))
    return () => cancelAnimationFrame(t)
  }, [clamped])

  const offset = c * (1 - shown)

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STATUS_VAR[status]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {label && <span className="tnum font-display text-2xl font-semibold leading-none text-ink">{label}</span>}
        {sublabel && <span className="mt-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted">{sublabel}</span>}
      </div>
    </div>
  )
}
