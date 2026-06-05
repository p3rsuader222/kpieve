/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AUTH_EMAIL?: string
  /** Separate password gating the Team Bonus page (defaults to "bonus" if unset). */
  readonly VITE_BONUS_PASSWORD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
