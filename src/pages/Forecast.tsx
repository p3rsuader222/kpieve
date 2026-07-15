import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarClock, Info } from 'lucide-react'
import { activeKpis, monthStart } from '@/lib/metrics'
import { useDashboard } from '@/hooks/useDashboard'
import { usePersistentState } from '@/hooks/usePersistentState'
import { KpiTabs } from '@/components/ui/KpiTabs'
import { Skeleton } from '@/components/ui/Skeleton'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { ForecastTable } from '@/components/forecast/ForecastTable'

const HEADLINE_KPI = 'Sellers with 1st active offer'

export function Forecast() {
  const { data, isLoading } = useDashboard()

  const [period, setPeriod] = useState<string | null>(null)
  // KPI selection is remembered across visits — Evelina reopens the page on
  // the same set of cards she left. null = never chosen → headline default.
  const [selectedIds, setSelectedIds] = usePersistentState<string[] | null>('kpieve-forecast-kpis', null)

  if (isLoading || !data) return <ForecastSkeleton />

  const kpis = activeKpis(data)
  const defaultId = (kpis.find((k) => k.name === HEADLINE_KPI) ?? kpis[0])?.id
  // Drop remembered ids whose KPI has since been deleted or hidden.
  const selected =
    selectedIds == null ? (defaultId ? [defaultId] : []) : selectedIds.filter((id) => kpis.some((k) => k.id === id))
  const selectedKpis = kpis.filter((k) => selected.includes(k.id))

  // Default to the current (in-progress) month: its onboarding completions are
  // still upcoming and are fed by last month's pipeline.
  const forecastPeriod = period ?? monthStart(new Date())
  const monthLabel = format(parseISO(forecastPeriod), 'MMMM yyyy')

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const base = prev ?? selected
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })
  }

  return (
    <div className="max-w-[1720px] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface">
            <CalendarClock size={22} className="text-brand" />
          </span>
          <div>
            <p className="eyebrow">Pipeline · onboarding outlook</p>
            <h1 className="mt-1 font-heading text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
              Forecast <span className="text-brand">· {monthLabel}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">Onboarding in</span>
          <MonthNav period={forecastPeriod} onChange={setPeriod} clampFuture={false} />
        </div>
      </div>

      <p className="flex max-w-2xl items-start gap-2 text-sm text-ink-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-brand" />
        <span>
          How many sellers you're likely to finish onboarding in{' '}
          <strong className="font-semibold text-ink-soft">{monthLabel}</strong>. Each country's number is last month's{' '}
          <strong className="font-semibold text-ink-soft">1st active offer</strong> sellers — they usually wrap up about a
          month later. <strong className="font-semibold text-ink-soft">3-mo avg</strong> is a rough guess from recent
          months.
        </span>
      </p>

      {/* KPI tabs (multi-select) + forecast cards */}
      <div className="space-y-4">
        <KpiTabs
          ariaLabel="Forecast KPIs"
          kpis={kpis}
          selectedIds={selected}
          onSelect={toggle}
          multi
        />
        {selectedKpis.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-soft">
            <Info size={16} className="shrink-0 text-brand" />
            <span>Pick at least one KPI above.</span>
          </div>
        ) : (
          /* Auto-fill: as many cards per row as genuinely fit — each card keeps
             a minimum width so its Target column can never be clipped. */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
            {selectedKpis.map((kpi) => (
              <ForecastTable key={kpi.id} data={data} kpi={kpi} period={forecastPeriod} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ForecastSkeleton() {
  return (
    <div className="max-w-[1720px] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
