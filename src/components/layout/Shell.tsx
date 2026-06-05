import type { ReactNode } from 'react'
import { Sidebar, TopBar } from './Sidebar'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grain-above min-h-dvh lg:pl-60">
      <Sidebar />
      <TopBar />
      <div className="flex min-h-dvh flex-col">
        <main className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
          {children}
        </main>
        <footer className="w-full px-4 py-5 sm:px-6 lg:px-8">
          <p className="border-t border-line pt-4 text-2xs text-ink-muted">
            KPIeve · Onboarding performance dashboard
          </p>
        </footer>
      </div>
    </div>
  )
}
