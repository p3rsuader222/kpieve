import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, className, id, ...props },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={cn(
          'h-10 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink',
          'placeholder:text-ink-muted/70 transition-colors',
          'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
          'disabled:opacity-60',
          className,
        )}
        {...props}
      />
      {hint && <span className="mt-1 block text-2xs text-ink-muted">{hint}</span>}
    </label>
  )
})
