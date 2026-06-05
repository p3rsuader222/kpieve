import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, activeMembers, teamBonus, BONUS_CAP, BONUS_THRESHOLD, type MemberBonusKpi } from '@/lib/metrics'
import { formatCompact, formatPercent, formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import type { BonusSettingUpsert, BonusWeightUpsert } from '@/data/datasource'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

interface Props {
  data: DashboardData
  period: string
  saving: boolean
  onSave: (weights: BonusWeightUpsert[], settings: BonusSettingUpsert[]) => void
}

type View = 'plan' | 'gap'

const wKey = (memberId: string, kpiId: string) => `${memberId}:${kpiId}`
const eur = (n: number) => formatValue(n, { format: 'currency' })

function num(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

const inputCls =
  'tnum h-9 w-16 rounded-lg border border-line bg-surface px-1 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

/** How many more units (or, for lower-better, how much less) to reach the 80% threshold. */
function gapTo80(row: MemberBonusKpi): { met: boolean; text: string } {
  const { value, target, kpi, attainment } = row
  if (value == null || target == null) return { met: false, text: '—' }
  if (attainment != null && attainment >= BONUS_THRESHOLD) return { met: true, text: '✓ met' }
  if (kpi.direction === 'higher_better') {
    const need = BONUS_THRESHOLD * target - value
    const v = kpi.format === 'percent' ? Math.max(0, need) : Math.max(0, Math.ceil(need))
    return { met: false, text: `+${formatCompact(v, kpi.format)}` }
  }
  const over = value - target / BONUS_THRESHOLD
  const v = kpi.format === 'percent' ? Math.max(0, over) : Math.max(0, Math.ceil(over))
  return { met: false, text: `−${formatCompact(v, kpi.format)}` }
}

/** Editable member × KPI weight grid with base bonus, live final bonus, and a "to 80%" view. */
export function TeamBonusTable({ data, period, saving, onSave }: Props) {
  const kpis = activeKpis(data)
  const members = activeMembers(data)
  const bonus = useMemo(() => teamBonus(data, period), [data, period])
  const [view, setView] = useState<View>('plan')

  // member → kpi → computed bonus row (attainment, value/target, met, …) from data.
  const rowMap = useMemo(() => {
    const m: Record<string, Record<string, MemberBonusKpi>> = {}
    for (const mb of bonus) {
      m[mb.member.id] = {}
      for (const k of mb.kpis) m[mb.member.id][k.kpi.id] = k
    }
    return m
  }, [bonus])

  const [weights, setWeights] = useState<Record<string, string>>({})
  const [maxes, setMaxes] = useState<Record<string, string>>({})

  useEffect(() => {
    const w: Record<string, string> = {}
    for (const m of members) {
      for (const k of kpis) {
        const r = data.bonusWeights.find((b) => b.member_id === m.id && b.kpi_id === k.id)
        w[wKey(m.id, k.id)] = r && r.weight ? String(r.weight) : ''
      }
    }
    const mx: Record<string, string> = {}
    for (const m of members) {
      const s = data.bonusSettings.find((b) => b.member_id === m.id)
      mx[m.id] = s && s.max_bonus ? String(s.max_bonus) : ''
    }
    setWeights(w)
    setMaxes(mx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  function liveFinal(memberId: string): number {
    const max = num(maxes[memberId])
    let total = 0
    for (const k of kpis) {
      const r = rowMap[memberId]?.[k.id]
      if (!r || !r.met || r.cappedAttainment == null) continue // below 80% pays nothing
      total += ((max * num(weights[wKey(memberId, k.id)])) / 100) * r.cappedAttainment
    }
    return total
  }
  const weightSum = (memberId: string) => kpis.reduce((s, k) => s + num(weights[wKey(memberId, k.id)]), 0)

  function save() {
    const w: BonusWeightUpsert[] = []
    for (const m of members) for (const k of kpis) w.push({ member_id: m.id, kpi_id: k.id, weight: num(weights[wKey(m.id, k.id)]) })
    const s: BonusSettingUpsert[] = members.map((m) => ({ member_id: m.id, max_bonus: num(maxes[m.id]) }))
    onSave(w, s)
  }

  const teamTotal = members.reduce((s, m) => s + liveFinal(m.id), 0)

  // Member | KPIs (flex, wrapping headers) | Σ% | Base Bonus | Final €
  const cols = `180px repeat(${kpis.length}, minmax(94px,1fr)) 52px 96px 116px`

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xs text-ink-muted">
          <strong className="font-semibold text-ink-soft">Weights</strong> = set the plan ·{' '}
          <strong className="font-semibold text-ink-soft">To 80%</strong> = units still needed to clear the threshold
        </p>
        <SegmentedControl
          ariaLabel="Table view"
          size="sm"
          segments={[
            { value: 'plan', label: 'Weights' },
            { value: 'gap', label: 'To 80%' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          {/* Header */}
          <div className="grid items-end gap-2 border-b border-line pb-2" style={{ gridTemplateColumns: cols }}>
            <span className="eyebrow self-end">Member</span>
            {kpis.map((k) => (
              <span key={k.id} className="text-center text-2xs font-semibold uppercase leading-tight tracking-wide text-ink-muted">
                {k.name}
              </span>
            ))}
            <span className="self-end text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted">Σ%</span>
            <span className="self-end text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted">Base Bonus</span>
            <span className="justify-self-end self-end text-2xs font-semibold uppercase tracking-wide text-brand-ink">Final €</span>
          </div>

          {/* Member rows */}
          <div className="divide-y divide-line">
            {members.map((m) => {
              const sum = weightSum(m.id)
              const final = liveFinal(m.id)
              return (
                <div key={m.id} className="grid items-center gap-2 py-2" style={{ gridTemplateColumns: cols }}>
                  <span className="flex min-w-0 items-center gap-2 justify-self-start">
                    <Avatar initials={m.initials} color={m.color} avatar={m.avatar} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                  </span>

                  {kpis.map((k) => {
                    const r = rowMap[m.id]?.[k.id]
                    const att = r?.cappedAttainment ?? null
                    const capped = att != null && att >= BONUS_CAP
                    const below = att != null && att < BONUS_THRESHOLD
                    if (view === 'gap') {
                      const g = r ? gapTo80(r) : { met: false, text: '—' }
                      return (
                        <span
                          key={k.id}
                          className={cn('text-center text-sm font-semibold tnum', g.met ? 'text-good' : 'text-warn')}
                        >
                          {g.text}
                        </span>
                      )
                    }
                    return (
                      <div key={k.id} className="flex flex-col items-center gap-0.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          aria-label={`${m.name} · ${k.name} weight %`}
                          value={weights[wKey(m.id, k.id)] ?? ''}
                          onChange={(e) => setWeights((v) => ({ ...v, [wKey(m.id, k.id)]: e.target.value }))}
                          className={inputCls}
                        />
                        <span
                          className={cn('text-2xs', below ? 'font-semibold text-bad' : capped ? 'font-semibold text-good' : 'text-ink-muted')}
                          title={below ? 'Below the 80% threshold — pays €0' : undefined}
                        >
                          {att != null ? formatPercent(att) : '—'}
                          {capped ? ' cap' : below ? ' ✗' : ''}
                        </span>
                      </div>
                    )
                  })}

                  <span className={cn('justify-self-center tnum text-xs font-semibold', sum === 100 ? 'text-ink-muted' : 'text-warn')}>{sum}</span>

                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`${m.name} base bonus`}
                    value={maxes[m.id] ?? ''}
                    onChange={(e) => setMaxes((v) => ({ ...v, [m.id]: e.target.value }))}
                    className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />

                  <span className="tnum justify-self-end text-sm font-semibold text-ink">{eur(final)}</span>
                </div>
              )
            })}
          </div>

          {/* Team total */}
          <div className="grid items-center gap-2 border-t-2 border-line-strong pt-2.5" style={{ gridTemplateColumns: cols }}>
            <span className="justify-self-start text-sm font-semibold text-ink">Team total</span>
            {kpis.map((k) => (
              <span key={k.id} />
            ))}
            <span />
            <span />
            <span className="tnum justify-self-end text-base font-semibold text-ink">{eur(teamTotal)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xs text-ink-muted">
          Final = base bonus × Σ(weight × attainment) for KPIs at or above {Math.round(BONUS_THRESHOLD * 100)}%; a KPI
          below that pays €0 (✗). Each KPI is capped at {Math.round(BONUS_CAP * 100)}%.
        </p>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save bonus plan'}
        </Button>
      </div>
    </div>
  )
}
