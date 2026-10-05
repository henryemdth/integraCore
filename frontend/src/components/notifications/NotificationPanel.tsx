import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useNotifications, useMarkNotificationRead, useMarkAllRead, type NotificationItem } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { CheckCheck, Bell } from "lucide-react"

// Cron-generated notifications store their interpolation values as JSON, so
// they render in the user's language; old rows (no params) keep their stored
// English text.
function notificationText(n: NotificationItem, t: ReturnType<typeof useTranslation>["t"]): string {
  if (!n.params) return n.message
  let p: Record<string, unknown>
  try {
    p = JSON.parse(n.params)
  } catch {
    return n.message
  }
  if (n.type === "low_stock") {
    const more = p.more ? t("notifications.moreProducts", { count: p.more }) : ""
    return t("notifications.lowStock", { count: p.count, names: p.names ?? "" }) + more
  }
  if (n.type === "profit_behind") {
    return t("notifications.profitBehind", {
      revenue: formatCurrency(Number(p.revenue) || 0),
      target: formatCurrency(Number(p.target) || 0),
      percentage: p.percentage ?? 0,
      gap: formatCurrency(Number(p.gap) || 0),
    })
  }
  return n.message
}

export default function NotificationPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()

  const unreadCount = notifications.filter((n) => !n.read).length

  // Mark unread notifications read and take the user to the screen that can
  // act on them (low stock → products, profit pace → settings, admins only).
  function handleClick(n: NotificationItem) {
    if (!n.read) markRead.mutate(n.id)
    const target = n.type === "low_stock" ? "/products" : n.type === "profit_behind" ? "/settings" : null
    if (target) {
      onNavigate?.()
      navigate(target)
    }
  }

  return (
    <div className="w-full">
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
              onClick={() => handleClick(n)}
            >
              <div className="flex items-start gap-2">
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm">{notificationText(n, t)}</p>
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
