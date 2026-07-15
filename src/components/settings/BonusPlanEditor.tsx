import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Copy, Save } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeKpis, activeMembers, memberMarketId, prevPeriod } from '@/lib/metrics'
import type { BonusRole, DashboardData, Market } from '@/lib/types'
import type { BonusBaseUpsert, KpiMarketConfigUpsert } from '@/data/datasource'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

interface Props {
  data: DashboardData
  period: string // controlled by the parent (the Team Bonus month nav)
  saving: boolean
  onSave: (config: KpiMarketConfigUpsert[], base: BonusBaseUpsert[]) => void
}

const key = (marketId: string, kpiId: string) => `${marketId}:${kpiId}`
const numInput =
  'tnum h-9 w-20 rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'
const numInputSm =
  'tnum h-9 w-16 rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink placeholder:text-ink-muted/50 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

function num(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

/** Parse a percent input, falling back when blank/invalid/negative. */
function numOr(v: string | undefined, fallback: number): number {
  if (!v || v.trim() === '') return fallback
  const n = Number(v)
  return Number.isNaN(n) || n < 0 ? fallback : n
}

export function BonusPlanEditor({ data, period, saving, onSave }: Props) {
  const kpis = activeKpis(data)
  const members = activeMembers(data)
  const markets = useMemo(() => [...data.markets].sort((a, z) => a.sort_order - z.sort_order), [data.markets])

  const [marketId, setMarketId] = useState(markets[0]?.id ?? '')

  const [roles, setRoles] = useState<Record<string, BonusRole>>({})
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [rates, setRates] = useState<Record<string, string>>({})
  const [floors, setFloors] = useState<Record<string, string>>({})
  const [caps, setCaps] = useState<Record<string, string>>({})
  const [bases, setBases] = useState<Record<string, string>>({})

  // Load the editor state for `period` from the saved plan.
  function loadFrom(srcPeriod: string) {
    const r: Record<string, BonusRole> = {}
    const w: Record<string, string> = {}
    const rt: Record<string, string> = {}
    const fl: Record<string, string> = {}
    const cp: Record<string, string> = {}
    for (const mk of markets) {
      for (const k of kpis) {
        const row = data.kpiMarketConfig.find(
          (c) => c.period === srcPeriod && c.market_id === mk.id && c.kpi_id === k.id,
        )
        const kk = key(mk.id, k.id)
        r[kk] = row?.role ?? 'core'
        w[kk] = row && row.weight ? String(row.weight) : ''
        rt[kk] = row && row.eur_rate ? String(row.eur_rate) : ''
        fl[kk] = row ? String(row.floor_pct) : '80'
        cp[kk] = row ? String(row.cap_pct) : '150'
      }
    }
    const b: Record<string, string> = {}
    for (const m of members) {
      const row = data.bonusBase.find((x) => x.period === srcPeriod && x.member_id === m.id)
      b[m.id] = row && row.max_bonus ? String(row.max_bonus) : ''
    }
    setRoles(r)
    setWeights(w)
    setRates(rt)
    setFloors(fl)
    setCaps(cp)
    setBases(b)
  }

  useEffect(() => {
    loadFrom(period)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, period])

  const marketMembers = members.filter((m) => memberMarketId(m) === marketId)
  const coreWeightSum = kpis.reduce(
    (s, k) => s + (roles[key(marketId, k.id)] === 'core' ? num(weights[key(marketId, k.id)]) : 0),
    0,
  )

  function setRole(kpiId: string, role: BonusRole) {
    setRoles((r) => ({ ...r, [key(marketId, kpiId)]: role }))
  }

  function save() {
    const config: KpiMarketConfigUpsert[] = []
    for (const mk of markets) {
      for (const k of kpis) {
        const kk = key(mk.id, k.id)
        const role = roles[kk] ?? 'core'
        config.push({
          period,
          market_id: mk.id,
          kpi_id: k.id,
          role,
          weight: num(weights[kk]),
          eur_rate: role === 'additional' ? num(rates[kk]) : 0,
          floor_pct: numOr(floors[kk], 80),
          cap_pct: numOr(caps[kk], 150),
        })
      }
    }
    const base: BonusBaseUpsert[] = members.map((m) => ({ period, member_id: m.id, max_bonus: num(bases[m.id]) }))
    onSave(config, base)
  }

  const monthLabel = format(parseISO(period), 'MMMM yyyy')
  const market = markets.find((m) => m.id === marketId) as Market | undefined

  return (
    // Form editor — content-width, not page-width: rows keep their controls
    // next to the KPI names instead of drifting across a wide screen.
    <div className="max-w-[1040px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-soft">
          Plan for <strong className="font-semibold text-ink">{monthLabel}</strong>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => loadFrom(prevPeriod(period))} title="Copy weights, rates and base pools from the previous month">
            <Copy size={14} /> Copy previous month
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving…' : 'Save plan'}
          </Button>
        </div>
      </div>

      <SegmentedControl
        ariaLabel="Market"
        size="sm"
        segments={markets.map((m) => ({ value: m.id, label: m.code }))}
        value={marketId}
        onChange={setMarketId}
      />

      {/* Per-market KPI roles + weights/rates */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/50 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {market && <Flag code={market.code} size={18} />}
            {market?.name} — KPI plan for {monthLabel}
          </span>
          <span className={cn('tnum text-2xs font-semibold', coreWeightSum === 100 ? 'text-ink-muted' : 'text-warn')}>
            weights Σ {coreWeightSum}% {coreWeightSum === 100 ? '' : '(should be 100)'}
          </span>
        </div>
        <div className="border-b border-line bg-surface px-3 py-2 text-2xs leading-relaxed text-ink-muted">
          <strong className="font-semibold text-ink-soft">Core</strong> = mandatory — a weight % of the bonus pool;
          weights should add up to 100%. <strong className="font-semibold text-ink-soft">Additional</strong> =
          non-mandatory, pays on top of the pool: a % scored like core and/or a flat € per qualifying seller (use either
          or both). <strong className="font-semibold text-ink-soft">Floor</strong>/
          <strong className="font-semibold text-ink-soft">cap</strong> set per row where the % part starts paying and
          where its attainment stops counting.
        </div>
        <div className="divide-y divide-line">
          {kpis.map((k) => {
            const kk = key(marketId, k.id)
            const role = roles[kk] ?? 'core'
            return (
              <div key={k.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium text-ink" title={k.name}>{k.name}</span>
                <SegmentedControl
                  ariaLabel={`${k.name} role`}
                  size="sm"
                  segments={[
                    { value: 'core', label: 'Core' },
                    { value: 'additional', label: 'Additional' },
                  ]}
                  value={role}
                  onChange={(v) => setRole(k.id, v as BonusRole)}
                />
                <span className="flex items-center justify-end gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`${k.name} weight %`}
                    value={weights[kk] ?? ''}
                    onChange={(e) => setWeights((w) => ({ ...w, [kk]: e.target.value }))}
                    placeholder="0"
                    className={numInput}
                  />
                  <span className="w-14 text-2xs text-ink-muted">{role === 'additional' ? '% on top' : '% of pool'}</span>
                </span>
                {role === 'additional' ? (
                  <span className="flex items-center justify-end gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      aria-label={`${k.name} € per seller`}
                      value={rates[kk] ?? ''}
                      onChange={(e) => setRates((r) => ({ ...r, [kk]: e.target.value }))}
                      placeholder="0"
                      className={numInput}
                    />
                    <span className="w-14 text-2xs text-ink-muted">€/seller</span>
                  </span>
                ) : (
                  /* Same-width spacer so every row's controls align vertically. */
                  <span aria-hidden className="w-[142px]" />
                )}
                <span className="flex items-center justify-end gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    aria-label={`${k.name} floor %`}
                    value={floors[kk] ?? ''}
                    onChange={(e) => setFloors((f) => ({ ...f, [kk]: e.target.value }))}
                    placeholder="80"
                    className={numInputSm}
                  />
                  <span className="text-2xs text-ink-muted">floor%</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    aria-label={`${k.name} cap %`}
                    value={caps[kk] ?? ''}
                    onChange={(e) => setCaps((c) => ({ ...c, [kk]: e.target.value }))}
                    placeholder="150"
                    className={numInputSm}
                  />
                  <span className="text-2xs text-ink-muted">cap%</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Base pools for this market's members */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="border-b border-line bg-surface-2/50 px-3 py-2 text-sm font-semibold text-ink">
          Base bonus pool — {market?.name} · {monthLabel}
        </div>
        {marketMembers.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-muted">No members assigned to this market.</p>
        ) : (
          <div className="divide-y divide-line">
            {marketMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar initials={m.initials} color={m.color} avatar={m.avatar} size="sm" />
                  <span className="truncate text-sm font-medium text-ink">{m.name}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-ink-muted">€</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`${m.name} base bonus`}
                    value={bases[m.id] ?? ''}
                    onChange={(e) => setBases((b) => ({ ...b, [m.id]: e.target.value }))}
                    className={numInput}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-2xs text-ink-muted">
        Final payout = base pool × core weights (mandatory) + additional bonuses on top (% parts scaled by attainment
        within each row's floor/cap; €/seller parts gated on a 1st active offer). Saved per month — use{' '}
        <strong className="font-medium text-ink-soft">Copy previous month</strong> to roll a plan forward.
      </p>
    </div>
  )
}
