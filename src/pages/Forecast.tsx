import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarClock, Database, Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, monthStart, nextPeriod } from '@/lib/metrics'
import { usingMockData } from '@/data/datasource'
import type { ForecastUpsert } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { ForecastTable } from '@/components/forecast/ForecastTable'

const HEADLINE_KPI = 'Sellers with 1st active offer'

export function Forecast() {
  const { data, isLoading } = useDashboard()
  const m = useConfigMutations()
  const toast = useToast()

  const [period, setPeriod] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null)

  function guard(): boolean {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save projections.')
      return false
    }
    return true
  }

  async function saveForecasts(rows: ForecastUpsert[]) {
    if (!guard()) return
    if (rows.length === 0) {
      toast.info('Nothing to save yet.')
      return
    }
    try {
      await m.upsertForecasts.mutateAsync(rows)
      toast.success(`Saved ${rows.length} projection${rows.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save projections.')
    }
  }

  if (isLoading || !data) return <ForecastSkeleton />

  const kpis = activeKpis(data)
  const defaultId = (kpis.find((k) => k.name === HEADLINE_KPI) ?? kpis[0])?.id
  const selected = selectedIds ?? (defaultId ? [defaultId] : [])
  const selectedKpis = kpis.filter((k) => selected.includes(k.id))

  const forecastPeriod = period ?? nextPeriod(monthStart(new Date()))
  const monthLabel = format(parseISO(forecastPeriod), 'MMMM yyyy')

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const base = prev ?? selected
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })
  }

  return (
    <div className="max-w-[1120px] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface">
            <CalendarClock size={22} className="text-brand" />
          </span>
          <div>
            <p className="eyebrow">Planning · next-month pipeline</p>
            <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
              Forecast <span className="text-brand">· {monthLabel}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">Forecasting</span>
          <MonthNav period={forecastPeriod} onChange={setPeriod} clampFuture={false} />
        </div>
      </div>

      <p className="max-w-2xl text-sm text-ink-muted">
        Onboarding takes ~2 months, so next month's results are largely set by the current pipeline. Type how many
        you expect to finalize per country — the <strong className="font-semibold text-ink-soft">3-month average</strong>{' '}
        is shown as a baseline — and compare it against next month's target.
      </p>

      {usingMockData && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-brand-soft/60 px-4 py-3 text-sm text-ink-soft">
          <Database size={17} className="shrink-0 text-brand" />
          <span>
            <strong className="font-semibold text-ink">Demo mode.</strong> You can type projections to preview the math,
            but saving needs Supabase connected.
          </span>
        </div>
      )}

      {/* KPI multi-select */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">KPIs</span>
        {kpis.map((k) => {
          const on = selected.includes(k.id)
          return (
            <button
              key={k.id}
              onClick={() => toggle(k.id)}
              aria-pressed={on}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                on
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              {k.name}
            </button>
          )
        })}
      </div>

      {/* Tables */}
      {selectedKpis.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-soft">
          <Info size={16} className="shrink-0 text-brand" />
          <span>Pick at least one KPI above to forecast next month.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {selectedKpis.map((kpi) => (
            <ForecastTable
              key={kpi.id}
              data={data}
              kpi={kpi}
              period={forecastPeriod}
              saving={m.upsertForecasts.isPending}
              onSave={saveForecasts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ForecastSkeleton() {
  return (
    <div className="max-w-[1120px] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-9 w-full max-w-2xl" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
