import { useCallback, useEffect, useState } from 'react'

const KEY = 'kpieve-bonus-lock'

/** Locked by default — only an explicit "off" disables the access code. */
function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Whether the Team Bonus page is gated by the access code. Persisted in
 * localStorage and synced across tabs/components via the `storage` event, so
 * toggling it in Settings takes effect on the Team Bonus page immediately.
 */
export function useBonusLock() {
  const [locked, setLockedState] = useState<boolean>(read)

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setLockedState(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setLocked = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      /* ignore */
    }
    setLockedState(next)
  }, [])

  return { locked, setLocked }
}
