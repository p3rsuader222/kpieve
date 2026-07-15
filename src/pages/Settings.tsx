import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, Database, Gauge, Pencil, Plus, ShieldCheck, Target, Trash2, Users } from 'lucide-react'
import { activeKpis } from '@/lib/metrics'
import { formatValue } from '@/lib/format'
import type { Kpi, Member } from '@/lib/types'
import { usingMockData } from '@/data/datasource'
import { useDashboard } from '@/hooks/useDashboard'
import { useBonusLock } from '@/hooks/useBonusLock'
import { useConfigMutations } from '@/hooks/useConfigMutations'
import { usePersistentState } from '@/hooks/usePersistentState'
import { useToast } from '@/components/ui/Toast'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { TabBar, tabPanelProps, type TabItem } from '@/components/ui/TabBar'
import { Toggle } from '@/components/ui/Toggle'
import { verifyBonusPassword } from '@/lib/bonusAccess'
import { KpiEditor } from '@/components/settings/KpiEditor'
import { MemberEditor } from '@/components/settings/MemberEditor'
import { TargetEditor } from '@/components/settings/TargetEditor'
import type { TargetUpsert } from '@/data/datasource'

const FORMAT_LABEL: Record<Kpi['format'], string> = {
  number: 'Number',
  percent: 'Percent',
  currency: 'Currency',
  duration: 'Duration',
}

type SettingsTab = 'targets' | 'kpis' | 'team' | 'access'
const TAB_IDS: SettingsTab[] = ['targets', 'kpis', 'team', 'access']

const TAB_BLURB: Record<SettingsTab, string> = {
  targets: 'The official monthly goal per country — the Dashboard and Team Bonus score against these.',
  kpis: 'What the team tracks: formats, directions, targets and per-KPI scoring rules.',
  team: 'Who is on the team and which markets each person owns.',
  access: 'Privacy controls for sensitive pages.',
}

