import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import {
  activeKpis,
  byMarket,
  byMember,
  kpiSnapshots,
  latestDate,
} from '@/lib/metrics'
import type { TimeRange } from '@/lib/types'
import { useDashboard } from '@/hooks/useDashboard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Reveal } from '@/components/ui/Reveal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SummaryBar } from '@/components/dashboard/SummaryBar'
import { TrendChart, type SplitBy } from '@/components/dashboard/TrendChart'
import { BreakdownList, type BreakdownItem } from '@/components/dashboard/BreakdownList'
import { MemberLeaderboard } from '@/components/dashboard/MemberLeaderboard'
import { AdherenceHeatmap } from '@/components/dashboard/AdherenceHeatmap'

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const SPLITS: { value: SplitBy; label: string }[] = [
  { value: 'none', label: 'Team' },
  { value: 'market', label: 'Market' },
  { value: 'member', label: 'Member' },
]

export function Dashboard() {
  const { data, isLoading, isFetching, refetch } = useDashboard()
  const [range, setRange] = useState<TimeRange>('week')
  const [splitBy, setSplitBy] = useState<SplitBy>('none')
  const [breakdown, setBreakdown] = useState<'market' | 'member'>('market')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const kpis = data ? activeKpis(data) : []
  const selectedKpi = kpis.find((k) => k.id === selectedKpiId) ?? kpis[0]

  const snaps = useMemo(() => (data ? kpiSnapshots(data, range) : []), [data, range])

  const breakdownItems = useMemo<BreakdownItem[]>(() => {
    if (!data || !selectedKpi) return []
    if (breakdown === 'market') {
      return byMarket(data, selectedKpi, range).map((r) => ({
        id: r.entity.id,
        label: r.entity.code,
        sublabel: r.entity.name,
        value: r.value,
        target: r.target,
        attainment: r.attainment,
        status: r.status,
      }))
    }
    return byMember(data, selectedKpi, range).map((r) => ({
      id: r.entity.id,
      label: r.entity.name.split(' ')[0],
      color: r.entity.color,
      value: r.value,
      target: r.target,
      attainment: r.attainment,
      status: r.status,
    }))
  }, [data, selectedKpi, range, breakdown])

  if (isLoading || !data || !selectedKpi) return <DashboardSkeleton />

  const dateLabel = format(parseISO(latestDate(data.entries)), 'EEEE, d MMMM yyyy')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Onboarding team · LT · LV · EE · PL</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            KPI Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">Latest data · {dateLabel}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <SegmentedControl ariaLabel="Time range" segments={RANGES} value={range} onChange={setRange} />
          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            aria-label="Refresh"
            className="px-3"
          >
            <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Link to="/update" className={buttonClasses('primary', 'md')}>
            Update data
          </Link>
        </div>
      </div>

      <Reveal>
        <SummaryBar snaps={snaps} range={range} />
      </Reveal>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {snaps.map((snap, i) => {
          const selected = snap.kpi.id === selectedKpi.id
          return (
            <Reveal key={snap.kpi.id} delay={60 + i * 55}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`Focus ${snap.kpi.name}`}
                onClick={() => setSelectedKpiId(snap.kpi.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedKpiId(snap.kpi.id)
                  }
                }}
                className={cn(
                  'cursor-pointer rounded-2xl transition-transform duration-200 focus-visible:outline-none',
                  selected && 'ring-2 ring-brand ring-offset-2 ring-offset-paper',
                )}
              >
                <KpiCard snap={snap} />
              </div>
            </Reveal>
          )
        })}
      </div>

      {/* Trends + leaderboard */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          eyebrow="Trend over time"
          title={selectedKpi.name}
          actions={
            <SegmentedControl ariaLabel="Split by" size="sm" segments={SPLITS} value={splitBy} onChange={setSplitBy} />
          }
        >
          <div className="mb-4 flex flex-wrap gap-1.5">
            {kpis.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelectedKpiId(k.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  k.id === selectedKpi.id
                    ? 'bg-brand text-brand-contrast'
                    : 'border border-line bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {k.name}
              </button>
            ))}
          </div>
          <TrendChart data={data} kpi={selectedKpi} range={range} splitBy={splitBy} />
        </Panel>

        <Panel eyebrow="Ranking" title="Team leaderboard">
          <MemberLeaderboard data={data} range={range} />
        </Panel>
      </div>

      {/* Breakdown + heatmap */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          eyebrow={`${selectedKpi.name} · this ${range === 'today' ? 'day' : range}`}
          title={breakdown === 'market' ? 'By market' : 'By member'}
          actions={
            <SegmentedControl
              ariaLabel="Breakdown"
              size="sm"
              segments={[
                { value: 'market', label: 'Market' },
                { value: 'member', label: 'Member' },
              ]}
              value={breakdown}
              onChange={setBreakdown}
            />
          }
        >
          <BreakdownList items={breakdownItems} kpi={selectedKpi} />
        </Panel>

        <Panel eyebrow="Coverage · all KPIs" title="Member × market adherence">
          <AdherenceHeatmap data={data} range={range} />
        </Panel>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
        <Skeleton className="h-10 w-72" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
