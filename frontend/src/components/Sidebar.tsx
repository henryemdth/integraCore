import { NavLink } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { LayoutDashboard, Package, ShoppingCart, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", key: "sidebar.dashboard", icon: LayoutDashboard, roles: ["admin", "user"] },
  { to: "/products", key: "sidebar.products", icon: Package, roles: ["admin", "user"] },
  { to: "/sales", key: "sidebar.sales", icon: ShoppingCart, roles: ["admin", "user"] },
  { to: "/users", key: "sidebar.users", icon: Users, roles: ["admin"] },
  { to: "/settings", key: "sidebar.settings", icon: Settings, roles: ["admin"] },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()
  const { t } = useTranslation()

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">integraCore</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(isAdmin ? "admin" : "user"))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {t(item.key)}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
