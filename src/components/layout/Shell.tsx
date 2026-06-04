import type { ReactNode } from 'react'
import { Sidebar, TopBar } from './Sidebar'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grain-above min-h-dvh lg:pl-60">
      <Sidebar />
      <TopBar />
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <p className="border-t border-line pt-4 text-2xs text-ink-muted">
            KPIeve · Onboarding performance dashboard
          </p>
        </footer>
      </div>
    </div>
  )
}
