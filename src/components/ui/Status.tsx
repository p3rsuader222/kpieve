import { cn } from '@/lib/cn'
import { STATUS_LABEL, STATUS_SOFT_BG, STATUS_TEXT, type Status } from '@/lib/status'

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  const color =
    status === 'good' ? 'bg-good' : status === 'warn' ? 'bg-warn' : status === 'bad' ? 'bg-bad' : 'bg-ink-muted'
  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      {status !== 'none' && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-40', color)} />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  )
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider',
        STATUS_SOFT_BG[status],
        STATUS_TEXT[status],
        className,
      )}
    >
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </span>
  )
}
