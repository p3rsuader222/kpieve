import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import { forecastRows, type ForecastRow } from '@/lib/metrics'
import { formatCompact, formatValue } from '@/lib/format'
import { STATUS_LABEL, statusOf, type Status } from '@/lib/status'
import type { DashboardData, Kpi } from '@/lib/types'
import type { ForecastUpsert } from '@/data/datasource'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'
import { StatusBadge, StatusDot } from '@/components/ui/Status'

interface Props {
  data: DashboardData
  kpi: Kpi
  period: string // forecast month start (yyyy-MM-01)
  saving: boolean
  onSave: (rows: ForecastUpsert[]) => void
}

/** Parse a text input to a number, treating blanks as "no value". */
function parse(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** Round a suggestion to whole units (sellers/ads) or one decimal (percent). */
function roundForKpi(n: number, kpi: Kpi): number {
  return kpi.format === 'percent' ? Math.round(n * 10) / 10 : Math.round(n)
}

/** The pre-filled value for a row: saved projection, else the rounded 3-month average. */
function suggestionFor(row: ForecastRow, kpi: Kpi): string {
  if (row.savedProjection != null) return String(row.savedProjection)
  if (row.avg3 != null) return String(roundForKpi(row.avg3, kpi))
  return ''
}

/** Roll per-country numbers up the same way the rest of the app does (sum vs mean). */
function rollUp(nums: number[], kpi: Kpi): number | null {
  if (nums.length === 0) return null
  const total = nums.reduce((s, n) => s + n, 0)
  return kpi.aggregation === 'sum' ? total : total / nums.length
}

/** Hover label for a status dot — "none" here means no projection entered yet. */
function statusTitle(s: Status): string {
  return s === 'none' ? 'No projection yet' : STATUS_LABEL[s]
}

// Country | 3-mo avg | Last month | Projection | Target | Status — fully fluid (no scroll).
const COLS = 'minmax(50px,1.1fr) minmax(0,0.8fr) minmax(0,0.8fr) 70px minmax(0,0.7fr) 22px'
const headerCls = 'text-2xs font-semibold uppercase tracking-wide'

/** One editable forecast card for a single KPI: per-country projections + TOTAL. */
export function ForecastTable({ data, kpi, period, saving, onSave }: Props) {
  const rows = useMemo(() => forecastRows(data, kpi, period), [data, kpi, period])
  const marketRows = useMemo(() => rows.filter((r) => r.market), [rows])
  const totalRow = rows.find((r) => !r.market)!

  const [values, setValues] = useState<Record<string, string>>({})

  // Pre-fill inputs whenever the data, KPI, or forecast month changes.
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const r of marketRows) next[r.id] = suggestionFor(r, kpi)
    setValues(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kpi.id, period])

  const projNums = marketRows
    .map((r) => parse(values[r.id]))
    .filter((n): n is number => n != null)
  const liveTotal = rollUp(projNums, kpi)
  const totalStatus = statusOf(liveTotal, totalRow.target, kpi.direction)

  function saveRows() {
    const out: ForecastUpsert[] = []
    for (const r of marketRows) {
      const n = parse(values[r.id])
      if (n == null) continue
      out.push({ kpi_id: kpi.id, market_id: r.market!.id, period, value: n })
    }
    onSave(out)
  }

  function resetToSuggestion() {
    const next: Record<string, string> = {}
    for (const r of marketRows) next[r.id] = r.avg3 != null ? String(roundForKpi(r.avg3, kpi)) : ''
    setValues(next)
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-0.5">Next-month projection</p>
          <h3 className="truncate font-display text-base font-semibold text-ink" title={kpi.name}>
            {kpi.name}
          </h3>
          <p className="mt-0.5 text-2xs text-ink-muted">
            Projected total <strong className="font-semibold text-ink-soft">{formatValue(liveTotal, kpi)}</strong> vs
            target {formatValue(totalRow.target, kpi)}
          </p>
        </div>
        {liveTotal == null ? (
          <span className="chip shrink-0">Add a projection</span>
        ) : (
          <StatusBadge status={totalStatus} className="shrink-0" />
        )}
      </div>

      <div>
        {/* Header */}
        <div
          className="grid items-end gap-2 border-b border-line pb-2 text-center"
          style={{ gridTemplateColumns: COLS }}
        >
          <span className={cn(headerCls, 'justify-self-start self-end text-ink-muted')}>Country</span>
          <span className={cn(headerCls, 'text-ink-muted')}>Avg 3mo</span>
          <span className={cn(headerCls, 'text-ink-muted')}>Last mo</span>
          <span className={cn(headerCls, 'text-brand-ink')}>Plan</span>
          <span className={cn(headerCls, 'text-ink-muted')}>Target</span>
          <span className="sr-only">Status</span>
        </div>

        {/* Country rows */}
        <div className="divide-y divide-line">
          {marketRows.map((r) => {
            const status = statusOf(parse(values[r.id]), r.target, kpi.direction)
            return (
              <div
                key={r.id}
                className="grid items-center gap-2 py-2 text-center"
                style={{ gridTemplateColumns: COLS }}
              >
                <span className="flex min-w-0 items-center gap-1.5 justify-self-start">
                  <Flag code={r.code} size={18} />
                  <span className="text-sm font-medium text-ink">{r.code}</span>
                </span>
                <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(r.avg3, kpi.format)}</span>
                <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(r.prevActual, kpi.format)}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  aria-label={`${kpi.name} projection for ${r.name}`}
                  value={values[r.id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                  className="tnum h-9 w-full rounded-lg border border-line bg-surface px-1 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(r.target, kpi.format)}</span>
                <span className="justify-self-center" title={statusTitle(status)}>
                  <StatusDot status={status} />
                </span>
              </div>
            )
          })}
        </div>

        {/* TOTAL row */}
        <div
          className="grid items-center gap-2 border-t-2 border-line-strong pt-2.5 text-center"
          style={{ gridTemplateColumns: COLS }}
        >
          <span className="justify-self-start text-sm font-semibold text-ink">Total</span>
          <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(totalRow.avg3, kpi.format)}</span>
          <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(totalRow.prevActual, kpi.format)}</span>
          <span className="tnum whitespace-nowrap text-sm font-semibold text-ink">{formatCompact(liveTotal, kpi.format)}</span>
          <span className="tnum whitespace-nowrap text-sm text-ink-soft">{formatCompact(totalRow.target, kpi.format)}</span>
          <span className="justify-self-center" title={statusTitle(totalStatus)}>
            <StatusDot status={totalStatus} />
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          onClick={resetToSuggestion}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <RotateCcw size={13} />
          Reset to suggestion
        </button>
        <Button variant="primary" size="sm" onClick={saveRows} disabled={saving}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save projection'}
        </Button>
      </div>
    </div>
  )
}
