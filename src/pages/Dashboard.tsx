import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { activeKpis, listPeriods, monthStart, snapshotsForPeriod } from '@/lib/metrics'
import { useDashboard } from '@/hooks/useDashboard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SummaryBar } from '@/components/dashboard/SummaryBar'
import { CountryMatrix } from '@/components/dashboard/CountryMatrix'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { TrendChart, type SplitBy } from '@/components/dashboard/TrendChart'
import { MemberLeaderboard } from '@/components/dashboard/MemberLeaderboard'
import { AdherenceHeatmap } from '@/components/dashboard/AdherenceHeatmap'

const SPLITS: { value: SplitBy; label: string }[] = [
  { value: 'none', label: 'Total' },
  { value: 'market', label: 'Market' },
  { value: 'member', label: 'Member' },
]

export function Dashboard() {
  const { data, isLoading, isFetching, refetch } = useDashboard()
  const [period, setPeriod] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null) // null = TOTAL
  const [splitBy, setSplitBy] = useState<SplitBy>('none')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const periods = data ? listPeriods(data) : []
  const activePeriod = period ?? (data ? monthStart(new Date()) : '')
  const kpis = data ? activeKpis(data) : []
  const selectedKpi = kpis.find((k) => k.id === selectedKpiId) ?? kpis[0]

  const scope = useMemo(() => (selectedMarket ? { marketId: selectedMarket } : {}), [selectedMarket])
  const snaps = useMemo(
    () => (data ? snapshotsForPeriod(data, activePeriod, scope) : []),
    [data, activePeriod, scope],
  )

  const scopeLabel = selectedMarket
    ? data?.markets.find((m) => m.id === selectedMarket)?.name ?? 'Country'
    : 'All countries'

  if (isLoading || !data || !selectedKpi) return <DashboardSkeleton />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Onboarding team · LT · LV · EE · PL</p>
          <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
            Onboarding KPIs
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthNav period={activePeriod} onChange={setPeriod} periods={periods} />
          <Button variant="secondary" size="md" onClick={() => refetch()} aria-label="Refresh" className="px-3">
            <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Link to="/update" className={buttonClasses('primary', 'md')}>
            Update data
          </Link>
        </div>
      </div>

      {/* Summary strip */}
      <SummaryBar snaps={snaps} period={activePeriod} scopeLabel={scopeLabel} />

      {/* Matrix (hero) + leaderboard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          eyebrow="Country × KPI"
          title="Targets & progress by country"
          actions={
            selectedMarket && (
              <Button variant="subtle" size="sm" onClick={() => setSelectedMarket(null)}>
                Show total
              </Button>
            )
          }
        >
          <CountryMatrix data={data} period={activePeriod} selected={selectedMarket} onSelect={setSelectedMarket} />
        </Panel>

        <Panel className="lg:col-span-4" eyebrow="Ranking" title="Team leaderboard">
          <MemberLeaderboard data={data} period={activePeriod} />
        </Panel>
      </div>

      {/* Focused detail — 5 KPI cards in one row */}
      <div>
        <h2 className="mb-2 font-display text-sm font-semibold text-ink">
          {scopeLabel}
          <span className="ml-2 text-xs font-sans font-normal text-ink-muted">monthly detail · click to focus a KPI</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {snaps.map((snap) => {
            const selected = snap.kpi.id === selectedKpi.id
            return (
              <div
                key={snap.kpi.id}
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
                  'cursor-pointer rounded-xl transition-transform duration-200 focus-visible:outline-none',
                  selected && 'ring-2 ring-brand ring-offset-2 ring-offset-paper',
                )}
              >
                <KpiCard snap={snap} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Trend + coverage heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          eyebrow={`Month over month · ${selectedKpi.name}`}
          title="Trend"
          actions={
            <SegmentedControl ariaLabel="Split by" size="sm" segments={SPLITS} value={splitBy} onChange={setSplitBy} />
          }
        >
          <TrendChart data={data} kpi={selectedKpi} splitBy={splitBy} />
        </Panel>

        <Panel className="lg:col-span-4" eyebrow="Coverage · all KPIs" title="Member × market">
          <AdherenceHeatmap data={data} period={activePeriod} />
        </Panel>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-72" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Skeleton className="h-80 rounded-xl lg:col-span-8" />
        <Skeleton className="h-80 rounded-xl lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
