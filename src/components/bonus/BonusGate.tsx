import { useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { BONUS_PASSWORD } from '@/lib/bonusAccess'

// A short PIN works best with this per-character entry style.
const LEN = BONUS_PASSWORD.length
const NUMERIC = /^\d+$/.test(BONUS_PASSWORD)

/**
 * PIN-style gate: one box per character, auto-advancing. When the full code is
 * entered correctly it unlocks immediately (no confirm button). The unlock lives
 * only in component state, so leaving the page re-locks it — returning re-prompts.
 */
export function BonusGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [digits, setDigits] = useState<string[]>(() => Array(LEN).fill(''))
  const [error, setError] = useState(false)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  if (unlocked) return <>{children}</>

  function attempt(next: string[]) {
    if (!next.every((d) => d !== '')) return
    if (next.join('') === BONUS_PASSWORD) {
      setUnlocked(true)
    } else {
      setError(true)
      setTimeout(() => {
        setDigits(Array(LEN).fill(''))
        setError(false)
        refs.current[0]?.focus()
      }, 450)
    }
  }

  function setAt(i: number, val: string) {
    const ch = val.slice(-1)
    const next = [...digits]
    next[i] = ch
    setDigits(next)
    setError(false)
    if (ch && i < LEN - 1) refs.current[i + 1]?.focus()
    attempt(next)
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').trim().slice(0, LEN)
    if (!text) return
    const next = Array.from({ length: LEN }, (_, i) => text[i] ?? '')
    setDigits(next)
    refs.current[Math.min(text.length, LEN - 1)]?.focus()
    attempt(next)
  }

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className={cn('card w-full max-w-sm p-6 shadow-pop', error && 'animate-shake')}>
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft">
            <Lock size={22} className="text-brand" />
          </span>
          <h2 className="font-heading text-lg font-semibold leading-tight text-ink">Team Bonus</h2>
          <p className="mt-1 text-sm text-ink-muted">Enter the access code to continue.</p>
        </div>

        <div className="flex justify-center gap-2" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode={NUMERIC ? 'numeric' : 'text'}
              autoComplete="off"
              maxLength={1}
              autoFocus={i === 0}
              aria-label={`Code character ${i + 1}`}
              className={cn(
                'h-12 w-10 rounded-xl border bg-surface text-center font-display text-xl font-semibold text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40',
                error ? 'border-bad text-bad' : 'border-line-strong focus:border-brand',
              )}
            />
          ))}
        </div>

        <p className={cn('mt-3 text-center text-xs font-medium', error ? 'text-bad' : 'text-transparent')}>
          Wrong code — try again.
        </p>
      </div>
    </div>
  )
}
