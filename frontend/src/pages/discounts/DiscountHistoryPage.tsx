import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { useExportExcel } from "@/hooks/useExportExcel"
import { useAllProducts } from "@/hooks/useProductQueries"
import api from "@/lib/api"
import type { Product, ProductDiscount } from "@integracore/shared"
import { queryKeys } from "@/lib/queryKeys"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { QueryErrorState } from "@/components/ui/query-error"
import { Download, Trash2, Ban } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/format"
import { nowString } from "@integracore/shared"
import { useEffect, useState } from "react"
import { getErrorMessage } from "@/lib/errorMessages"

type DiscountRow = ProductDiscount & { normal_price: number; units_sold?: number }

type PendingAction = { type: "cancel" | "delete"; discount: DiscountRow } | null

export default function DiscountHistoryPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  // Deep link from Products ("Historial de descuentos" row action) pre-selects
  // the product filter; later navigations with a new productId re-apply it.
  const [searchParams] = useSearchParams()
  const paramProductId = searchParams.get("productId")
  const [productFilter, setProductFilter] = useState(paramProductId ?? "all")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    if (paramProductId) setProductFilter(paramProductId)
  }, [paramProductId])

  const filterParams: Record<string, string> = {}
  if (productFilter !== "all") filterParams.product_id = productFilter
  if (statusFilter !== "all") filterParams.status = statusFilter

  const { data: discounts = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.discounts.list(filterParams),
    queryFn: async () => {
      const qs = new URLSearchParams(filterParams).toString()
      const res = await api.get(`/api/discounts${qs ? `?${qs}` : ""}`)
      return res.data.discounts as DiscountRow[]
    },
    placeholderData: (prev) => prev,
  })

  const allProducts = useAllProducts().data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      toast.success(t("discounts.deleted"))
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, "discounts.failedDelete")
      toast.error(msg)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/api/discounts/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      toast.success(t("discounts.cancelSuccess"))
    },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "discounts.cancelFailed")),
  })

  const handleExport = () => {
    exportToExcel("/api/discounts/export", { ...filterParams }, "discount-history.xlsx")
  }

  const now = nowString()

  const handleConfirm = () => {
    if (!pendingAction) return
    if (pendingAction.type === "cancel") {
      cancelMutation.mutate(pendingAction.discount.id)
    } else {
      deleteMutation.mutate(pendingAction.discount.id)
    }
    setPendingAction(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-headline-lg">{t("discounts.history")}</h2>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-label-caps text-muted-foreground">{t("discounts.product")}</Label>
              <SearchableSelect
                value={productFilter}
                onValueChange={setProductFilter}
                options={allProducts.map((p: Product) => ({ value: String(p.id), label: p.name, keywords: [p.sku] }))}
                allLabel={t("discounts.allProducts")}
                searchPlaceholder={t("common.search")}
                noResultsText={t("common.noMatches")}
                clearLabel={t("common.clearFilter")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-label-caps text-muted-foreground">{t("discounts.status")}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("discounts.allStatuses")}</SelectItem>
                  <SelectItem value="active">{t("discounts.active")}</SelectItem>
                  <SelectItem value="scheduled">{t("discounts.scheduled")}</SelectItem>
                  <SelectItem value="expired">{t("discounts.expired")}</SelectItem>
                  <SelectItem value="cancelled">{t("discounts.cancelled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {t("discounts.export")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">{t("common.loading")}</div>
          ) : isError ? (
            <QueryErrorState onRetry={refetch} />
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
                  const isScheduled = d.status === "active" && d.start_date > now
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
                        ) : isScheduled ? (
                          <Badge variant="outline">{t("discounts.scheduled")}</Badge>
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
                            onClick={() => setPendingAction({ type: "cancel", discount: d })}
                          >
                            <Ban className="h-4 w-4 text-warning" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingAction({ type: "delete", discount: d })}
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
      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null) }}
        title={pendingAction?.type === "cancel" ? t("discounts.confirmCancelTitle") : t("discounts.confirmDeleteTitle")}
        description={pendingAction?.type === "cancel" ? t("discounts.confirmCancel") : t("discounts.confirmDelete")}
        confirmLabel={pendingAction?.type === "cancel" ? t("discounts.cancel") : t("common.delete")}
        destructive={pendingAction?.type === "delete"}
        pending={pendingAction?.type === "cancel" ? cancelMutation.isPending : deleteMutation.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
