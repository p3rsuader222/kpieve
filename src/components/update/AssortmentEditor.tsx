import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, Plus, Save, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { activeMembers, memberMarketId } from '@/lib/metrics'
import type { DashboardData } from '@/lib/types'
import { usingMockData } from '@/data/datasource'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Flag } from '@/components/ui/Flag'

interface Props {
  data: DashboardData
  period: string // month start
}

interface Row {
  tempKey: string
  id?: string
  name: string
  planned: string
  activated: string
  note: string
}

let tempSeq = 0
const cell =
  'tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30'

function n(v: string): number {
  const x = Number(v)
  return Number.isNaN(x) ? 0 : x
}

/** Bar (≤100 planned → 80%, >100 → 50%) and pass/fail for a single row. */
function evalRow(planned: number, activated: number): { bar: number; pct: number | null; passed: boolean } {
  if (planned <= 0) return { bar: 0, pct: null, passed: false }
  const bar = planned <= 100 ? 0.8 : 0.5
  const pct = activated / planned
  return { bar, pct, passed: pct >= bar }
}

export function AssortmentEditor({ data, period }: Props) {
  const members = activeMembers(data)
  const m = useConfigMutations()
  const toast = useToast()

  const [memberId, setMemberId] = useState(members[0]?.id ?? '')
  const [rows, setRows] = useState<Row[]>([])

  const member = members.find((x) => x.id === memberId)
  const marketId = member ? memberMarketId(member) : null
  const market = marketId ? data.markets.find((mk) => mk.id === marketId) : undefined

  // Seed local rows from saved sellers for this member + month.
  useEffect(() => {
    const seeded = data.assortmentSellers
      .filter((s) => s.member_id === memberId && s.period === period)
      .map((s): Row => ({
        tempKey: `s-${s.id}`,
        id: s.id,
        name: s.name ?? '',
        planned: String(s.planned_skus),
        activated: String(s.activated_skus),
        note: s.note ?? '',
      }))
    setRows(seeded)
  }, [data.assortmentSellers, memberId, period])

  const summary = useMemo(() => {
    const considered = rows.map((r) => evalRow(n(r.planned), n(r.activated))).filter((e) => e.pct != null)
    const passed = considered.filter((e) => e.passed).length
    return { total: considered.length, passed, pct: considered.length ? (passed / considered.length) * 100 : null }
  }, [rows])

  function update(tempKey: string, field: keyof Row, value: string) {
    setRows((rs) => rs.map((r) => (r.tempKey === tempKey ? { ...r, [field]: value } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, { tempKey: `new-${tempSeq++}`, name: '', planned: '', activated: '', note: '' }])
  }

  async function removeRow(row: Row) {
    if (row.id) {
      if (usingMockData) {
        toast.info('Demo mode — connect Supabase to edit sellers.')
        return
      }
      try {
        await m.deleteAssortmentSeller.mutateAsync(row.id)
        toast.success('Seller removed.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed.')
        return
      }
    }
    setRows((rs) => rs.filter((r) => r.tempKey !== row.tempKey))
  }

  async function save() {
    if (!member || !marketId) return
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to save sellers.')
      return
    }
    const payload = rows
      .filter((r) => n(r.planned) > 0 || r.name.trim())
      .map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        member_id: member.id,
        market_id: marketId,
        period,
        name: r.name.trim() || null,
        planned_skus: Math.round(n(r.planned)),
        activated_skus: Math.round(n(r.activated)),
        note: r.note.trim() || null,
      }))
    if (payload.length === 0) {
      toast.info('Add at least one seller with a planned SKU count.')
      return
    }
    try {
      for (const row of payload) await m.saveAssortmentSeller.mutateAsync(row)
      toast.success(`Saved ${payload.length} seller${payload.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.')
    }
  }

  const saving = m.saveAssortmentSeller.isPending

  return (
    // Form editor — content-width, not page-width: seller inputs stay next to names.
    <div className="max-w-[880px] space-y-3">
      {/* Member picker */}
      <div className="flex flex-wrap items-center gap-1.5">
        {members.map((mem) => {
          const on = mem.id === memberId
          const mkt = data.markets.find((x) => x.id === memberMarketId(mem))
          return (
            <button
              key={mem.id}
              onClick={() => setMemberId(mem.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors',
                on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-muted hover:text-ink',
              )}
            >
              <Avatar initials={mem.initials} color={mem.color} avatar={mem.avatar} size="sm" />
              <span className="truncate">{mem.name}</span>
              {mkt && <Flag code={mkt.code} size={15} />}
            </button>
          )
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between rounded-xl bg-brand-soft/50 px-3 py-2">
        <span className="text-sm text-ink-soft">
          {member?.name}
          {market ? ` · ${market.code}` : ''} · {format(parseISO(period), 'MMM yyyy')}
        </span>
        <span className="text-sm">
          <span className="font-semibold text-ink">{summary.passed}</span>
          <span className="text-ink-muted"> / {summary.total} passed</span>
          <span className="tnum ml-2 font-display text-base font-semibold text-brand">
            {summary.pct == null ? '—' : `${Math.round(summary.pct)}%`}
          </span>
        </span>
      </div>

      {/* Seller rows */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-[1.4fr_84px_84px_96px_36px] items-center gap-2 border-b border-line bg-surface-2/50 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
          <span>Seller</span>
          <span className="text-center">Planned</span>
          <span className="text-center">Activated</span>
          <span className="text-center">Result</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-ink-muted">No sellers yet — add one to start tracking.</p>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r) => {
              const e = evalRow(n(r.planned), n(r.activated))
              return (
                <div key={r.tempKey} className="grid grid-cols-[1.4fr_84px_84px_96px_36px] items-center gap-2 px-3 py-2">
                  <input
                    value={r.name}
                    onChange={(ev) => update(r.tempKey, 'name', ev.target.value)}
                    placeholder="Seller name"
                    className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <input type="number" inputMode="numeric" value={r.planned} onChange={(ev) => update(r.tempKey, 'planned', ev.target.value)} placeholder="SKUs" className={cell} />
                  <input type="number" inputMode="numeric" value={r.activated} onChange={(ev) => update(r.tempKey, 'activated', ev.target.value)} placeholder="0" className={cell} />
                  <span className="flex items-center justify-center">
                    {e.pct == null ? (
                      <span className="text-2xs text-ink-muted">—</span>
                    ) : e.passed ? (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-good">
                        <Check size={13} strokeWidth={3} /> {Math.round(e.pct * 100)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-bad">
                        <X size={12} strokeWidth={3} /> {Math.round(e.pct * 100)}%
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => removeRow(r)}
                    aria-label="Remove seller"
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-bad-soft hover:text-bad"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="subtle" size="sm" onClick={addRow}>
          <Plus size={15} /> Add seller
        </Button>
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save sellers'}
        </Button>
      </div>
      <p className="text-2xs text-ink-muted">
        Bar is automatic: ≤100 planned SKUs needs ≥80% activated; &gt;100 needs ≥50%. The % passed feeds the{' '}
        <strong className="font-medium text-ink-soft">Planned assortment completeness</strong> KPI.
      </p>
    </div>
  )
}
