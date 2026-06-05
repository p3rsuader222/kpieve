import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  value: number | null
  format: (n: number | null) => string
  className?: string
}

// Long, soft deceleration — the reel spins fast then settles (matches `smooth`).
const ROLL = { duration: 1.15, ease: [0.22, 1, 0.36, 1] as const }

/** A single 0–9 reel that rolls vertically to land on `digit` (slot-machine style). */
function Reel({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block overflow-hidden tabular-nums" style={{ height: '1em' }}>
      {/* Invisible digit sizes the cell to one figure (tabular → all equal width). */}
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 text-center"
        initial={{ y: 0 }}
        animate={{ y: `-${digit}em` }}
        transition={ROLL}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block h-[1em] leading-none">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

type Token = { kind: 'digit'; d: number } | { kind: 'text'; s: string }

/** Split a formatted string into digit reels and static text runs (units, %, ., commas). */
function tokenize(str: string): Token[] {
  const out: Token[] = []
  let buf = ''
  for (const ch of str) {
    if (ch >= '0' && ch <= '9') {
      if (buf) {
        out.push({ kind: 'text', s: buf })
        buf = ''
      }
      out.push({ kind: 'digit', d: Number(ch) })
    } else {
      buf += ch
    }
  }
  if (buf) out.push({ kind: 'text', s: buf })
  return out
}

/**
 * Slot-machine number: every digit is a reel that rolls into place, so changing
 * scope spins the figures like an odometer instead of snapping. Tokens are keyed
 * from the right so the units column stays put as the magnitude grows or shrinks.
 */
export function AnimatedNumber({ value, format, className }: Props) {
  const reduce = useReducedMotion()
  const str = format(value)
  if (value == null || reduce) return <span className={className}>{str}</span>

  const tokens = tokenize(str)
  const n = tokens.length
  return (
    <span className={className} aria-label={str}>
      <span className="inline-flex items-end leading-none" aria-hidden="true">
        {tokens.map((tok, i) =>
          tok.kind === 'digit' ? (
            <Reel key={n - 1 - i} digit={tok.d} />
          ) : (
            <span key={n - 1 - i} className="whitespace-pre">
              {tok.s}
            </span>
          ),
        )}
      </span>
    </span>
  )
}
