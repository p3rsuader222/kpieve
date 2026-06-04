import type { Kpi, KpiFormat } from './types'

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** Format a duration expressed in minutes into a compact human label. */
function formatDuration(minutes: number): string {
  if (!isFinite(minutes)) return '—'
  if (minutes < 60) return `${intFmt.format(Math.round(minutes))}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}

interface FormatOpts {
  format: KpiFormat
  unit?: string | null
}

/** Format a raw numeric value according to a KPI's format + unit. */
export function formatValue(value: number | null | undefined, kpi: FormatOpts): string {
  if (value == null || Number.isNaN(value)) return '—'
  switch (kpi.format) {
    case 'percent':
      return `${numberFmt.format(value)}%`
    case 'currency':
      return currencyFmt.format(value)
    case 'duration':
      return formatDuration(value)
    case 'number':
    default: {
      const n = Number.isInteger(value) ? intFmt.format(value) : numberFmt.format(value)
      return kpi.unit ? `${n} ${kpi.unit}` : n
    }
  }
}

/** Short value for tight spaces (axis ticks, chips) — drops unit, compacts thousands. */
export function formatCompact(value: number | null | undefined, format: KpiFormat): string {
  if (value == null || Number.isNaN(value)) return '—'
  if (format === 'percent') return `${Math.round(value)}%`
  if (format === 'duration') return formatDuration(value)
  if (format === 'currency') {
    if (Math.abs(value) >= 1000)
      return `€${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
    return `€${intFmt.format(value)}`
  }
  if (Math.abs(value) >= 1000)
    return `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`
  return intFmt.format(value)
}

/** Signed delta label, e.g. "+3.2%" or "−1.5". */
export function formatDelta(delta: number | null | undefined, kpi: Pick<Kpi, 'format'>): string {
  if (delta == null || Number.isNaN(delta) || delta === 0) return '±0'
  const sign = delta > 0 ? '+' : '−'
  const abs = Math.abs(delta)
  if (kpi.format === 'percent') return `${sign}${numberFmt.format(abs)}pp`
  if (kpi.format === 'currency') return `${sign}${formatCompact(abs, 'currency')}`
  if (kpi.format === 'duration') return `${sign}${formatDuration(abs)}`
  return `${sign}${numberFmt.format(abs)}`
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toLocaleString('en-US', { maximumFractionDigits: digits })}%`
}
