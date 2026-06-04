import { useMemo, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { Globe2, Info, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { activeKpis, listPeriods, monthStart, snapshotsForPeriod, type Granularity } from '@/lib/metrics'
import { useDashboard } from '@/hooks/useDashboard'
import { Button, buttonClasses } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { Flag } from '@/components/ui/Flag'
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

const GRANS: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

/** Section header used inside the joined column cards. */
function SectionHead({ eyebrow, title, actions }: { eyebrow: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow mb-0.5">{eyebrow}</p>
        <h2 className="flex items-center gap-2 font-display text-base font-semibold leading-tight text-ink">{title}</h2>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  )
}

export function Dashboard() {
  const { data, isLoading, isFetching, refetch } = useDashboard()
  const [period, setPeriod] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null) // null = TOTAL
  const [splitBy, setSplitBy] = useState<SplitBy>('none')
  const [granularity, setGranularity] = useState<Granularity>('month')
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

  if (isLoading || !data || !selectedKpi) return <DashboardSkeleton />

  const selectedCountry = selectedMarket ? data.markets.find((m) => m.id === selectedMarket) ?? null : null
  const scopeLabel = selectedCountry?.name ?? 'All countries'
  const monthLabel = format(parseISO(activePeriod), 'MMMM yyyy')
  const hasData = snaps.some((s) => s.value != null)

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition-colors',
                selectedCountry ? 'border-brand bg-brand-soft' : 'border-line bg-surface',
              )}
            >
              {selectedCountry ? <Flag code={selectedCountry.code} size={30} /> : <Globe2 size={22} className="text-brand" />}
            </span>
            <div>
              <p className="eyebrow">{selectedCountry ? 'Viewing country' : 'Onboarding team · LT · LV · EE · PL'}</p>
              <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
                Onboarding KPIs
                {selectedCountry && <span className="text-brand"> · {selectedCountry.name}</span>}
              </h1>
            </div>
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
      </div>

      {!hasData && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-2.5 text-sm text-ink-soft">
          <Info size={16} className="shrink-0 text-brand" />
          <span>
            No numbers logged for <strong className="font-semibold text-ink">{monthLabel}</strong> yet — head to{' '}
            <Link to="/update" className="font-semibold text-brand-ink underline underline-offset-2">
              Update
            </Link>{' '}
            to enter the team's daily figures.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* LEFT column — matrix · detail · trend, joined */}
        <div className="card relative divide-y divide-line overflow-hidden xl:col-span-8">
          {selectedCountry && (
            <div
              key={selectedCountry.code}
              className="pointer-events-none absolute -right-10 -top-10 z-0 animate-fade-up opacity-[0.06]"
              aria-hidden="true"
            >
              <Flag code={selectedCountry.code} size={380} />
            </div>
          )}
          <section className="relative z-10 p-4">
            <SectionHead eyebrow="Country × KPI" title="Targets & progress by country" />
            <CountryMatrix data={data} period={activePeriod} selected={selectedMarket} onSelect={setSelectedMarket} />
          </section>

          <section className="relative z-10 p-4">
            <SectionHead
              eyebrow="Monthly detail · click to focus a KPI"
              title={
                <>
                  {selectedCountry && <Flag code={selectedCountry.code} size={20} />}
                  {scopeLabel}
                </>
              }
            />
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
                      selected && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
                    )}
                  >
                    <KpiCard snap={snap} />
                  </div>
                )
              })}
            </div>
          </section>

          <section className="relative z-10 p-4">
            <SectionHead
              eyebrow={`${scopeLabel} · ${selectedKpi.name}`}
              title="Trend over time"
              actions={
                <>
                  <SegmentedControl ariaLabel="Granularity" size="sm" segments={GRANS} value={granularity} onChange={setGranularity} />
                  <SegmentedControl ariaLabel="Split by" size="sm" segments={SPLITS} value={splitBy} onChange={setSplitBy} />
                </>
              }
            />
            <TrendChart
              data={data}
              kpi={selectedKpi}
              splitBy={splitBy}
              granularity={granularity}
              period={activePeriod}
              marketId={selectedMarket}
            />
          </section>
        </div>

        {/* RIGHT column — summary · leaderboard · coverage, joined */}
        <div className="card divide-y divide-line xl:col-span-4">
          <section className="p-4">
            <SummaryBar
              snaps={snaps}
              period={activePeriod}
              scopeCountry={selectedCountry ? { code: selectedCountry.code, name: selectedCountry.name } : null}
              onClearScope={() => setSelectedMarket(null)}
            />
          </section>

          <section className="p-4">
            <SectionHead eyebrow="Ranking" title="Team leaderboard" />
            <MemberLeaderboard data={data} period={activePeriod} />
          </section>

          <section className="p-4">
            <SectionHead eyebrow="Coverage · all KPIs" title="Member × market" />
            <AdherenceHeatmap data={data} period={activePeriod} />
          </section>
        </div>
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-[640px] rounded-xl xl:col-span-8" />
        <Skeleton className="h-[640px] rounded-xl xl:col-span-4" />
      </div>
    </div>
  )
}
