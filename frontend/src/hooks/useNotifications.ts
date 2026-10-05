import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { queryKeys } from "@/lib/queryKeys"

export interface NotificationItem {
  id: number
  type: string
  message: string
  /** JSON blob of interpolation values for cron-generated texts (null on old rows). */
  params: string | null
  read: number
  created_at: string
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const res = await api.get("/api/notifications/unread-count")
      return res.data.count as number
    },
    refetchInterval: 30000,
  })
}

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: queryKeys.notifications.list(unreadOnly),
    queryFn: async () => {
      const res = await api.get("/api/notifications", { params: unreadOnly ? { unread: "true" } : {} })
      return res.data.notifications as NotificationItem[]
    },
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch("/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
