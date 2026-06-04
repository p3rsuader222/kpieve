import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'
import { formatValue } from '@/lib/format'
import { STATUS_VAR, type Status } from '@/lib/status'
import type { Kpi } from '@/lib/types'
import { Flag } from '@/components/ui/Flag'

export interface BreakdownItem {
  id: string
  label: string
  sublabel?: string
  color?: string
  /** Market code → renders a flag chip before the label. */
  flag?: string
  value: number | null
  target: number | null
  attainment: number | null
  status: Status
}

export function BreakdownList({ items, kpi }: { items: BreakdownItem[]; kpi: Kpi }) {
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => {
        const pct = Math.max(0, Math.min(1, it.attainment ?? 0))
        const over = (it.attainment ?? 0) > 1
        return (
          <li key={it.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-2">
              {it.flag && <Flag code={it.flag} size={18} />}
              {it.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />}
              <span className="text-sm font-semibold text-ink">{it.label}</span>
              {it.sublabel && <span className="text-2xs text-ink-muted">{it.sublabel}</span>}
            </div>
            <span className="tnum justify-self-end text-sm font-semibold text-ink">
              {formatValue(it.value, kpi)}
            </span>
            <span className="col-span-3 flex items-center gap-2">
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.span
                  className={cn('absolute inset-y-0 left-0 rounded-full')}
                  style={{ background: STATUS_VAR[it.status] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: i * 0.04 }}
                />
                {/* target marker at 100% */}
                <span className="absolute inset-y-0 right-0 w-px bg-line-strong" />
              </span>
              <span className="tnum w-10 shrink-0 text-right text-2xs font-semibold text-ink-muted">
                {it.attainment != null ? `${Math.round(it.attainment * 100)}%` : '—'}
                {over && <span className="text-good">↑</span>}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
