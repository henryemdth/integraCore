import { NavLink } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { LayoutDashboard, Package, ShoppingCart, Users, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "user"] },
  { to: "/products", label: "Products", icon: Package, roles: ["admin", "user"] },
  { to: "/sales", label: "Sales", icon: ShoppingCart, roles: ["admin", "user"] },
  { to: "/users", label: "Users", icon: Users, roles: ["admin"] },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()

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
              {item.label}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
