import { LayoutDashboard, LogOut, Moon, PencilLine, Settings, Sun } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/context/AuthContext'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/update', label: 'Update', icon: PencilLine, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
]

export function Header() {
  const { theme, toggle } = useTheme()
  const { isConfigured, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="mr-1">
          <Logo />
        </NavLink>

        <nav className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 p-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  isActive ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              <Icon size={16} strokeWidth={2.2} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-ink"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {isConfigured && (
          <button
            onClick={() => signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:text-bad"
          >
            <LogOut size={17} />
          </button>
        )}
      </div>
    </header>
  )
}
