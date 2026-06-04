export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="hsl(var(--brand))" />
        <path d="M7.5 13 a8.5 8.5 0 0 0 17 0 Z" fill="hsl(var(--brand-contrast))" />
        <circle cx="11" cy="24.5" r="2" fill="hsl(var(--brand-contrast))" />
        <circle cx="21" cy="24.5" r="2" fill="hsl(var(--brand-contrast))" />
        <circle cx="23" cy="8.5" r="2.6" fill="hsl(var(--accent))" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-ink">
        KPI<span className="text-brand">eve</span>
      </span>
    </span>
  )
}
