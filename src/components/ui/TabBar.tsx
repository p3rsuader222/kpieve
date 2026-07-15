import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  /** Optional count chip after the label (e.g. number of KPIs). */
  count?: number
}

interface Props<T extends string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
}

/**
 * Underline tab bar for page subsections (Settings etc.) — distinct from
 * SegmentedControl, which switches views of the SAME content. Full tablist
 * semantics: roving tabindex, arrow-key/Home/End navigation, and panels
 * linked via `tabPanelProps(id)` on the consumer side.
 */
export function TabBar<T extends string>({ tabs, value, onChange, ariaLabel }: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next == null) return
    e.preventDefault()
    onChange(tabs[next].id)
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  return (
    <div ref={listRef} role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t, i) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            id={tabId(t.id)}
            role="tab"
            aria-selected={active}
            aria-controls={panelId(t.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative -mb-px inline-flex items-center gap-1.5 rounded-t-lg px-3.5 pb-2.5 pt-2 text-sm font-semibold transition-colors',
              active ? 'text-ink' : 'text-ink-muted hover:bg-surface-2/60 hover:text-ink',
            )}
          >
            {t.icon && <span className={cn('shrink-0', active ? 'text-brand' : 'text-ink-muted')}>{t.icon}</span>}
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 py-px text-2xs font-semibold',
                  active ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2 text-ink-muted',
                )}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tabbar-${ariaLabel}`}
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

const tabId = (id: string) => `tab-${id}`
const panelId = (id: string) => `tabpanel-${id}`

/** Spread onto the container that holds a tab's content. */
export function tabPanelProps(id: string) {
  return { role: 'tabpanel' as const, id: panelId(id), 'aria-labelledby': tabId(id) }
}
