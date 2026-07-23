import { useTranslation } from "react-i18next"
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { CheckCheck } from "lucide-react"

interface Props {
  onClose: () => void
}

export default function NotificationPanel({ onClose }: Props) {
  const { t } = useTranslation()
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const unreadCount = notifications.filter((n) => !n.read).length

  function handleClick(id: number, read: number) {
    if (!read) markRead.mutate(id)
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-sm font-medium">{t("notifications.title")}</span>
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
          <p className="p-4 text-sm text-muted-foreground text-center">{t("common.loading")}</p>
        ) : notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">{t("notifications.noNotifications")}</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              className={`w-full text-left p-3 border-b border-border last:border-0 hover:bg-muted transition-colors ${!n.read ? "bg-muted/50" : ""}`}
              onClick={() => handleClick(n.id, n.read)}
            >
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateTime(n.created_at)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
