import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"

interface DashboardSummary {
  totalProducts: number
  lowStockCount: number
  totalSalesToday: number
  revenueToday: number
  revenueThisMonth: number
  targetAmount: number
  targetPercentage: number
  totalUsers: number
  recentSales: { id: number; total: number; seller_name: string; created_at: string }[]
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/summary")
      return res.data as DashboardSummary
    },
  })
}