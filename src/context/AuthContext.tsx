import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, sharedAuthEmail, supabase } from '@/lib/supabase'

interface AuthState {
  /** Initial session check finished. */
  ready: boolean
  isAuthed: boolean
  /** Live mode (Supabase present) vs. mock mode. */
  isConfigured: boolean
  /** Login form must collect an email (no shared account email configured). */
  needsEmail: boolean
  signIn: (password: string, email?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      ready,
      isAuthed: !isSupabaseConfigured || Boolean(session),
      isConfigured: isSupabaseConfigured,
      needsEmail: !sharedAuthEmail,
      async signIn(password, email) {
        if (!supabase) return
        const e = sharedAuthEmail || email || ''
        const { error } = await supabase.auth.signInWithPassword({ email: e, password })
        if (error) throw error
      },
      async signOut() {
        if (supabase) await supabase.auth.signOut()
      },
    }),
    [ready, session],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
