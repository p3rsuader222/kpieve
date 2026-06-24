import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Coins } from 'lucide-react'
import { monthStart } from '@/lib/metrics'
import { useDashboard } from '@/hooks/useDashboard'
import { useBonusLock } from '@/hooks/useBonusLock'
import { Skeleton } from '@/components/ui/Skeleton'
import { MonthNav } from '@/components/dashboard/MonthNav'
import { BonusGate } from '@/components/bonus/BonusGate'
import { TeamBonusTable } from '@/components/bonus/TeamBonusTable'

function TeamBonusInner() {
  const { data, isLoading } = useDashboard()
  const [period, setPeriod] = useState<string | null>(null)

  if (isLoading || !data) return <BonusSkeleton />

  const bonusPeriod = period ?? monthStart(new Date())
  const monthLabel = format(parseISO(bonusPeriod), 'MMMM yyyy')

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
            <h1 className="mt-1 font-heading text-[1.6rem] font-semibold leading-none tracking-tight text-ink">
              Team Bonus <span className="text-brand">· {monthLabel}</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-ink-muted sm:inline">Scoring month</span>
          <MonthNav period={bonusPeriod} onChange={setPeriod} clampFuture={false} />
        </div>
      </div>

      <p className="max-w-3xl text-sm text-ink-muted">
        How everyone's bonus is shaping up for{' '}
        <strong className="font-semibold text-ink-soft">{monthLabel}</strong>. Each person is scored against their own
        market's plan — core KPIs start paying at <strong className="font-semibold text-ink-soft">80%</strong> (up to{' '}
        <strong className="font-semibold text-ink-soft">150%</strong>), and extra bonuses pay per qualifying seller. Set
        weights, rates and base pools in <strong className="font-semibold text-ink-soft">Settings → Bonus plan</strong>.
      </p>

      <TeamBonusTable data={data} period={bonusPeriod} />
    </div>
  )
}

/**
 * Team Bonus — optionally gated behind a separate access code (sensitive
 * compensation data). The lock can be turned off in Settings.
 */
export function TeamBonus() {
  const { locked } = useBonusLock()
  if (!locked) return <TeamBonusInner />
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
