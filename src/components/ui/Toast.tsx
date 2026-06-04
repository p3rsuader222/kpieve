import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastApi {
  show: (type: ToastType, message: string) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastCtx = createContext<ToastApi | null>(null)

const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const ACCENT = { success: 'text-good', error: 'text-bad', info: 'text-brand' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current
      setItems((xs) => [...xs, { id, type, message }])
      setTimeout(() => remove(id), 3800)
    },
    [remove],
  )

  const api: ToastApi = {
    show,
    success: (m) => show('success', m),
    error: (m) => show('error', m),
    info: (m) => show('info', m),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(92vw,360px)] flex-col gap-2.5">
        <AnimatePresence>
          {items.map((t) => {
            const Icon = ICON[t.type]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                onClick={() => remove(t.id)}
                className="card pointer-events-auto flex cursor-pointer items-start gap-3 p-3.5 shadow-pop"
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${ACCENT[t.type]}`} />
                <p className="text-sm font-medium text-ink">{t.message}</p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
