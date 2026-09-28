import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import type { Product } from "@integracore/shared"

/**
 * Shared product lookups used by filter dropdowns, suggestion inputs and the
 * sale form.
 *
 * These used to be written inline in five places under the same query key
 * (`["products", "list-all"]`) but with two different limits — `10000` in the
 * product pages and `100` in the sale form. React Query keys the cache on the
 * key alone, so whichever component mounted first decided the dataset for
 * everyone: opening the sale form first silently truncated the product list to
 * the first 100 rows for the whole session.
 *
 * Both hooks now share one key and one limit, so the cache is consistent and
 * suggestions/filters see the full catalogue.
 */

/** The full product catalogue, for client-side filtering and suggestions. */
export function useAllProducts() {
  return useQuery({
    queryKey: queryKeys.products.listAll,
    queryFn: async () => {
      const res = await api.get("/api/products?limit=10000")
      return res.data.products as Product[]
    },
  })
}

/** Distinct product categories, for the category filter and product form. */
export function useProductCategories() {
  return useQuery({
    queryKey: queryKeys.products.categories,
    queryFn: async () => {
      const res = await api.get("/api/products/categories")
      return res.data.categories as string[]
    },
  })
}
