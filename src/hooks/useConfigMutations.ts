import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteAssortmentSeller,
  deleteKpi,
  deleteMember,
  deleteTargetsForPeriod,
  saveAssortmentSeller,
  saveKpi,
  saveMember,
  upsertBonusBase,
  upsertBonusSettings,
  upsertBonusWeights,
  upsertForecasts,
  upsertKpiMarketConfig,
  upsertTargets,
  type AssortmentSellerInput,
  type BonusBaseUpsert,
  type BonusSettingUpsert,
  type BonusWeightUpsert,
  type ForecastUpsert,
  type KpiMarketConfigUpsert,
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
    upsertBonusWeights: useMutation({ mutationFn: (rows: BonusWeightUpsert[]) => upsertBonusWeights(rows), onSuccess: invalidate }),
    upsertBonusSettings: useMutation({ mutationFn: (rows: BonusSettingUpsert[]) => upsertBonusSettings(rows), onSuccess: invalidate }),
    upsertKpiMarketConfig: useMutation({ mutationFn: (rows: KpiMarketConfigUpsert[]) => upsertKpiMarketConfig(rows), onSuccess: invalidate }),
    upsertBonusBase: useMutation({ mutationFn: (rows: BonusBaseUpsert[]) => upsertBonusBase(rows), onSuccess: invalidate }),
    saveAssortmentSeller: useMutation({ mutationFn: (row: AssortmentSellerInput) => saveAssortmentSeller(row), onSuccess: invalidate }),
    deleteAssortmentSeller: useMutation({ mutationFn: (id: string) => deleteAssortmentSeller(id), onSuccess: invalidate }),
  }
}
