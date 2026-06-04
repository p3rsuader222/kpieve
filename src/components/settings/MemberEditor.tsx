import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import type { Market, Member } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open: boolean
  member: Member | null
  markets: Market[]
  saving: boolean
  onClose: () => void
  onSubmit: (args: { member: Partial<Member> & { id?: string }; marketIds: string[] }) => void
}

const PALETTE = ['#3457b8', '#0e9488', '#b8567a', '#c2730e', '#7c54c4', '#2f9e44', '#d6336c', '#1098ad']

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function MemberEditor({ open, member, markets, saving, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [active, setActive] = useState(true)
  const [marketIds, setMarketIds] = useState<string[]>([])
  const [touchedInitials, setTouchedInitials] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(member?.name ?? '')
    setInitials(member?.initials ?? '')
    setColor(member?.color ?? PALETTE[0])
    setActive(member?.active ?? true)
    setMarketIds(member?.marketIds ?? [])
    setTouchedInitials(Boolean(member))
  }, [open, member])

  const toggleMarket = (id: string) =>
    setMarketIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]))

  function submit() {
    if (!name.trim()) return
    onSubmit({
      member: {
        ...(member ? { id: member.id } : {}),
        name: name.trim(),
        initials: (initials.trim() || initialsFrom(name)).slice(0, 3),
        color,
        active,
      },
      marketIds,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Edit member' : 'Add member'}
      description="Set the member's details and the markets they cover."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save member'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!touchedInitials) setInitials(initialsFrom(e.target.value))
          }}
          placeholder="e.g. Greta Kazlauskaitė"
          autoFocus
        />
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Input
            label="Initials"
            value={initials}
            onChange={(e) => {
              setTouchedInitials(true)
              setInitials(e.target.value)
            }}
            maxLength={3}
            placeholder="GK"
          />
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Color</span>
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-transform',
                    color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-110',
                  )}
                  style={{ background: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold text-ink-soft">Markets covered</span>
          <div className="flex flex-wrap gap-2">
            {markets.map((m) => {
              const on = marketIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMarket(m.id)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
                    on
                      ? 'border-brand bg-brand text-brand-contrast'
                      : 'border-line bg-surface text-ink-muted hover:text-ink',
                  )}
                >
                  {m.code}
                  <span className="ml-1.5 font-normal opacity-70">{m.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-1">
          <Toggle checked={active} onChange={setActive} label="Active on the dashboard" />
        </div>
      </div>
    </Modal>
  )
}
