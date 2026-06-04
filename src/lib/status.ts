import type { KpiDirection } from './types'

export type Status = 'good' | 'warn' | 'bad' | 'none'

/** Attainment thresholds (fraction of target reached). */
const ON_TRACK = 0.97
const AT_RISK = 0.85

/**
 * Attainment ratio in [0, ~2]: 1 means target met.
 * For "lower is better" KPIs we invert so smaller values score higher.
 */
export function attainment(
  value: number | null | undefined,
  target: number | null | undefined,
  direction: KpiDirection,
): number | null {
  if (value == null || target == null || Number.isNaN(value) || Number.isNaN(target)) return null
  if (target === 0) return value === 0 ? 1 : direction === 'higher_better' ? 2 : 0
  const ratio = direction === 'higher_better' ? value / target : target / value
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
): Status {
  return statusFromAttainment(attainment(value, target, direction))
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
