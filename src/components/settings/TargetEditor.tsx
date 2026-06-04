import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarRange, Save } from 'lucide-react'
import { activeKpis, periodTarget } from '@/lib/metrics'
import type { DashboardData } from '@/lib/types'
import type { TargetUpsert } from '@/data/datasource'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  saving: boolean
  onSave: (rows: TargetUpsert[]) => void
}

const keyOf = (kpiId: string, marketId: string) => `${kpiId}:${marketId}`

/** A KPI × country grid of editable monthly targets. */
export function TargetEditor({ data, saving, onSave }: Props) {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const period = `${month}-01`
  const [values, setValues] = useState<Record<string, string>>({})

  const kpis = activeKpis(data)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)

  // Prefill from existing targets for the chosen month.
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const kpi of kpis) {
      for (const market of markets) {
        const t = periodTarget(data, kpi.id, market.id, period)
        next[keyOf(kpi.id, market.id)] = t != null ? String(t) : ''
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

  const cols = `minmax(150px, 1.8fr) repeat(${markets.length}, minmax(72px, 1fr))`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <div className="flex items-center gap-2">
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
              <div key={m.id} className="flex flex-col items-start gap-1">
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
                      className="tnum h-9 w-full rounded-lg border border-line bg-surface px-3 text-left text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
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
