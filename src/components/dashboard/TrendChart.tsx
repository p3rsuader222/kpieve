import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompact, formatValue } from '@/lib/format'
import {
  activeMembers,
  bucketFact,
  periodTarget,
  totalTarget,
  trendBuckets,
  type Granularity,
} from '@/lib/metrics'
import type { DashboardData, Kpi } from '@/lib/types'
import { useThemeColors } from '@/hooks/useThemeColors'

export type SplitBy = 'none' | 'market' | 'member'

const MARKET_COLORS = ['#0A7AFF', '#32C998', '#E8A100', '#CE3247']

const AXIS_FMT: Record<Granularity, string> = { day: 'd', week: 'd MMM', month: 'MMM' }
const TIP_FMT: Record<Granularity, string> = { day: 'EEE, d MMM', week: "'Week of' d MMM", month: 'MMMM yyyy' }

interface Props {
  data: DashboardData
  kpi: Kpi
  splitBy: SplitBy
  granularity: Granularity
  period: string
  /** When set, the "Total" line + target reflect this single country. */
  marketId?: string | null
}

interface SeriesDef {
  key: string
  label: string
  color: string
}

export function TrendChart({ data, kpi, splitBy, granularity, period, marketId }: Props) {
  const c = useThemeColors()

  const { rows, series, target } = useMemo(() => {
    const buckets = trendBuckets(data, granularity, period)
    const rowMap = new Map<string, Record<string, number | string | null>>()
    buckets.forEach((b) => rowMap.set(b, { date: b }))

    let series: SeriesDef[] = []

    if (splitBy === 'none') {
      buckets.forEach((b) => (rowMap.get(b)!.value = bucketFact(data, kpi, b, granularity, marketId ? { marketId } : {})))
      series = [{ key: 'value', label: kpi.name, color: c.brand }]
    } else if (splitBy === 'market') {
      data.markets
        .slice()
        .sort((a, z) => a.sort_order - z.sort_order)
        .forEach((m, i) => {
          buckets.forEach((b) => (rowMap.get(b)![`m_${m.id}`] = bucketFact(data, kpi, b, granularity, { marketId: m.id })))
          series.push({ key: `m_${m.id}`, label: m.code, color: MARKET_COLORS[i % MARKET_COLORS.length] })
        })
    } else {
      activeMembers(data).forEach((m) => {
        buckets.forEach((b) => (rowMap.get(b)![`u_${m.id}`] = bucketFact(data, kpi, b, granularity, { memberId: m.id })))
        series.push({ key: `u_${m.id}`, label: m.initials, color: m.color })
      })
    }

    // Target reference only for the monthly view (country target when scoped, else TOTAL).
    const last = buckets.length ? buckets[buckets.length - 1] : null
    const target =
      granularity === 'month' && splitBy === 'none' && last
        ? marketId
          ? periodTarget(data, kpi.id, marketId, last)
          : totalTarget(data, kpi, last)
        : null

    return { rows: buckets.map((b) => rowMap.get(b)!), series, target }
  }, [data, kpi, splitBy, granularity, period, marketId, c.brand])

  if (rows.length < 2) {
    return (
      <div className="grid h-full min-h-[230px] place-items-center text-sm text-ink-muted">
        Not enough {granularity === 'month' ? 'monthly' : granularity === 'week' ? 'weekly' : 'daily'} data yet.
      </div>
    )
  }

  const minTickGap = granularity === 'day' ? 24 : granularity === 'week' ? 8 : 12

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={c.line} strokeDasharray="3 4" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => format(parseISO(d), AXIS_FMT[granularity])}
          tick={{ fill: c['ink-muted'], fontSize: 11 }}
          axisLine={{ stroke: c.line }}
          tickLine={false}
          minTickGap={minTickGap}
          dy={8}
        />
        <YAxis
          tickFormatter={(v) => formatCompact(v, kpi.format)}
          tick={{ fill: c['ink-muted'], fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        {target != null && (
          <ReferenceLine
            y={target}
            stroke={c['ink-muted']}
            strokeDasharray="5 5"
            strokeOpacity={0.7}
            label={{ value: `Target ${formatCompact(target, kpi.format)}`, position: 'insideTopRight', fill: c['ink-muted'], fontSize: 10 }}
          />
        )}
        <Tooltip content={<TrendTooltip kpi={kpi} granularity={granularity} surface={c.surface} line={c.line} ink={c.ink} muted={c['ink-muted']} />} />
        {splitBy === 'none'
          ? series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.5}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls
                isAnimationActive
                animationDuration={700}
              />
            ))
          : series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive
                animationDuration={700}
              />
            ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: Array<{ name: string; value: number; color: string }>
  kpi: Kpi
  granularity: Granularity
  surface: string
  line: string
  ink: string
  muted: string
}

function TrendTooltip({ active, label, payload, kpi, granularity, surface, line, ink, muted }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-pop"
      style={{ background: surface, borderColor: line, color: ink }}
    >
      <div className="mb-1.5 font-semibold" style={{ color: muted }}>
        {format(parseISO(label), TIP_FMT[granularity])}
      </div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="mr-3" style={{ color: muted }}>
              {p.name}
            </span>
            <span className="tnum ml-auto font-semibold">{formatValue(p.value, kpi)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
