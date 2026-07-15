import type { KpiDirection } from './types'

export type Status = 'good' | 'warn' | 'bad' | 'none'

/** Attainment thresholds (fraction of target reached). */
const ON_TRACK = 0.97
const AT_RISK = 0.85

/**
 * Attainment ratio: 1 means target met.
 * "Lower is better" targets are compliance bars — anything at or under the bar
 * is simply achieved (100%, never over), overshooting by up to `gracePct` % of
 * the bar reads as at-risk, and beyond that as failed (e.g. target 5%,
 * grace 20: ≤5% good, 6% at risk, >6% off track). gracePct 0 → any overshoot
 * fails outright.
 */
export function attainment(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: KpiDirection,
  gracePct = 20,
): number | null {
  if (value == null || target == null || Number.isNaN(value) || Number.isNaN(target)) return null
  if (target === 0) return value === 0 ? 1 : direction === 'higher_better' ? 2 : 0
  if (direction === 'lower_better') {
    if (value <= target) return 1
    // Decay tuned so +grace overshoot lands exactly on the at-risk boundary.
    return Math.max(0, ON_TRACK - ((value / target - 1) / (gracePct / 100)) * (ON_TRACK - AT_RISK))
  }
  const ratio = value / target
  if (!isFinite(ratio) || ratio < 0) return 0
  return ratio
}

export function statusFromAttainment(a: number | null): Status {
  if (a == null) return 'none'
  if (a >= ON_TRACK) return 'good'
  if (a >= AT_RISK) return 'warn'
  return 'bad'
}

export function statusOf(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: KpiDirection,
  gracePct?: number,
): Status {
  return statusFromAttainment(attainment(value, target, direction, gracePct))
}

export const STATUS_LABEL: Record<Status, string> = {
  good: 'On track',
  warn: 'At risk',
  bad: 'Off track',
  none: 'No target',
}

/** Tailwind text color token per status. */
export const STATUS_TEXT: Record<Status, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  none: 'text-ink-muted',
}

/** Tailwind soft-background token per status. */
export const STATUS_SOFT_BG: Record<Status, string> = {
  good: 'bg-good-soft',
  warn: 'bg-warn-soft',
  bad: 'bg-bad-soft',
  none: 'bg-surface-2',
}

/** CSS variable color (for inline SVG strokes / charts). */
export const STATUS_VAR: Record<Status, string> = {
  good: 'hsl(var(--good))',
  warn: 'hsl(var(--warn))',
  bad: 'hsl(var(--bad))',
  none: 'hsl(var(--ink-muted))',
}

/**
 * Whether a raw delta should read as positive (good) given KPI direction.
 * Used to color ▲/▼ deltas — a drop in a "lower is better" KPI is good.
 */
export function deltaIsGood(delta: number, direction: KpiDirection): boolean {
  if (delta === 0) return true
  return direction === 'higher_better' ? delta > 0 : delta < 0
}
