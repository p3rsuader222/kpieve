import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteKpi,
  deleteMember,
  deleteTargetsForPeriod,
  saveKpi,
  saveMember,
  upsertForecasts,
  upsertTargets,
  type ForecastUpsert,
  type TargetUpsert,
} from '@/data/datasource'
import type { Kpi, Member } from '@/lib/types'
import { dashboardKey } from './useDashboard'

export function useConfigMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: dashboardKey })

  return {
    saveKpi: useMutation({ mutationFn: (k: Partial<Kpi> & { id?: string }) => saveKpi(k), onSuccess: invalidate }),
    deleteKpi: useMutation({ mutationFn: (id: string) => deleteKpi(id), onSuccess: invalidate }),
    saveMember: useMutation({
      mutationFn: (args: { member: Partial<Member> & { id?: string }; marketIds?: string[] }) =>
        saveMember(args.member, args.marketIds),
      onSuccess: invalidate,
    }),
    deleteMember: useMutation({ mutationFn: (id: string) => deleteMember(id), onSuccess: invalidate }),
    upsertTargets: useMutation({ mutationFn: (rows: TargetUpsert[]) => upsertTargets(rows), onSuccess: invalidate }),
    deleteTargets: useMutation({ mutationFn: (period: string) => deleteTargetsForPeriod(period), onSuccess: invalidate }),
    upsertForecasts: useMutation({ mutationFn: (rows: ForecastUpsert[]) => upsertForecasts(rows), onSuccess: invalidate }),
  }
}
