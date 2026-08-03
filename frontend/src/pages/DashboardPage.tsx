import { useAuth } from "@/contexts/AuthContext"
import { useTranslation } from "react-i18next"
import { useDashboardSummary } from "@/hooks/useDashboardSummary"
import { formatCurrency } from "@/lib/format"
import { StatCard } from "@/components/StatCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Package, ShoppingCart, TrendingUp, Users, AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"
import { formatDateTime } from "@/lib/format"
import { QueryErrorState } from "@/components/ui/query-error"

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = useDashboardSummary()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-headline-lg text-primary">{t("dashboard.welcome", { name: user?.full_name })}</h2>
        <p className="text-body-md text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {isError ? (
        <QueryErrorState onRetry={refetch} />
      ) : (
      <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.kpi.totalProducts")}
          value={data?.totalProducts ?? 0}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          label={t("dashboard.kpi.lowStock")}
          value={data?.lowStockCount ?? 0}
          icon={AlertTriangle}
          loading={isLoading}
          trend={data && data.lowStockCount > 0 ? "down" : "neutral"}
          trendLabel={data && data.lowStockCount > 0 ? t("dashboard.kpi.needsAttention") : undefined}
        />
        <StatCard
          label={t("dashboard.kpi.salesToday")}
          value={data?.totalSalesToday ?? 0}
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          label={t("dashboard.kpi.revenueMonth")}
          value={formatCurrency(data?.revenueThisMonth ?? 0)}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {(data || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-headline-sm">{t("dashboard.kpi.monthlyTarget")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-2 bg-surface-container-highest rounded-full w-full" />
                <div className="flex justify-between">
                  <span className="text-body-sm text-muted-foreground w-20 h-4 bg-surface-container-highest rounded" />
                  <span className="text-body-sm text-muted-foreground w-16 h-4 bg-surface-container-highest rounded" />
                </div>
              </div>
            ) : data && data.targetAmount > 0 ? (
              <div className="space-y-3">
                <Progress value={data.targetPercentage} className="h-3" />
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">{t("dashboard.kpi.progressLabel")}</span>
                  <span className="font-data font-semibold text-primary">{data.targetPercentage}%</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-muted-foreground">{t("dashboard.kpi.revenueLabel")}</span>
                  <span className="font-data">{formatCurrency(data.revenueThisMonth)} / {formatCurrency(data.targetAmount)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dashboard.kpi.noTarget")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {isAdmin && (
          <Link to="/users">
            <Card className="cursor-pointer hover:shadow-elevated transition-shadow">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-body-sm text-muted-foreground">{t("dashboard.kpi.totalUsers")}</p>
                  <p className="text-data-lg font-data">{data?.totalUsers ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        <Link to="/products">
          <Card className="cursor-pointer hover:shadow-elevated transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10">
                <Package className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-body-sm text-muted-foreground">{t("dashboard.kpi.revenueToday")}</p>
                <p className="text-data-lg font-data">{formatCurrency(data?.revenueToday ?? 0)}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/sales">
          <Card className="cursor-pointer hover:shadow-elevated transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10">
                <ShoppingCart className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-body-sm text-muted-foreground">{t("dashboard.kpi.todaySales")}</p>
                <p className="text-data-lg font-data">{data?.totalSalesToday ?? 0} {t("dashboard.kpi.salesCount")}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {(data?.recentSales?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-headline-sm">{t("dashboard.kpi.recentSales")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dashboard.kpi.saleId")}</TableHead>
                  <TableHead>{t("dashboard.kpi.seller")}</TableHead>
                  <TableHead>{t("dashboard.kpi.dateTime")}</TableHead>
                  <TableHead className="text-right">{t("dashboard.kpi.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-data">#{sale.id}</TableCell>
                    <TableCell>{sale.seller_name}</TableCell>
                    <TableCell className="text-body-sm text-muted-foreground">{formatDateTime(sale.created_at)}</TableCell>
                    <TableCell className="text-right font-data font-semibold">{formatCurrency(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  )
}
