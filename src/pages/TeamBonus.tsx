import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Coins, Database } from 'lucide-react'
import { monthStart } from '@/lib/metrics'
import { usingMockData, type BonusSettingUpsert, type BonusWeightUpsert } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { BonusGate } from '@/components/bonus/BonusGate'
import { TeamBonusTable } from '@/components/bonus/TeamBonusTable'

function TeamBonusInner() {
  const { data, isLoading } = useDashboard()
  const m = useConfigMutations()
  const toast = useToast()
  const [period, setPeriod] = useState<string | null>(null)

  function guard(): boolean {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save the bonus plan.')
      return false
    }
    return true
  }

  async function save(weights: BonusWeightUpsert[], settings: BonusSettingUpsert[]) {
    if (!guard()) return
    try {
      await Promise.all([m.upsertBonusWeights.mutateAsync(weights), m.upsertBonusSettings.mutateAsync(settings)])
      toast.success('Bonus plan saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the bonus plan.')
    }
  }

  if (isLoading || !data) return <BonusSkeleton />

  const bonusPeriod = period ?? monthStart(new Date())
  const monthLabel = format(parseISO(bonusPeriod), 'MMMM yyyy')
  const saving = m.upsertBonusWeights.isPending || m.upsertBonusSettings.isPending

  return (
    <div className="max-w-[1120px] space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface">
            <Coins size={22} className="text-brand" />
          </span>
          <div>
            <p className="eyebrow">Compensation · confidential</p>
            <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
              Team Bonus <span className="text-brand">· {monthLabel}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">Scoring month</span>
          <MonthNav period={bonusPeriod} onChange={setPeriod} clampFuture={false} />
        </div>
      </div>

      {usingMockData && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-brand-soft/60 px-4 py-3 text-sm text-ink-soft">
          <Database size={17} className="shrink-0 text-brand" />
          <span>
            <strong className="font-semibold text-ink">Demo mode.</strong> You can try the plan and preview payouts, but
            saving needs Supabase connected.
          </span>
        </div>
      )}

      <p className="max-w-3xl text-sm text-ink-muted">
        See how everyone's bonus is shaping up for{' '}
        <strong className="font-semibold text-ink-soft">{monthLabel}</strong>. Each KPI starts paying once a person
        reaches <strong className="font-semibold text-ink-soft">80%</strong>, up to{' '}
        <strong className="font-semibold text-ink-soft">150%</strong> for beating the target. Switch to{' '}
        <strong className="font-semibold text-ink-soft">Weights</strong> to set each person's bonus pot and how it's
        split across KPIs.
      </p>

      <TeamBonusTable data={data} period={bonusPeriod} saving={saving} onSave={save} />
    </div>
  )
}

/** Team Bonus — gated behind a separate password (sensitive compensation data). */
export function TeamBonus() {
  return (
    <BonusGate>
      <TeamBonusInner />
    </BonusGate>
  )
}

function BonusSkeleton() {
  return (
    <div className="max-w-[1120px] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="h-9 w-full max-w-2xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
