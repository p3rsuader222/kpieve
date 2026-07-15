import { useEffect, useState } from 'react'
import type { Kpi, KpiAggregation, KpiDirection, KpiFormat } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open: boolean
  kpi: Kpi | null
  saving: boolean
  onClose: () => void
  onSubmit: (values: Partial<Kpi> & { id?: string }) => void
}

const blank = {
  name: '',
  description: '',
  unit: '',
  format: 'number' as KpiFormat,
  direction: 'higher_better' as KpiDirection,
  aggregation: 'sum' as KpiAggregation,
  default_target: '',
  active: true,
  additional: false,
  risk_grace: '20',
}

export function KpiEditor({ open, kpi, saving, onClose, onSubmit }: Props) {
  const [f, setF] = useState(blank)

  useEffect(() => {
    if (!open) return
    setF(
      kpi
        ? {
            name: kpi.name,
            description: kpi.description ?? '',
            unit: kpi.unit ?? '',
            format: kpi.format,
            direction: kpi.direction,
            aggregation: kpi.aggregation,
            default_target: kpi.default_target == null ? '' : String(kpi.default_target),
            active: kpi.active,
            additional: kpi.additional,
            risk_grace: String(kpi.risk_grace ?? 20),
          }
        : blank,
    )
  }, [open, kpi])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }))

  function submit() {
    if (!f.name.trim()) return
    const grace = Number(f.risk_grace)
    onSubmit({
      ...(kpi ? { id: kpi.id } : {}),
      name: f.name.trim(),
      description: f.description.trim() || null,
      unit: f.unit.trim() || null,
      format: f.format,
      direction: f.direction,
      aggregation: f.aggregation,
      default_target: f.default_target.trim() === '' ? null : Number(f.default_target),
      active: f.active,
      additional: f.additional,
      risk_grace: f.risk_grace.trim() === '' || Number.isNaN(grace) || grace < 0 ? 20 : grace,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kpi ? 'Edit KPI' : 'New KPI'}
      description="Define how this metric is measured and what target counts as on-track."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !f.name.trim()}>
            {saving ? 'Saving…' : 'Save KPI'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Clients onboarded" autoFocus />
        <Input label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Short explanation (optional)" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Format"
            value={f.format}
            onChange={(e) => set('format', e.target.value as KpiFormat)}
            options={[
              { value: 'number', label: 'Number' },
              { value: 'percent', label: 'Percent (%)' },
              { value: 'currency', label: 'Currency (€)' },
              { value: 'duration', label: 'Duration (min)' },
            ]}
          />
          <Select
            label="Better when"
            value={f.direction}
            onChange={(e) => set('direction', e.target.value as KpiDirection)}
            options={[
              { value: 'higher_better', label: 'Higher is better' },
              { value: 'lower_better', label: 'Lower is better' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Roll up by"
            value={f.aggregation}
            onChange={(e) => set('aggregation', e.target.value as KpiAggregation)}
            options={[
              { value: 'sum', label: 'Sum (totals)' },
              { value: 'avg', label: 'Average (rates)' },
            ]}
          />
          <Input label="Unit (optional)" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="e.g. clients, / 5" />
        </div>
        <div className="flex items-end justify-between gap-3">
          <Input
            label="Default target (per country · month)"
            type="number"
            step="any"
            value={f.default_target}
            onChange={(e) => set('default_target', e.target.value)}
            placeholder="e.g. 3"
            className="max-w-[60%]"
          />
          <div className="flex items-center gap-2.5 pb-2">
            <Toggle checked={f.active} onChange={(v) => set('active', v)} ariaLabel="Active" />
            <span className="text-sm font-medium text-ink-soft">Active</span>
          </div>
        </div>
        {f.direction === 'lower_better' && (
          <div>
            <Input
              label="At-risk margin (%)"
              type="number"
              step="any"
              min={0}
              value={f.risk_grace}
              onChange={(e) => set('risk_grace', e.target.value)}
              placeholder="20"
              className="max-w-[60%]"
            />
            <p className="mt-1.5 text-2xs text-ink-muted">
              How far past the bar still counts as "at risk" before failing — e.g. target 5% with a 20% margin:
              up to 6% is at risk, beyond fails. At or under the bar is always achieved.
            </p>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Additional (non-mandatory)</p>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Tagged as additional across the app — scoring and adherence are unaffected.
            </p>
          </div>
          <Toggle checked={f.additional} onChange={(v) => set('additional', v)} ariaLabel="Additional (non-mandatory)" />
        </div>
      </div>
    </Modal>
  )
}
