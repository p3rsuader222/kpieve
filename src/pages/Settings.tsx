import { useState } from 'react'
import { ArrowDown, ArrowUp, Database, Pencil, Plus, Trash2 } from 'lucide-react'
import { activeKpis } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { Kpi, Member } from '@/lib/types'
import { usingMockData } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toggle } from '@/components/ui/Toggle'
import { KpiEditor } from '@/components/settings/KpiEditor'
import { MemberEditor } from '@/components/settings/MemberEditor'

const FORMAT_LABEL: Record<Kpi['format'], string> = {
  number: 'Number',
  percent: 'Percent',
  currency: 'Currency',
  duration: 'Duration',
}

export function Settings() {
  const { data, isLoading } = useDashboard()
  const m = useConfigMutations()
  const toast = useToast()

  const [kpiOpen, setKpiOpen] = useState(false)
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  function guard(): boolean {
    if (usingMockData) {
      toast.info('Demo mode — connect Supabase to edit configuration.')
      return false
    }
    return true
  }

  if (isLoading || !data) return <SettingsSkeleton />

  const kpis = [...data.kpis].sort((a, z) => a.sort_order - z.sort_order)
  const members = [...data.members].sort((a, z) => a.sort_order - z.sort_order)
  const markets = [...data.markets].sort((a, z) => a.sort_order - z.sort_order)
  const nextKpiOrder = kpis.length ? Math.max(...kpis.map((k) => k.sort_order)) + 1 : 1
  const nextMemberOrder = members.length ? Math.max(...members.map((x) => x.sort_order)) + 1 : 1

  // ----- KPI handlers -----
  function openNewKpi() {
    if (!guard()) return
    setEditingKpi(null)
    setKpiOpen(true)
  }
  function openEditKpi(k: Kpi) {
    if (!guard()) return
    setEditingKpi(k)
    setKpiOpen(true)
  }
  async function submitKpi(values: Partial<Kpi> & { id?: string }) {
    try {
      await m.saveKpi.mutateAsync({ ...values, ...(values.id ? {} : { sort_order: nextKpiOrder }) })
      toast.success(values.id ? 'KPI updated.' : 'KPI added.')
      setKpiOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save KPI.')
    }
  }
  async function toggleKpiActive(k: Kpi) {
    if (!guard()) return
    try {
      await m.saveKpi.mutateAsync({ id: k.id, active: !k.active })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.')
    }
  }
  async function removeKpi(k: Kpi) {
    if (!guard()) return
    if (!window.confirm(`Delete "${k.name}"? This removes its historical entries too.`)) return
    try {
      await m.deleteKpi.mutateAsync(k.id)
      toast.success('KPI deleted.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  // ----- Member handlers -----
  function openNewMember() {
    if (!guard()) return
    setEditingMember(null)
    setMemberOpen(true)
  }
  function openEditMember(mem: Member) {
    if (!guard()) return
    setEditingMember(mem)
    setMemberOpen(true)
  }
  async function submitMember(args: { member: Partial<Member> & { id?: string }; marketIds: string[] }) {
    try {
      await m.saveMember.mutateAsync({
        member: { ...args.member, ...(args.member.id ? {} : { sort_order: nextMemberOrder }) },
        marketIds: args.marketIds,
      })
      toast.success(args.member.id ? 'Member updated.' : 'Member added.')
      setMemberOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save member.')
    }
  }
  async function removeMember(mem: Member) {
    if (!guard()) return
    if (!window.confirm(`Remove ${mem.name}? Their entries will be deleted.`)) return
    try {
      await m.deleteMember.mutateAsync(mem.id)
      toast.success('Member removed.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Manage KPIs, team members and their markets.</p>
      </div>

      {usingMockData && (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-brand-soft/60 px-4 py-3 text-sm text-ink-soft">
          <Database size={17} className="shrink-0 text-brand" />
          <span>
            <strong className="font-semibold text-ink">Demo mode.</strong> Editing is read-only here until Supabase is
            connected.
          </span>
        </div>
      )}

      {/* KPIs */}
      <Panel
        eyebrow={`${activeKpis(data).length} active`}
        title="KPIs"
        actions={
          <Button variant="primary" size="sm" onClick={openNewKpi}>
            <Plus size={15} /> Add KPI
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {kpis.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{k.name}</span>
                  {!k.active && <span className="chip">Hidden</span>}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-muted">
                  <span>{FORMAT_LABEL[k.format]}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5">
                    {k.direction === 'higher_better' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {k.direction === 'higher_better' ? 'higher better' : 'lower better'}
                  </span>
                  {k.default_target != null && (
                    <>
                      <span>·</span>
                      <span>target {formatValue(k.default_target, k)}</span>
                    </>
                  )}
                </p>
              </div>
              <Toggle checked={k.active} onChange={() => toggleKpiActive(k)} />
              <button onClick={() => openEditKpi(k)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink">
                <Pencil size={15} />
              </button>
              <button onClick={() => removeKpi(k)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Members */}
      <Panel
        eyebrow={`${members.filter((x) => x.active).length} active`}
        title="Team members"
        actions={
          <Button variant="primary" size="sm" onClick={openNewMember}>
            <Plus size={15} /> Add member
          </Button>
        }
      >
        <ul className="divide-y divide-line">
          {members.map((mem) => (
            <li key={mem.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Avatar initials={mem.initials} color={mem.color} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{mem.name}</span>
                  {!mem.active && <span className="chip">Hidden</span>}
                </div>
                <p className="mt-0.5 text-2xs font-medium uppercase tracking-wider text-ink-muted">
                  {mem.marketIds
                    .map((id) => markets.find((mk) => mk.id === id)?.code)
                    .filter(Boolean)
                    .join(' · ') || 'No markets'}
                </p>
              </div>
              <button onClick={() => openEditMember(mem)} aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink">
                <Pencil size={15} />
              </button>
              <button onClick={() => removeMember(mem)} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-bad-soft hover:text-bad">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Markets (reference) */}
      <Panel eyebrow="Reference" title="Markets">
        <div className="flex flex-wrap gap-2">
          {markets.map((mk) => (
            <span key={mk.id} className="chip text-ink-soft">
              {mk.code} · {mk.name}
            </span>
          ))}
        </div>
        <p className="mt-3 text-2xs text-ink-muted">
          The LT · LV · EE · PL markets are seeded in the database. Assign them to members above.
        </p>
      </Panel>

      <KpiEditor open={kpiOpen} kpi={editingKpi} saving={m.saveKpi.isPending} onClose={() => setKpiOpen(false)} onSubmit={submitKpi} />
      <MemberEditor
        open={memberOpen}
        member={editingMember}
        markets={markets}
        saving={m.saveMember.isPending}
        onClose={() => setMemberOpen(false)}
        onSubmit={submitMember}
      />
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  )
}
