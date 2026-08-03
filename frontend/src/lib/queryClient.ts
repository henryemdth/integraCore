import { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/i18n"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || i18n.t("common.unexpectedError"))
      },
    },
  },
})
