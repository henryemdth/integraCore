import { useState } from "react"
import { Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import Sidebar from "@/components/Sidebar"
import { ChangePasswordDialog } from "@/components/users/ChangePasswordDialog"
import NotificationBell from "@/components/notifications/NotificationBell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, Key } from "lucide-react"

export default function Layout() {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const [pwdOpen, setPwdOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-white flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-body-md text-muted-foreground">{user?.full_name}</span>
            <Badge variant="secondary" className="capitalize">
              {user?.role}
            </Badge>
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setPwdOpen(true)} title={t("layout.changePassword")}>
              <Key className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title={t("layout.logout")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 bg-background overflow-auto">
          <Outlet />
        </main>
      </div>
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  )
}
