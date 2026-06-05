import { useState, type FormEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Separate, page-specific password. Set VITE_BONUS_PASSWORD in your env
// (e.g. Netlify) for production; defaults to "bonus" for local/demo.
// Note: this is a soft client-side gate to keep casual viewers out — not a
// substitute for real per-user access control.
const BONUS_PASSWORD = import.meta.env.VITE_BONUS_PASSWORD || 'bonus'

/**
 * Gates its children behind a separate bonus password. The unlock lives only in
 * component state (no persistence), so leaving the page re-locks it — returning
 * always re-prompts for the password.
 */
export function BonusGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  function submit(e: FormEvent) {
    e.preventDefault()
    if (pw === BONUS_PASSWORD) {
      setUnlocked(true)
    } else {
      setError(true)
    }
  }

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft">
            <Lock size={20} className="text-brand" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight text-ink">Team Bonus</h2>
            <p className="text-sm text-ink-muted">Enter the bonus password to continue.</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value)
            setError(false)
          }}
          placeholder="Password"
          aria-label="Bonus password"
          className="mb-2 h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {error && <p className="mb-2 text-xs font-medium text-bad">Incorrect password.</p>}
        <Button variant="primary" size="md" type="submit" className="w-full">
          Unlock
        </Button>
      </form>
    </div>
  )
}
