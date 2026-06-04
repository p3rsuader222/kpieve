import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number | null
  format: (n: number | null) => string
  /** ms */
  duration?: number
  className?: string
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** Counts up to `value` on mount / change, then renders via `format`. */
export function AnimatedNumber({ value, format, duration = 520, className }: Props) {
  const [display, setDisplay] = useState<number | null>(value)
  const fromRef = useRef(0)
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (value == null) {
      setDisplay(null)
      return
    }
    if (reduce) {
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const v = from + (value - from) * easeOut(t)
      setDisplay(v)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, reduce])

  return <span className={className}>{format(display)}</span>
}
