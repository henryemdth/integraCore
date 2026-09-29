import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import type { SalesStats } from "@integracore/shared"

/**
 * Server-computed totals for the sales-page stat cards, over the same
 * filters the history table uses (seller/product/date range). Profit and
 * cost fields are admin-only — the backend returns null for sellers, and
 * the page only renders the profit card for admins.
 */
export function useSalesStats(params: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.sales.stats(params),
    queryFn: async () => {
      const res = await api.get(`/api/sales/stats?${new URLSearchParams(params)}`)
      return res.data as SalesStats
    },
    placeholderData: (prev) => prev,
  })
}
