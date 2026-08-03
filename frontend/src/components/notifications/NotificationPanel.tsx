import { useTranslation } from "react-i18next"
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/format"
import { CheckCheck, Bell } from "lucide-react"

export default function NotificationPanel() {
  const { t } = useTranslation()
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const unreadCount = notifications.filter((n) => !n.read).length

  function handleClick(id: number, read: number) {
    if (!read) markRead.mutate(id)
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-elevated z-50">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-headline-sm">{t("notifications.title")}</span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-body-sm text-muted-foreground">{t("notifications.noNotifications")}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              className={`w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-surface-container transition-colors ${!n.read ? "bg-primary/5" : ""}`}
              onClick={() => handleClick(n.id, n.read)}
            >
              <div className="flex items-start gap-2">
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm">{n.message}</p>
                  <p className="text-body-sm text-muted-foreground mt-0.5 font-data">
                    {formatDateTime(n.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
