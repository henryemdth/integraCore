import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import type { SaleDetail } from "@integracore/shared"

/**
 * Revenue totals for the sales-page stat cards, derived from the full sales
 * history. Kept out of the page component so the aggregation lives in one
 * place; the backend should own this eventually (a /api/sales/stats endpoint)
 * once the history outgrows a single fetch.
 */
export function useSalesStats() {
  return useQuery({
    queryKey: queryKeys.sales.stats,
    queryFn: async () => {
      const res = await api.get("/api/sales?limit=10000")
      const sales = res.data.sales as SaleDetail[]
      const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0)
      const avgSaleValue = sales.length > 0 ? totalRevenue / sales.length : 0
      return { totalRevenue, avgSaleValue }
    },
  })
}
