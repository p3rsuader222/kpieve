import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  children?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon size={26} strokeWidth={2} />
      </div>
      <h3 className="mt-5 font-heading text-xl font-semibold text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-balance text-sm text-ink-muted">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
