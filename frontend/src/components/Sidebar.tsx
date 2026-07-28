import { NavLink } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, Package2, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const navItems = [
  { to: "/", key: "sidebar.dashboard", icon: LayoutDashboard, roles: ["admin", "user"] },
  { to: "/products", key: "sidebar.products", icon: Package, roles: ["admin", "user"] },
  { to: "/sales", key: "sidebar.sales", icon: ShoppingCart, roles: ["admin", "user"] },
  { to: "/users", key: "sidebar.users", icon: Users, roles: ["admin"] },
  { to: "/settings", key: "sidebar.settings", icon: Settings, roles: ["admin"] },
]

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const { user, isAdmin, logout } = useAuth()
  const { t } = useTranslation()

  return (
    <aside
      className={cn(
        "bg-surface-container-low border-r border-border flex flex-col h-full overflow-y-auto transition-all duration-200 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("border-b border-border", collapsed ? "p-3 flex justify-center" : "p-5")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <Package2 className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-headline-sm tracking-tight">integraCore</h1>
              <p className="text-body-sm text-muted-foreground">{t("sidebar.tagline")}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems
          .filter((item) => item.roles.includes(isAdmin ? "admin" : "user"))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-md text-body-md font-medium transition-all duration-150 min-h-[2.75rem]",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary -ml-px"
                    : "text-muted-foreground hover:bg-surface-container hover:text-foreground border-l-2 border-transparent -ml-px"
                )
              }
              title={collapsed ? t(item.key) : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && t(item.key)}
            </NavLink>
          ))}
      </nav>

      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-3 px-2 py-1.5")}>
          <Avatar
            initials={getInitials(user?.full_name ?? "?")}
            className={cn("shrink-0", collapsed ? "h-8 w-8 text-[11px]" : "h-8 w-8 text-[11px]")}
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-body-sm text-muted-foreground capitalize">{user?.role}</p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={logout}
            title={t("layout.logout")}
            className="h-8 w-8 min-h-0 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
