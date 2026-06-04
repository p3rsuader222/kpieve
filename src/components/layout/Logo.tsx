export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="8" fill="hsl(var(--brand))" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="hsl(var(--brand-contrast))" strokeOpacity="0.28" strokeWidth="3" />
        <path d="M16 7 a9 9 0 0 1 7.8 13.5" fill="none" stroke="hsl(var(--brand-contrast))" strokeWidth="3" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2.4" fill="hsl(var(--brand-contrast))" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight text-ink">
        KPI<span className="text-brand">eve</span>
      </span>
    </span>
  )
}
