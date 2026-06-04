import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import {
  activeKpis,
  byMarketPeriod,
  byMemberPeriod,
  latestPeriod,
  listPeriods,
  snapshotsForPeriod,
} from '@/lib/metrics'
import { useDashboard } from '@/hooks/useDashboard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Reveal } from '@/components/ui/Reveal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SummaryBar } from '@/components/dashboard/SummaryBar'
import { CountryMatrix } from '@/components/dashboard/CountryMatrix'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { TrendChart, type SplitBy } from '@/components/dashboard/TrendChart'
import { BreakdownList, type BreakdownItem } from '@/components/dashboard/BreakdownList'
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
  const [breakdown, setBreakdown] = useState<'market' | 'member'>('market')
  const [selectedKpiId, setSelectedKpiId] = useState<string | null>(null)

  const periods = data ? listPeriods(data) : []
  const activePeriod = period ?? (data ? latestPeriod(data) : '')
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

  const breakdownItems = useMemo<BreakdownItem[]>(() => {
    if (!data || !selectedKpi) return []
    if (breakdown === 'market') {
      return byMarketPeriod(data, selectedKpi, activePeriod).map((r) => ({
        id: r.entity.id,
        label: r.entity.code,
        sublabel: r.entity.name,
        value: r.value,
        target: r.target,
        attainment: r.attainment,
        status: r.status,
      }))
    }
    return byMemberPeriod(data, selectedKpi, activePeriod).map((r) => ({
      id: r.entity.id,
      label: r.entity.name.split(' ')[0],
      color: r.entity.color,
      value: r.value,
      target: r.target,
      attainment: r.attainment,
      status: r.status,
    }))
  }, [data, selectedKpi, activePeriod, breakdown])

  if (isLoading || !data || !selectedKpi) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Onboarding team · LT · LV · EE · PL</p>
          <h1 className="mt-1.5 font-display text-3xl font-medium tracking-tight text-ink sm:text-[2.5rem] sm:leading-none">
            Onboarding KPIs
          </h1>
          <p className="mt-2 text-sm text-ink-muted">Per-country monthly targets &amp; progress</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthNav period={activePeriod} onChange={setPeriod} periods={periods} />
          <Button variant="secondary" size="md" onClick={() => refetch()} aria-label="Refresh" className="px-3">
            <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
          </Button>
          <Link to="/update" className={buttonClasses('primary', 'md')}>
            Update data
          </Link>
        </div>
      </div>

      <Reveal>
        <SummaryBar snaps={snaps} period={activePeriod} scopeLabel={scopeLabel} />
      </Reveal>

      {/* Country × KPI matrix — the centerpiece */}
      <Reveal delay={60}>
        <Panel
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
      </Reveal>

      {/* Focused scope detail — 5 KPI cards */}
      <div className="flex items-end justify-between">
        <h2 className="font-display text-xl font-medium text-ink">
          {scopeLabel}
          <span className="ml-2 text-sm font-sans font-normal text-ink-muted">detail</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {snaps.map((snap, i) => {
          const selected = snap.kpi.id === selectedKpi.id
          return (
            <Reveal key={snap.kpi.id} delay={60 + i * 50}>
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
                  'cursor-pointer rounded-xl transition-transform duration-200 focus-visible:outline-none',
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
          eyebrow="Month over month"
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
          <TrendChart data={data} kpi={selectedKpi} splitBy={splitBy} />
        </Panel>

        <Panel eyebrow="Ranking" title="Team leaderboard">
          <MemberLeaderboard data={data} period={activePeriod} />
        </Panel>
      </div>

      {/* Breakdown + heatmap */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          eyebrow={selectedKpi.name}
          title={breakdown === 'market' ? 'By country' : 'By member'}
          actions={
            <SegmentedControl
              ariaLabel="Breakdown"
              size="sm"
              segments={[
                { value: 'market', label: 'Country' },
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
          <AdherenceHeatmap data={data} period={activePeriod} />
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
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
