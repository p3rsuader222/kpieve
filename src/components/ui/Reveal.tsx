import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Lightweight staggered entrance using the CSS `fade-up` keyframes. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const style: CSSProperties = { animationDelay: `${delay}ms` }
  return (
    <div className={cn('animate-fade-up', className)} style={style}>
      {children}
    </div>
  )
}
