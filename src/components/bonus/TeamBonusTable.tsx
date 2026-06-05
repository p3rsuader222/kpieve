import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, activeMembers, teamBonus, BONUS_CAP } from '@/lib/metrics'
import { formatPercent, formatValue } from '@/lib/format'
import type { DashboardData } from '@/lib/types'
import type { BonusSettingUpsert, BonusWeightUpsert } from '@/data/datasource'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'

interface Props {
  data: DashboardData
  period: string
  saving: boolean
  onSave: (weights: BonusWeightUpsert[], settings: BonusSettingUpsert[]) => void
}

const wKey = (memberId: string, kpiId: string) => `${memberId}:${kpiId}`
const eur = (n: number) => formatValue(n, { format: 'currency' })

function num(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

const inputCls =
  'tnum h-9 w-full rounded-lg border border-line bg-surface px-1 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

/** Editable member × KPI weight grid with max bonus and live final bonus. */
export function TeamBonusTable({ data, period, saving, onSave }: Props) {
  const kpis = activeKpis(data)
  const members = activeMembers(data)
  const bonus = useMemo(() => teamBonus(data, period), [data, period])

  // Capped attainment per member×KPI (this drives the payout; comes from data).
  const attMap = useMemo(() => {
    const m: Record<string, Record<string, number | null>> = {}
    for (const mb of bonus) {
      m[mb.member.id] = {}
      for (const k of mb.kpis) m[mb.member.id][k.kpi.id] = k.cappedAttainment
    }
    return m
  }, [bonus])

  const [weights, setWeights] = useState<Record<string, string>>({})
  const [maxes, setMaxes] = useState<Record<string, string>>({})

  // Weights/max are config (not period-specific) — prefill when data changes.
  useEffect(() => {
    const w: Record<string, string> = {}
    for (const m of members) {
      for (const k of kpis) {
        const row = data.bonusWeights.find((b) => b.member_id === m.id && b.kpi_id === k.id)
        w[wKey(m.id, k.id)] = row && row.weight ? String(row.weight) : ''
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
      const att = attMap[memberId]?.[k.id]
      if (att == null) continue
      total += ((max * num(weights[wKey(memberId, k.id)])) / 100) * att
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
  const cols = `minmax(150px,1.2fr) repeat(${kpis.length}, 86px) 60px 92px 110px`

  return (
    <div className="card p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* Header */}
          <div
            className="grid items-end gap-2 border-b border-line pb-2 text-center"
            style={{ gridTemplateColumns: cols }}
          >
            <span className="eyebrow justify-self-start self-end">Member</span>
            {kpis.map((k) => (
              <span key={k.id} className="truncate text-2xs font-semibold uppercase tracking-wide text-ink-muted" title={`${k.name} — weight %`}>
                {k.name}
              </span>
            ))}
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Σ%</span>
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">Max €</span>
            <span className="justify-self-end self-end text-2xs font-semibold uppercase tracking-wide text-brand-ink">Final €</span>
          </div>

          {/* Member rows */}
          <div className="divide-y divide-line">
            {members.map((m) => {
              const sum = weightSum(m.id)
              const final = liveFinal(m.id)
              return (
                <div key={m.id} className="grid items-center gap-2 py-2 text-center" style={{ gridTemplateColumns: cols }}>
                  <span className="flex min-w-0 items-center gap-2 justify-self-start">
                    <Avatar initials={m.initials} color={m.color} avatar={m.avatar} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                  </span>

                  {kpis.map((k) => {
                    const att = attMap[m.id]?.[k.id]
                    const capped = att != null && att >= BONUS_CAP
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
                        <span className={cn('text-2xs', capped ? 'font-semibold text-good' : 'text-ink-muted')}>
                          {att != null ? formatPercent(att) : '—'}
                          {capped ? ' cap' : ''}
                        </span>
                      </div>
                    )
                  })}

                  <span className={cn('tnum text-xs font-semibold', sum === 100 ? 'text-ink-muted' : 'text-warn')}>{sum}</span>

                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`${m.name} max bonus`}
                    value={maxes[m.id] ?? ''}
                    onChange={(e) => setMaxes((v) => ({ ...v, [m.id]: e.target.value }))}
                    className={inputCls}
                  />

                  <span className="tnum justify-self-end text-sm font-semibold text-ink">{eur(final)}</span>
                </div>
              )
            })}
          </div>

          {/* Team total */}
          <div className="grid items-center gap-2 border-t-2 border-line-strong pt-2.5 text-center" style={{ gridTemplateColumns: cols }}>
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
          Final = max × Σ(weight × attainment), each KPI capped at {Math.round(BONUS_CAP * 100)}%. The % under each weight
          is that member's attainment for the month.
        </p>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save bonus plan'}
        </Button>
      </div>
    </div>
  )
}
