import { useMutation, useQueryClient } from '@tanstack/react-query'
import { upsertEntries, type EntryUpsert } from '@/data/datasource'
import { dashboardKey } from './useDashboard'

export function useUpsertEntries() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: EntryUpsert[]) => upsertEntries(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey }),
  })
}
