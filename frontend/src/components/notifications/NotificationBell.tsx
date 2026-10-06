import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useUnreadCount } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell } from "lucide-react"
import NotificationPanel from "./NotificationPanel"

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { data: count = 0 } = useUnreadCount()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title={t("notifications.title")} aria-label={count > 0 ? t("notifications.unreadCount", { count: count > 99 ? "99+" : count }) : t("notifications.title")} className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold tabular-nums text-destructive-foreground ring-2 ring-card"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationPanel onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
