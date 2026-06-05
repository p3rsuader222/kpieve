import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme, type Theme } from '@/hooks/useTheme'

/** Small disc that previews a theme: background fill + accent ring. */
function Swatch({ bg, accent, className }: { bg: string; accent: string; className?: string }) {
  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ background: bg, boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.12), 0 0 0 2px ${accent}` }}
    />
  )
}

/**
 * Theme picker — replaces the old light/dark toggle in the same spot.
 * Instant, persisted (via useTheme), closes on outside-click / Escape,
 * and is keyboard navigable (Tab + Arrow keys, Enter/Space to choose).
 */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const active = themes.find((t) => t.id === theme) ?? themes[0]

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Focus the active item when the menu opens.
    const idx = themes.findIndex((t) => t.id === theme)
    requestAnimationFrame(() => itemRefs.current[idx >= 0 ? idx : 0]?.focus())
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, theme, themes])

  function choose(id: Theme) {
    setTheme(id)
    setOpen(false)
  }

  function onMenuKey(e: KeyboardEvent<HTMLDivElement>) {
    const last = themes.length - 1
    const i = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      itemRefs.current[i < last ? i + 1 : 0]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      itemRefs.current[i > 0 ? i - 1 : last]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      itemRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      itemRefs.current[last]?.focus()
    }
  }

  return (
    <div ref={wrapRef} className={cn('relative', compact ? 'inline-block' : 'w-full')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${active.label}. Change theme`}
        title={compact ? `Theme · ${active.label}` : undefined}
        className={cn(
          'flex items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
          compact ? 'h-9 w-9 justify-center text-base' : 'w-full gap-3 px-3 py-2 text-sm font-medium',
        )}
      >
        {compact ? (
          <span aria-hidden>{active.emoji}</span>
        ) : (
          <>
            <Swatch bg={active.themeColor} accent={active.accentColor} className="h-4 w-4" />
            <span className="flex-1 truncate text-left">{active.label}</span>
            <ChevronDown size={15} strokeWidth={2} className={cn('transition-transform', open && 'rotate-180')} />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose a theme"
          onKeyDown={onMenuKey}
          className={cn(
            'absolute z-50 w-60 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-pop',
            compact ? 'right-0 top-full mt-2' : 'bottom-full left-0 mb-2',
          )}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Theme
          </p>
          {themes.map((t, i) => {
            const selected = t.id === theme
            return (
              <button
                key={t.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => choose(t.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  selected ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Swatch bg={t.themeColor} accent={t.accentColor} className="h-5 w-5" />
                <span className="text-base leading-none" aria-hidden>
                  {t.emoji}
                </span>
                <span className="flex-1 truncate font-medium">{t.label}</span>
                {selected && <Check size={15} strokeWidth={2.5} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
