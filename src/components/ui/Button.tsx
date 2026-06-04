import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ease-smooth disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-contrast shadow-card hover:shadow-card-hover hover:brightness-110 active:brightness-95',
  secondary:
    'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:bg-surface-2',
  ghost: 'text-ink-soft hover:bg-surface-2 hover:text-ink',
  subtle: 'bg-surface-2 text-ink-soft hover:text-ink hover:bg-line',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
}

/** Shared classes so links (e.g. react-router <Link>) can look like buttons. */
export function buttonClasses(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, ...props },
  ref,
) {
  return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />
})
