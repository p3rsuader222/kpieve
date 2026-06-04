import type { ReactNode } from 'react'
import { Header } from './Header'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grain-above flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="border-t border-line pt-5 text-2xs text-ink-muted">
          KPIeve · Onboarding performance dashboard
        </p>
      </footer>
    </div>
  )
}
