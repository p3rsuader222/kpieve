import { CalendarClock, Coins, LayoutDashboard, LogOut, PencilLine, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useAuth } from '@/context/AuthContext'
import { Logo } from './Logo'
import { ThemePicker } from './ThemePicker'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/update', label: 'Update', icon: PencilLine, end: false },
  { to: '/forecast', label: 'Forecast', icon: CalendarClock, end: false },
  { to: '/team-bonus', label: 'Team Bonus', icon: Coins, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

function navClass(isActive: boolean) {
  return cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-brand-soft text-brand-ink'
      : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  )
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { isConfigured, signOut } = useAuth()
  if (!isConfigured) return null
  return (
    <button
      onClick={() => signOut()}
      aria-label="Sign out"
      title="Sign out"
      className={cn(
        'flex items-center gap-3 rounded-lg text-ink-muted transition-colors hover:bg-bad-soft hover:text-bad',
        compact ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2 text-sm font-medium',
      )}
    >
      <LogOut size={17} strokeWidth={2} />
      {!compact && <span>Sign out</span>}
    </button>
  )
}

function ModeBadge() {
  const { isConfigured } = useAuth()
  if (isConfigured) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-2xs font-semibold uppercase tracking-wider text-ink-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      Demo data
    </span>
  )
}

/** Fixed left rail (desktop) — Claude-style. */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-paper/70 px-3 py-5 backdrop-blur-xl lg:flex">
      <NavLink to="/" className="mb-7 px-2">
        <Logo />
      </NavLink>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navClass(isActive)}>
            <Icon size={17} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <div className="mb-2 px-3">
          <ModeBadge />
        </div>
        <ThemePicker />
        <SignOutButton />
      </div>
    </aside>
  )
}

/** Top bar (mobile) — logo, horizontal nav, controls. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <NavLink to="/">
          <Logo size={24} />
        </NavLink>
        <nav className="ml-auto flex items-center gap-0.5 rounded-lg border border-line bg-surface-2/60 p-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              <Icon size={16} strokeWidth={2} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <ThemePicker compact />
        <SignOutButton compact />
      </div>
    </header>
  )
}
