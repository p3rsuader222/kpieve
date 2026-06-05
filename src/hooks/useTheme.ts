import { useCallback, useEffect, useState } from 'react'

export type Theme =
  | 'light'
  | 'soft-gray'
  | 'dark'
  | 'warm-charcoal'
  | 'rose-mist'
  | 'sage-mist'
  | 'periwinkle'

const KEY = 'kpieve-theme'

/** Themes whose tokens build on the original `.dark` block. */
const DARK_FAMILY: Theme[] = ['dark', 'warm-charcoal']

export interface ThemeMeta {
  id: Theme
  label: string
  emoji: string
  /** Browser chrome / address-bar colour (the theme's background). */
  themeColor: string
  /** Accent hex — only used to paint the picker swatch (not the theme itself). */
  accentColor: string
}

/** Ordered for the picker: light family, then dark family, then ambient. */
export const THEMES: ThemeMeta[] = [
  { id: 'light', label: 'Light', emoji: '☀️', themeColor: '#F4F6F8', accentColor: '#0A7AFF' },
  { id: 'soft-gray', label: 'Soft Gray', emoji: '🌫️', themeColor: '#F3F4F6', accentColor: '#0A7AFF' },
  { id: 'dark', label: 'Dark', emoji: '🌙', themeColor: '#14171C', accentColor: '#2E90FF' },
  { id: 'warm-charcoal', label: 'Warm Charcoal', emoji: '🌑', themeColor: '#2B2D31', accentColor: '#2E90FF' },
  { id: 'rose-mist', label: 'Rose Mist', emoji: '🌸', themeColor: '#F5D4D8', accentColor: '#D86A7A' },
  { id: 'sage-mist', label: 'Sage Mist', emoji: '🌿', themeColor: '#DCE6DE', accentColor: '#5C8D63' },
  { id: 'periwinkle', label: 'Periwinkle Studio', emoji: '💜', themeColor: '#D7D8F5', accentColor: '#5A5CE6' },
]

const VALID = new Set(THEMES.map((t) => t.id))

function current(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme') as Theme | null
  return attr && VALID.has(attr) ? attr : 'light'
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  // Keep the `.dark` class in sync so the original dark tokens (and any
  // `dark:` utilities) still apply for dark-family themes.
  root.classList.toggle('dark', DARK_FAMILY.includes(theme))
  const meta = THEMES.find((t) => t.id === theme)
  const tag = document.querySelector('meta[name="theme-color"]')
  if (meta && tag) tag.setAttribute('content', meta.themeColor)
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

/**
 * Reads/writes the active theme via the `data-theme` attribute on <html>
 * (mirrored to the `.dark` class for dark-family themes) and persists it.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current)

  useEffect(() => {
    apply(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])

  return { theme, setTheme, themes: THEMES }
}
