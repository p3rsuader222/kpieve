import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Save, TrendingUp } from 'lucide-react'
import { forecastRows, prevPeriod } from '@/lib/metrics'
import { formatCompact } from '@/lib/format'
import type { DashboardData, Kpi } from '@/lib/types'
import { usingMockData, type TargetUpsert } from '@/data/datasource'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  kpi: Kpi
  /** The month we're forecasting onboarding completions for. */
  period: string
}

// Country | Potential (previous calendar month) | 3-month average | Target (editable)
const COLS = 'minmax(48px,1fr) 76px 76px 88px'

/**
 * Forecast for one KPI: per-country pipeline for `period`, plus an editable
 * Target column. The "potential" to onboard in `period` is how many reached
 * this KPI (e.g. 1st active offer) in the immediately preceding calendar month —
 * they typically finalize about a month later. The 3-month average is a
 * historical prediction. Targets save into the same per-country monthly targets
 * the Dashboard scores against (Settings edits the same rows).
 */
export function ForecastTable({ data, kpi, period }: Props) {
  const m = useConfigMutations()
  const toast = useToast()

  const rows = useMemo(() => forecastRows(data, kpi, period), [data, kpi, period])
  const marketRows = rows.filter((r) => r.market)
  const totalRow = rows.find((r) => !r.market)!

  // Editable targets, keyed by market id. Prefilled from the actual saved target
  // ROWS for the month (not the KPI default fallback) — the default shows as a
  // placeholder instead, so "not set yet" stays visible.
  const [targets, setTargets] = useState<Record<string, string>>({})
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const market of data.markets) {
      const row = data.targets.find(
        (t) => t.kpi_id === kpi.id && t.market_id === market.id && t.period === period,
      )
      next[market.id] = row ? String(row.value) : ''
    }
    setTargets(next)
  }, [data.markets, data.targets, kpi.id, period])

  const sourceMonth = prevPeriod(period)
  const sourceLabel = format(parseISO(sourceMonth), 'MMMM')
  const monthLabel = format(parseISO(period), 'MMMM')

  // Live total of the Target column: typed value where present, else the row's
  // effective target (saved or default) — summed for SUM KPIs, averaged for AVG.
  const totalTargetLive = useMemo(() => {
    const vals: number[] = []
    for (const r of marketRows) {
      const raw = targets[r.id]
      const typed = raw != null && raw.trim() !== '' ? Number(raw) : NaN
      const v = !Number.isNaN(typed) ? typed : r.target
      if (v != null) vals.push(v)
    }
    if (vals.length === 0) return null
    const sum = vals.reduce((s, v) => s + v, 0)
    return kpi.aggregation === 'sum' ? sum : sum / vals.length
  }, [marketRows, targets, kpi.aggregation])

  async function onSaveTargets() {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save targets.')
      return
    }
    const out: TargetUpsert[] = []
    for (const [market_id, raw] of Object.entries(targets)) {
      if (raw == null || raw.trim() === '') continue
      const num = Number(raw)
      if (Number.isNaN(num)) continue
      out.push({ kpi_id: kpi.id, market_id, period, value: num })
    }
    if (out.length === 0) {
      toast.info('Nothing to save yet.')
      return
    }
    try {
      await m.upsertTargets.mutateAsync(out)
      toast.success(`Saved ${out.length} target${out.length === 1 ? '' : 's'} for ${format(parseISO(period), 'MMMM yyyy')}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save targets.')
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow mb-0.5">Potential onboards · {monthLabel}</p>
          <h3 className="truncate font-heading text-base font-semibold text-ink" title={kpi.name}>
            {kpi.name}
          </h3>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onSaveTargets}
          disabled={m.upsertTargets.isPending}
          title={`Save this column as the official ${format(parseISO(period), 'MMMM yyyy')} targets`}
        >
          <Save size={14} />
          {m.upsertTargets.isPending ? 'Saving…' : 'Save targets'}
        </Button>
      </div>

      {/* Headline total */}
      <div className="mb-3 flex items-end justify-between gap-3 rounded-xl bg-brand-soft/50 px-3 py-2.5">
        <div className="leading-tight">
          <span className="tnum font-display text-3xl font-semibold text-ink">
            {formatCompact(totalRow.prevActual, kpi.format)}
          </span>
          <span className="ml-1.5 text-sm font-medium text-ink-muted">likely to onboard</span>
          <p className="mt-0.5 text-2xs text-ink-muted">from {sourceLabel}'s {kpi.name.toLowerCase()}</p>
        </div>
        {totalRow.avg3 != null && (
          <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-medium text-ink-muted">
            <TrendingUp size={12} className="text-brand" />~{formatCompact(totalRow.avg3, kpi.format)} avg
          </span>
        )}
      </div>

      {/* Per-country breakdown */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div
          className="grid items-center gap-2 border-b border-line bg-surface-2/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted"
          style={{ gridTemplateColumns: COLS }}
        >
          <span>Country</span>
          <span className="whitespace-nowrap text-right text-brand-ink">Potential</span>
          <span className="whitespace-nowrap text-right">3-mo avg</span>
          {/* pr matches the input's inner inset so the header edge meets the digits. */}
          <span className="whitespace-nowrap pr-2.5 text-right">Target</span>
        </div>
        <div className="divide-y divide-line">
          {marketRows.map((r) => (
            <div key={r.id} className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: COLS }}>
              <span className="flex items-center gap-2">
                <Flag code={r.code} size={18} />
                <span className="text-sm font-medium text-ink">{r.code}</span>
              </span>
              <span className="tnum text-right text-base font-semibold text-ink">
                {formatCompact(r.prevActual, kpi.format)}
              </span>
              <span className="tnum text-right text-sm text-ink-soft">{formatCompact(r.avg3, kpi.format)}</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={targets[r.id] ?? ''}
                onChange={(e) => setTargets((v) => ({ ...v, [r.id]: e.target.value }))}
                placeholder={r.target != null ? formatCompact(r.target, kpi.format) : '—'}
                aria-label={`${r.code} target for ${monthLabel}`}
                className="tnum h-8 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm font-semibold text-ink placeholder:text-ink-muted/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </div>
          ))}
          <div
            className="grid items-center gap-2 border-t-2 border-line-strong px-3 py-2.5"
            style={{ gridTemplateColumns: COLS }}
          >
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="tnum text-right text-base font-semibold text-ink">
              {formatCompact(totalRow.prevActual, kpi.format)}
            </span>
            <span className="tnum text-right text-sm text-ink-soft">{formatCompact(totalRow.avg3, kpi.format)}</span>
            <span className="tnum pr-2.5 text-right text-sm font-semibold text-ink">
              {totalTargetLive != null ? formatCompact(totalTargetLive, kpi.format) : '—'}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-2xs text-ink-muted">
        <strong className="font-semibold text-ink-soft">Target</strong> is the official goal for {monthLabel} — saving
        writes the same per-country monthly targets the Dashboard scores against. Blank cells are skipped.
      </p>
    </div>
  )
}
