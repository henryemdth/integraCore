import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"
import type { User } from "@integracore/shared"

/**
 * The full user list, shared by the users-page stat cards and search
 * suggestions without being truncated by pagination limits.
 */
export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users.listAll,
    queryFn: async () => {
      const res = await api.get("/api/users/all")
      return res.data.users as User[]
    },
  })
}
