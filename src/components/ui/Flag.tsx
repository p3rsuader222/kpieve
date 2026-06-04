import { useId } from 'react'
import { cn } from '@/lib/cn'

interface Stripe {
  c: string
  o: number // y offset in a 14-tall viewBox
  h: number // height
}

// Horizontal-stripe flags for the four markets (drawn in a 20×14 box).
const STRIPES: Record<string, Stripe[]> = {
  LT: [
    { c: '#FDB913', o: 0, h: 4.67 },
    { c: '#006A44', o: 4.67, h: 4.67 },
    { c: '#C1272D', o: 9.33, h: 4.67 },
  ],
  LV: [
    { c: '#9E3039', o: 0, h: 6 },
    { c: '#FFFFFF', o: 6, h: 2 },
    { c: '#9E3039', o: 8, h: 6 },
  ],
  EE: [
    { c: '#0072CE', o: 0, h: 4.67 },
    { c: '#101010', o: 4.67, h: 4.67 },
    { c: '#FFFFFF', o: 9.33, h: 4.67 },
  ],
  PL: [
    { c: '#FFFFFF', o: 0, h: 7 },
    { c: '#DC143C', o: 7, h: 7 },
  ],
}

interface Props {
  /** Market code: LT · LV · EE · PL. Unknown codes render an empty rounded tile. */
  code: string
  size?: number // width in px (height keeps the 10:7 ratio)
  className?: string
  /** Stretch the stripes to fill the parent (for use as a faded background band). */
  fill?: boolean
}

/** Small, crisp national flag for a market code. */
export function Flag({ code, size = 20, className, fill = false }: Props) {
  const id = useId()
  const stripes = STRIPES[code.toUpperCase()] ?? []
  const w = size
  const h = Math.round((size * 14) / 20)

  if (fill) {
    return (
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 20 14"
        preserveAspectRatio="none"
        className={cn(className)}
        aria-hidden="true"
      >
        {stripes.map((s, i) => (
          <rect key={i} x="0" y={s.o} width="20" height={s.h} fill={s.c} />
        ))}
      </svg>
    )
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 20 14"
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`${code} flag`}
    >
      <clipPath id={`f-${id}`}>
        <rect width="20" height="14" rx="2.5" />
      </clipPath>
      <g clipPath={`url(#f-${id})`}>
        {stripes.length ? (
          stripes.map((s, i) => <rect key={i} x="0" y={s.o} width="20" height={s.h} fill={s.c} />)
        ) : (
          <rect width="20" height="14" fill="hsl(var(--surface-2))" />
        )}
      </g>
      <rect width="20" height="14" rx="2.5" fill="none" stroke="hsl(var(--line-strong))" strokeWidth="0.75" />
    </svg>
  )
}
