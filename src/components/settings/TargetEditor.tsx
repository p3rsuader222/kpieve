import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarRange, ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react'
import { activeKpis } from '@/lib/metrics'
import type { DashboardData } from '@/lib/types'
import type { TargetUpsert } from '@/data/datasource'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'

/** Shift a `yyyy-MM` string by whole months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return format(new Date(y, m - 1 + delta, 1), 'yyyy-MM')
}

interface Props {
  data: DashboardData
  saving: boolean
  deleting: boolean
  onSave: (rows: TargetUpsert[]) => void
  onDelete: (period: string) => void
}

const keyOf = (kpiId: string, marketId: string) => `${kpiId}:${marketId}`

/** A KPI × country grid of editable monthly targets. */
export function TargetEditor({ data, saving, deleting, onSave, onDelete }: Props) {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const period = `${month}-01`
  const [values, setValues] = useState<Record<string, string>>({})

  const kpis = activeKpis(data)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)

  // Prefill from the actual saved target ROWS for the chosen month (not the KPI
  // default fallback) — so after "Delete month" the grid shows empty, making the
  // deletion visible instead of silently re-showing default targets.
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const kpi of kpis) {
      for (const market of markets) {
        const row = data.targets.find(
          (t) => t.kpi_id === kpi.id && t.market_id === market.id && t.period === period,
        )
        next[keyOf(kpi.id, market.id)] = row ? String(row.value) : ''
      }
    }
    setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, period])

  const year = month.slice(0, 4)

  // Build target rows for an arbitrary set of months from the current grid.
  function rowsForPeriods(periods: string[]): TargetUpsert[] {
    const out: TargetUpsert[] = []
    for (const [key, raw] of Object.entries(values)) {
      if (raw == null || raw.trim() === '') continue
      const num = Number(raw)
      if (Number.isNaN(num)) continue
      const [kpi_id, market_id] = key.split(':')
      for (const p of periods) out.push({ kpi_id, market_id, period: p, value: num })
    }
    return out
  }

  // Every month from the selected one through December of the same year.
  const monthsToDec = useMemo(() => {
    const y = Number(month.slice(0, 4))
    const m = Number(month.slice(5, 7))
    const out: string[] = []
    for (let mm = m; mm <= 12; mm++) out.push(`${y}-${String(mm).padStart(2, '0')}-01`)
    return out
  }, [month])

  const rows = useMemo(() => rowsForPeriods([period]), [values, period]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed compact columns so single-number inputs never stretch across the page.
  const cols = `minmax(200px, 280px) repeat(${markets.length}, 92px)`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Month</span>
          <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-1">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Previous month"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft size={17} strokeWidth={2.2} />
            </button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="tnum h-8 border-0 bg-transparent px-1 text-sm font-medium text-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Next month"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(period)}
            disabled={deleting || saving}
            title={`Delete all targets for ${format(new Date(period), 'MMMM yyyy')}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-bad-soft hover:text-bad disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 size={16} />
            {deleting ? 'Deleting…' : 'Delete month'}
          </button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onSave(rowsForPeriods(monthsToDec))}
            disabled={saving}
            title={`Apply this grid to every month from ${format(new Date(period), 'MMM')} through December ${year}`}
          >
            <CalendarRange size={16} />
            Fill to Dec {year}
          </Button>
          <Button variant="primary" size="md" onClick={() => onSave(rows)} disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving…' : 'Save month'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          <div className="grid items-end gap-2 border-b border-line pb-2.5" style={{ gridTemplateColumns: cols }}>
            <span className="eyebrow self-end">KPI</span>
            {markets.map((m) => (
              <div key={m.id} className="flex flex-col items-center gap-1">
                <Flag code={m.code} size={22} />
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">{m.code}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="grid items-center gap-2" style={{ gridTemplateColumns: cols }}>
                <span className="truncate text-sm font-medium text-ink" title={kpi.name}>
                  {kpi.name}
                </span>
                {markets.map((market) => {
                  const k = keyOf(kpi.id, market.id)
                  return (
                    <input
                      key={market.id}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={values[k] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                      className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-2xs text-ink-muted">
        Targets are stored per country and month. <strong className="font-semibold text-ink-soft">Save month</strong> writes
        just {format(new Date(period), 'MMMM yyyy')}; <strong className="font-semibold text-ink-soft">Fill to Dec {year}</strong> copies
        this grid to every remaining month of the year (you can then fine-tune any month). Blank cells are skipped.
      </p>
    </div>
  )
}
