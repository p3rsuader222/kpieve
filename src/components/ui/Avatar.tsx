import { cn } from '@/lib/cn'

interface Props {
  initials: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-7 w-7 text-2xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
}

/** Tinted initials chip — uses the member's brand color at low alpha. */
export function Avatar({ initials, color, size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight ring-1 ring-inset',
        sizeMap[size],
        className,
      )}
      style={{
        color,
        backgroundColor: `${color}1f`,
        // ring color via boxShadow-like ring using currentColor at low alpha
        boxShadow: `inset 0 0 0 1px ${color}33`,
      }}
    >
      {initials}
    </span>
  )
}
