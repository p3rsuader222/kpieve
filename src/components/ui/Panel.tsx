import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  title?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function Panel({ title, eyebrow, actions, children, className, bodyClassName }: Props) {
  return (
    <section className={cn('card flex flex-col p-5', className)}>
      {(title || actions || eyebrow) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="font-display text-lg font-semibold leading-tight text-ink">{title}</h2>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}
