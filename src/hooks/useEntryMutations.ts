import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteEntries,
  deleteEntriesForDate,
  upsertEntries,
  type EntryKey,
  type EntryUpsert,
} from '@/data/datasource'
import { dashboardKey } from './useDashboard'

export function useUpsertEntries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: EntryUpsert[]) => upsertEntries(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey }),
  })
}

export function useDeleteEntries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keys: EntryKey[]) => deleteEntries(keys),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey }),
  })
}

export function useDeleteEntriesForDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => deleteEntriesForDate(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey }),
  })
}
