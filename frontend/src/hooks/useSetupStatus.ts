import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"

/**
 * Public first-run gate shared by the login and setup screens: whether the
 * users table is still empty, and which DB driver is live (the setup screen
 * only offers backup restore on SQLite).
 */
export function useSetupStatus() {
  return useQuery({
    queryKey: queryKeys.auth.setupStatus,
    queryFn: async () => {
      const res = await api.get("/api/auth/setup-status")
      return {
        needsSetup: res.data.needsSetup as boolean,
        dbDriver: res.data.dbDriver as string,
      }
    },
  })
}