export function Settings() {
  const { data, isLoading } = useDashboard()
  const m = useConfigMutations()
  const toast = useToast()
  const bonusLock = useBonusLock()

  const [kpiOpen, setKpiOpen] = useState(false)
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  // The open section is remembered across visits (guard against stale keys).
  const [tabRaw, setTab] = usePersistentState<SettingsTab>('kpieve-settings-tab', 'targets')
  const tab: SettingsTab = TAB_IDS.includes(tabRaw) ? tabRaw : 'targets'

  // Disabling the Team Bonus lock requires the access code (turning it on doesn't).
  const [lockPromptOpen, setLockPromptOpen] = useState(false)
  const [lockCode, setLockCode] = useState('')
  const [lockError, setLockError] = useState(false)

  function onToggleLock(next: boolean) {
    if (next) {
      bonusLock.setLocked(true)
      return
    }
    setLockCode('')
    setLockError(false)
    setLockPromptOpen(true)
  }

  function confirmDisableLock() {
    if (verifyBonusPassword(lockCode)) {
      bonusLock.setLocked(false)
      setLockPromptOpen(false)
    } else {
      setLockError(true)
    }
  }

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
  // ----- Target handlers -----
  async function saveTargets(rows: TargetUpsert[]) {
    if (!guard()) return
    if (rows.length === 0) {
      toast.info('Nothing to save yet.')
      return
    }
    try {
      await m.upsertTargets.mutateAsync(rows)
      toast.success(`Saved ${rows.length} target${rows.length === 1 ? '' : 's'}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save targets.')
    }
  }

  async function deleteTargets(period: string) {
    if (!guard()) return
    const label = format(new Date(period), 'MMMM yyyy')
    if (!window.confirm(`Delete all per-country targets for ${label}? This cannot be undone.`)) return
    try {
      await m.deleteTargets.mutateAsync(period)
      toast.success(`Cleared targets for ${label}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete targets.')
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

  const tabs: TabItem<SettingsTab>[] = [
    { id: 'targets', label: 'Targets', icon: <Target size={15} /> },
    { id: 'kpis', label: 'KPIs', icon: <Gauge size={15} />, count: kpis.length },
    { id: 'team', label: 'Team', icon: <Users size={15} />, count: members.length },
    { id: 'access', label: 'Access', icon: <ShieldCheck size={15} /> },
  ]

  return (
    // Config forms — capped at a readable width; data-grid pages stay wide.
    <div className="max-w-[1280px] space-y-4">
      <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="mt-1 font-heading text-[1.6rem] font-semibold leading-none tracking-tight text-ink">Settings</h1>
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

      {/* Section tabs — the open one is remembered across visits. */}
      <div>
        <TabBar ariaLabel="Settings sections" tabs={tabs} value={tab} onChange={setTab} />
        <p className="mt-3 text-sm text-ink-muted">{TAB_BLURB[tab]}</p>
      </div>

      {/* Targets (editor) + Markets (reference) */}
      {tab === 'targets' && (
        <div {...tabPanelProps('targets')} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2" eyebrow="Per country · per month" title="Targets">
            <TargetEditor
              data={data}
              saving={m.upsertTargets.isPending}
              deleting={m.deleteTargets.isPending}
              onSave={saveTargets}
              onDelete={deleteTargets}
            />
          </Panel>
          <Panel eyebrow="Reference" title="Markets">
            <div className="flex flex-wrap gap-2">
              {markets.map((mk) => (
                <span key={mk.id} className="chip text-ink-soft">
                  {mk.code} · {mk.name}
                </span>
              ))}
            </div>
            <p className="mt-3 text-2xs text-ink-muted">
              The LT · LV · EE · PL markets are seeded in the database. Assign them to members in the Team tab.
            </p>
          </Panel>
        </div>
      )}

      {/* KPIs */}
      {tab === 'kpis' && (
      <div {...tabPanelProps('kpis')} className="max-w-[820px]">
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
                  {k.additional && <span className="chip shrink-0">Additional</span>}
                  {!k.active && <span className="chip shrink-0">Hidden</span>}
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
      </div>
      )}

      {/* Members */}
      {tab === 'team' && (
      <div {...tabPanelProps('team')} className="max-w-[820px]">
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
              <Avatar initials={mem.initials} color={mem.color} avatar={mem.avatar} size="md" />
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
      </div>
      )}

      {/* Privacy */}
      {tab === 'access' && (
      <div {...tabPanelProps('access')} className="max-w-[820px]">
      <Panel eyebrow="Privacy" title="Team Bonus access">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Require an access code to open Team Bonus</p>
            <p className="mt-0.5 text-2xs text-ink-muted">
              When on, the Team Bonus page is gated by the access code each visit. Turning it off asks for the code once.
            </p>
          </div>
          <Toggle
            checked={bonusLock.locked}
            onChange={onToggleLock}
            ariaLabel="Require an access code for Team Bonus"
          />
        </div>
      </Panel>
      </div>
      )}

      <KpiEditor open={kpiOpen} kpi={editingKpi} saving={m.saveKpi.isPending} onClose={() => setKpiOpen(false)} onSubmit={submitKpi} />
      <MemberEditor
        open={memberOpen}
        member={editingMember}
        markets={markets}
        saving={m.saveMember.isPending}
        onClose={() => setMemberOpen(false)}
        onSubmit={submitMember}
      />

      <Modal
        open={lockPromptOpen}
        onClose={() => setLockPromptOpen(false)}
        title="Confirm with the access code"
        description="Enter the Team Bonus code to turn the lock off."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLockPromptOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmDisableLock} disabled={!lockCode.trim()}>
              Turn off lock
            </Button>
          </>
        }
      >
        <Input
          type="password"
          label="Access code"
          value={lockCode}
          onChange={(e) => {
            setLockCode(e.target.value)
            setLockError(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmDisableLock()
          }}
          autoFocus
          placeholder="••••"
        />
        {lockError && <p className="mt-2 text-xs font-medium text-bad">Wrong code — try again.</p>}
      </Modal>
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
