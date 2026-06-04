import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when real Supabase credentials are present (live mode vs. mock mode). */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** Shared email for the single-account password gate (optional). */
export const sharedAuthEmail = import.meta.env.VITE_AUTH_EMAIL ?? ''

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
