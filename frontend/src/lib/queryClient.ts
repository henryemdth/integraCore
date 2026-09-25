import { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/errorMessages"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err: any) => {
        toast.error(getErrorMessage(err, "common.unexpectedError"))
      },
    },
  },
})
