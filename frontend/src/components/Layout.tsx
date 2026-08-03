import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Menu } from "lucide-react"
import Sidebar from "@/components/Sidebar"
import NotificationBell from "@/components/notifications/NotificationBell"
import { Button } from "@/components/ui/button"

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-white flex items-center justify-between px-6 shrink-0">
          <Button
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            className="h-9 w-9 min-h-0 p-0 text-muted-foreground hover:text-foreground"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-6 bg-background overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
