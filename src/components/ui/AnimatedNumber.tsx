import { useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

interface Props {
  value: number | null
  format: (n: number | null) => string
  className?: string
}

/**
 * Buttery count-up: a spring (no overshoot) drives a motion value that renders
 * without React re-renders, so switching scope eases smoothly from the current
 * number to the next instead of restarting/flickering.
 */
export function AnimatedNumber({ value, format, className }: Props) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value ?? 0)
  const spring = useSpring(mv, { duration: 0.6, bounce: 0 })
  const text = useTransform(spring, (n) => format(n))

  useEffect(() => {
    if (value != null) mv.set(value)
  }, [value, mv])

  if (value == null) return <span className={className}>{format(null)}</span>
  if (reduce) return <span className={className}>{format(value)}</span>
  return <motion.span className={className}>{text}</motion.span>
}
