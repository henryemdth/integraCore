import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useExportExcel } from "@/hooks/useExportExcel"
import api from "@/lib/api"
import type { ProductDiscount } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Download, Trash2, Ban } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/format"

export default function DiscountHistoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ["discounts", "all"],
    queryFn: async () => {
      const res = await api.get("/api/discounts")
      return res.data.discounts as (ProductDiscount & { normal_price: number; units_sold?: number })[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(t("discounts.deleted"))
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || t("discounts.failedDelete")
      toast.error(msg)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/discounts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(t("discounts.cancelSuccess"))
    },
    onError: () => toast.error(t("discounts.cancelFailed")),
  })

  const handleExport = () => {
    exportToExcel("/api/discounts/export", {}, "discount-history.xlsx")
  }

  const now = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-lg">{t("discounts.history")}</h2>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          {t("discounts.export")}
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : discounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t("discounts.noDiscounts")}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("discounts.product")}</TableHead>
                  <TableHead>{t("discounts.normalPrice")}</TableHead>
                  <TableHead>{t("discounts.discountedPrice")}</TableHead>
                  <TableHead>{t("discounts.pctDiscount")}</TableHead>
                  <TableHead>{t("discounts.startDate")}</TableHead>
                  <TableHead>{t("discounts.endDate")}</TableHead>
                  <TableHead>{t("discounts.status")}</TableHead>
                  <TableHead>{t("discounts.unitsSold")}</TableHead>
                  <TableHead>{t("discounts.worked")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discounts.map((d) => {
                  const pct = d.normal_price > 0 ? Math.round((1 - d.discounted_price / d.normal_price) * 100) : 0
                  const isActive = d.status === "active" && d.start_date <= now && d.end_date >= now
                  const unitsSold = d.units_sold ?? 0
                  return (
                    <TableRow key={d.id} className={d.status === "cancelled" ? "opacity-60" : ""}>
                      <TableCell>
                        <span className="font-medium">{d.product_name}</span>
                        <br/>
                        <code className="text-xs text-muted-foreground ml-2 font-data">{d.product_sku}</code>
                      </TableCell>
                      <TableCell className="font-data">{formatCurrency(d.normal_price)}</TableCell>
                      <TableCell className="font-data">{formatCurrency(d.discounted_price)}</TableCell>
                      <TableCell>{pct}%</TableCell>
                      <TableCell>{formatDate(d.start_date)}</TableCell>
                      <TableCell>
                        {formatDate(d.end_date)}
                      </TableCell>
                      <TableCell>
                        {d.status === "cancelled" ? (
                          <Badge variant="secondary">{t("discounts.cancelled")}</Badge>
                        ) : isActive ? (
                          <Badge variant="success-light">{t("discounts.active")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("discounts.expired")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-data text-right">{unitsSold}</TableCell>
                      <TableCell>{unitsSold > 0 ? t("discounts.yes") : t("discounts.no")}</TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {d.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { if (confirm(t("discounts.confirmCancel"))) cancelMutation.mutate(d.id) }}
                          >
                            <Ban className="h-4 w-4 text-amber-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { if (confirm(t("discounts.confirmDelete"))) deleteMutation.mutate(d.id) }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}