import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, Users } from "lucide-react"
import { Link } from "react-router-dom"

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()

  const cards = [
    {
      title: "Products",
      description: "Manage inventory, stock levels, and pricing",
      icon: Package,
      to: "/products",
      roles: ["admin", "user"],
    },
    {
      title: "Sales",
      description: "Record sales and view history",
      icon: ShoppingCart,
      to: "/sales",
      roles: ["admin", "user"],
    },
    {
      title: "Users",
      description: "Manage user accounts and roles",
      icon: Users,
      to: "/users",
      roles: ["admin"],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user?.full_name}</h2>
        <p className="text-muted-foreground">Here's what's happening with your business today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((card) => card.roles.includes(isAdmin ? "admin" : "user"))
          .map((card) => (
            <Link key={card.to} to={card.to}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  )
}
