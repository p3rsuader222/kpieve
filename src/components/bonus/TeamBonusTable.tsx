import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Save, SlidersHorizontal } from 'lucide-react'
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

type View = 'gap' | 'plan'

const wKey = (memberId: string, kpiId: string) => `${memberId}:${kpiId}`
const eur = (n: number) => formatValue(n, { format: 'currency' })

function num(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

interface Gap {
  met: boolean
  scored: boolean
  amount: string // formatted units
  word: string // "more" | "less"
}

/** How far a member is from the 80% threshold on a KPI. */
function gapTo80(row: MemberBonusKpi): Gap {
  const { value, target, kpi, attainment } = row
  if (value == null || target == null) return { met: false, scored: false, amount: '', word: '' }
  if (attainment != null && attainment >= BONUS_THRESHOLD) return { met: true, scored: true, amount: '', word: '' }
  if (kpi.direction === 'higher_better') {
    const need = BONUS_THRESHOLD * target - value
    const v = kpi.format === 'percent' ? Math.max(0, need) : Math.max(0, Math.ceil(need))
    return { met: false, scored: true, amount: formatCompact(v, kpi.format), word: 'more' }
  }
  const over = value - target / BONUS_THRESHOLD
  const v = kpi.format === 'percent' ? Math.max(0, over) : Math.max(0, Math.ceil(over))
  return { met: false, scored: true, amount: formatCompact(v, kpi.format), word: 'less' }
}

const weightInput =
  'tnum h-9 w-16 rounded-lg border border-line bg-surface px-1 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

export function TeamBonusTable({ data, period, saving, onSave }: Props) {
  const kpis = activeKpis(data)
  const members = activeMembers(data)
  const bonus = useMemo(() => teamBonus(data, period), [data, period])
  const [view, setView] = useState<View>('gap')

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
      if (!r || !r.met || r.cappedAttainment == null) continue
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

  const kpiHead = (extra?: string) =>
    cn('text-center text-2xs font-semibold uppercase leading-tight tracking-wide text-ink-muted', extra)

  // ----- "To 80%" view: clean read-only progress + payout -----
  const gapCols = `minmax(168px,1.1fr) repeat(${kpis.length}, minmax(96px,1fr)) 132px`
  const gapView = (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] overflow-hidden rounded-xl border border-line">
        <div className="grid items-end gap-2 border-b border-line bg-surface-2/50 px-3 py-2.5" style={{ gridTemplateColumns: gapCols }}>
          <span className="eyebrow self-end">Member</span>
          {kpis.map((k) => (
            <span key={k.id} className={kpiHead()}>{k.name}</span>
          ))}
          <span className="justify-self-end self-end text-2xs font-semibold uppercase tracking-wide text-brand-ink">Bonus</span>
        </div>
        <div className="divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className="grid items-center gap-2 px-3 py-2.5 transition-colors hover:bg-surface-2/30" style={{ gridTemplateColumns: gapCols }}>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar initials={m.initials} color={m.color} avatar={m.avatar} size="sm" />
                <span className="truncate text-sm font-medium text-ink">{m.name}</span>
              </span>
              {kpis.map((k) => {
                const r = rowMap[m.id]?.[k.id]
                const g = r ? gapTo80(r) : { met: false, scored: false, amount: '', word: '' }
                return (
                  <span key={k.id} className="text-center text-sm">
                    {!g.scored ? (
                      <span className="text-ink-muted">—</span>
                    ) : g.met ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-good">
                        <Check size={14} strokeWidth={3} /> met
                      </span>
                    ) : (
                      <span className="font-medium text-warn">
                        <span className="tnum font-semibold">{g.amount}</span>{' '}
                        <span className="text-2xs text-ink-muted">{g.word}</span>
                      </span>
                    )}
                  </span>
                )
              })}
              <span className="tnum justify-self-end text-base font-semibold text-ink">{eur(liveFinal(m.id))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ----- "Weights" view: a distinct settings area for the plan -----
  const planCols = `minmax(168px,1.1fr) repeat(${kpis.length}, minmax(96px,1fr)) 48px 96px 116px`
  const planView = (
    <div className="rounded-xl border border-line-strong bg-surface-2/40 p-3">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal size={16} className="text-brand" />
        <h3 className="font-display text-sm font-semibold text-ink">Configure the bonus plan</h3>
        <span className="ml-auto text-2xs text-ink-muted">Weights should add up to 100% per person</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[820px] overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid items-end gap-2 border-b border-line bg-surface-2/50 px-3 py-2.5" style={{ gridTemplateColumns: planCols }}>
            <span className="eyebrow self-end">Member</span>
            {kpis.map((k) => (
              <span key={k.id} className={kpiHead()}>{k.name}</span>
            ))}
            <span className="self-end text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted">Σ%</span>
            <span className="self-end text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted">Base €</span>
            <span className="justify-self-end self-end text-2xs font-semibold uppercase tracking-wide text-brand-ink">Final €</span>
          </div>
          <div className="divide-y divide-line">
            {members.map((m) => {
              const sum = weightSum(m.id)
              return (
                <div key={m.id} className="grid items-center gap-2 px-3 py-2.5" style={{ gridTemplateColumns: planCols }}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar initials={m.initials} color={m.color} avatar={m.avatar} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                  </span>
                  {kpis.map((k) => {
                    const r = rowMap[m.id]?.[k.id]
                    const att = r?.cappedAttainment ?? null
                    const capped = att != null && att >= BONUS_CAP
                    const below = att != null && att < BONUS_THRESHOLD
                    return (
                      <div key={k.id} className="flex flex-col items-center gap-0.5">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          aria-label={`${m.name} · ${k.name} weight %`}
                          value={weights[wKey(m.id, k.id)] ?? ''}
                          onChange={(e) => setWeights((v) => ({ ...v, [wKey(m.id, k.id)]: e.target.value }))}
                          className={weightInput}
                        />
                        <span
                          className={cn('text-2xs', below ? 'font-semibold text-bad' : capped ? 'font-semibold text-good' : 'text-ink-muted')}
                          title={below ? 'Below 80% — this KPI pays €0' : undefined}
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
                  <span className="tnum justify-self-end text-sm font-semibold text-ink">{eur(liveFinal(m.id))}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" size="md" onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saving…' : 'Save bonus plan'}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {view === 'gap'
            ? 'How far each person is from earning each KPI, and their bonus so far.'
            : 'Set how the bonus is split and how much each person can earn.'}
        </p>
        <SegmentedControl
          ariaLabel="Table view"
          size="sm"
          segments={[
            { value: 'gap', label: 'To 80%' },
            { value: 'plan', label: 'Weights' },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />
      </div>

      {view === 'gap' ? gapView : planView}

      {/* Team total + explanation — collapsed by default. */}
      <details className="group rounded-xl border border-line bg-surface px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink-soft marker:content-none">
          <span>Team total &amp; how it works</span>
          <ChevronDown size={16} className="text-ink-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="flex items-baseline justify-between">
            <span className="text-sm text-ink-soft">Team total this month</span>
            <span className="tnum font-display text-lg font-semibold text-ink">{eur(teamTotal)}</span>
          </p>
          <p className="text-2xs leading-relaxed text-ink-muted">
            Each KPI pays its <strong className="font-semibold text-ink-soft">weight × base bonus</strong>, scaled by how
            the person did this month. A KPI only pays once it reaches{' '}
            <strong className="font-semibold text-ink-soft">{Math.round(BONUS_THRESHOLD * 100)}%</strong>, and never more
            than <strong className="font-semibold text-ink-soft">{Math.round(BONUS_CAP * 100)}%</strong> of its share.
          </p>
        </div>
      </details>
    </div>
  )
}
