import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Save } from 'lucide-react'
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

  const rows = useMemo<TargetUpsert[]>(() => {
    const out: TargetUpsert[] = []
    for (const [key, raw] of Object.entries(values)) {
      if (raw == null || raw.trim() === '') continue
      const num = Number(raw)
      if (Number.isNaN(num)) continue
      const [kpi_id, market_id] = key.split(':')
      out.push({ kpi_id, market_id, period, value: num })
    }
    return out
  }, [values, period])

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
        <Button variant="primary" size="md" onClick={() => onSave(rows)} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving…' : 'Save targets'}
        </Button>
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
        Targets are stored per country and month. Leaving a cell blank skips it (the KPI's default target applies).
      </p>
    </div>
  )
}
