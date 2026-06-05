import { useEffect, useState } from 'react'

const VARS = [
  'brand',
  'good',
  'warn',
  'bad',
  'ink',
  'ink-soft',
  'ink-muted',
  'line',
  'surface',
] as const

type VarName = (typeof VARS)[number]
export type ThemeColors = Record<VarName, string>

function read(): ThemeColors {
  const cs = getComputedStyle(document.documentElement)
  const out = {} as ThemeColors
  for (const v of VARS) out[v] = `hsl(${cs.getPropertyValue(`--${v}`).trim()})`
  return out
}

/**
 * Resolved CSS-variable colors for use in SVG/Recharts attributes.
 * Re-reads whenever the theme on <html> changes (`data-theme` attribute or
 * the `.dark` class), so charts recolor instantly on theme switch.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])
  return colors
}
