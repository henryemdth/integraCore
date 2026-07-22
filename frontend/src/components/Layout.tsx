import { useState } from "react"
import { Outlet } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import Sidebar from "@/components/Sidebar"
import { ChangePasswordDialog } from "@/components/users/ChangePasswordDialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, Key } from "lucide-react"

export default function Layout() {
  const { user, logout } = useAuth()
  const [pwdOpen, setPwdOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.full_name}</span>
            <Badge variant="secondary" className="capitalize">
              {user?.role}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => setPwdOpen(true)} title="Change Password">
              <Key className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 bg-muted/50 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </div>
  )
}
