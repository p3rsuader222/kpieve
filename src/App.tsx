import { type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Shell } from '@/components/layout/Shell'
import { Logo } from '@/components/layout/Logo'
import { Dashboard } from '@/pages/Dashboard'
import { Update } from '@/pages/Update'
import { Activity } from '@/pages/Activity'
import { Forecast } from '@/pages/Forecast'
import { TeamBonus } from '@/pages/TeamBonus'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth()
  const location = useLocation()
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

function Booting() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse opacity-70">
        <Logo size={32} />
      </div>
    </div>
  )
}

export default function App() {
  const { ready } = useAuth()
  if (!ready) return <Booting />

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/update" element={<Update />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/team-bonus" element={<TeamBonus />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
