import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '@/data/datasource'

export const dashboardKey = ['dashboard'] as const

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKey,
    queryFn: fetchDashboard,
    staleTime: 60_000,
  })
}
