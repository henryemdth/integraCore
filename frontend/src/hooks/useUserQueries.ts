import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import type { User } from "@integracore/shared"

/**
 * The full user list (capped), shared by the users-page stat cards and the
 * search-suggestion input. The cap mirrors the products catalogue hook; a
 * single business rarely exceeds it.
 */
export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users.listAll,
    queryFn: async () => {
      const res = await api.get("/api/users?limit=1000")
      return res.data.users as User[]
    },
  })
}
