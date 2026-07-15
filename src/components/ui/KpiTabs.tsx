import { useRef, type KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import type { Kpi } from '@/lib/types'

interface Props {
  kpis: Kpi[]
  selectedIds: string[]
  /** Single mode: switch to this KPI. Multi mode: toggle it. */
  onSelect: (id: string) => void
  multi?: boolean
  ariaLabel: string
}

/**
 * KPI selector in the same underline-tab language as the Settings sections,
 * one notch more prominent (it drives the page's main content). Mandatory
 * KPIs come first, additional ones after a divider. In multi mode several
 * tabs can be active at once (checkbox semantics, no sliding indicator).
 */
export function KpiTabs({ kpis, selectedIds, onSelect, multi = false, ariaLabel }: Props) {
  const mandatory = kpis.filter((k) => !k.additional)
  const additional = kpis.filter((k) => k.additional)
  const ordered = [...mandatory, ...additional]
  const listRef = useRef<HTMLDivElement>(null)

  // Single mode: arrows move the selection (roving tabindex). Multi mode:
  // arrows only move focus — Space/Enter toggles, like any checkbox group.
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % ordered.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + ordered.length) % ordered.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = ordered.length - 1
    if (next == null) return
    e.preventDefault()
    if (!multi) onSelect(ordered[next].id)
    listRef.current?.querySelectorAll('button')[next]?.focus()
  }

  function renderTab(k: Kpi) {
    const active = selectedIds.includes(k.id)
    return (
      <button
        key={k.id}
        role={multi ? 'checkbox' : 'tab'}
        aria-checked={multi ? active : undefined}
        aria-selected={multi ? undefined : active}
        tabIndex={multi || active ? 0 : -1}
        title={k.additional ? `${k.name} — additional (non-mandatory)` : k.name}
        onClick={() => onSelect(k.id)}
        onKeyDown={(e) => onKeyDown(e, ordered.indexOf(k))}
        className={cn(
          'relative -mb-px inline-flex items-center rounded-t-lg px-4 pb-3 pt-2.5 text-[0.9375rem] font-semibold transition-colors',
          active ? 'text-ink' : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink',
        )}
      >
        {k.name}
        {active &&
          (multi ? (
            <span className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-brand" />
          ) : (
            <motion.span
              layoutId={`kpitabs-${ariaLabel}`}
              className="absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-brand"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          ))}
      </button>
    )
  }

  return (
    <div
      ref={listRef}
      role={multi ? 'group' : 'tablist'}
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 border-b border-line"
    >
      {mandatory.map(renderTab)}
      {additional.length > 0 && (
        <>
          <span aria-hidden className="mx-1 h-5 w-px self-center bg-line-strong" />
          <span className="self-center px-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted">
            Additional
          </span>
          {additional.map(renderTab)}
        </>
      )}
    </div>
  )
}
