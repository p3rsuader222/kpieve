import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, className, ...props },
  ref,
) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-10 w-full appearance-none rounded-xl border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink',
            'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30',
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      </div>
    </label>
  )
})
