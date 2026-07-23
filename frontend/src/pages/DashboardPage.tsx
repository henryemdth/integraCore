import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, Users } from "lucide-react"
import { Link } from "react-router-dom"

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { t } = useTranslation()

  const cards = [
    {
      titleKey: "dashboard.productsCard",
      descKey: "dashboard.productsDesc",
      icon: Package,
      to: "/products",
      roles: ["admin", "user"],
    },
    {
      titleKey: "dashboard.salesCard",
      descKey: "dashboard.salesDesc",
      icon: ShoppingCart,
      to: "/sales",
      roles: ["admin", "user"],
    },
    {
      titleKey: "dashboard.usersCard",
      descKey: "dashboard.usersDesc",
      icon: Users,
      to: "/users",
      roles: ["admin"],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.welcome", { name: user?.full_name })}</h2>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((card) => card.roles.includes(isAdmin ? "admin" : "user"))
          .map((card) => (
            <Link key={card.to} to={card.to}>
              <Card className="transition-colors hover:bg-muted/50 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t(card.titleKey)}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{t(card.descKey)}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>
    </div>
  )
}
