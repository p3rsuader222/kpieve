import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * useState persisted to localStorage, so each page reopens exactly where it
 * was left (the app runs on one shared account and device per person, so a
 * plain local key is enough). Values round-trip through JSON; missing or
 * corrupt storage falls back to `initial` without throwing.
 */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw == null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode / storage full — state simply stays in-memory */
    }
  }, [key, value])

  return [value, setValue]
}
