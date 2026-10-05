import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { useExportExcel } from "@/hooks/useExportExcel"
import { useAllProducts } from "@/hooks/useProductQueries"
import { useSalesStats } from "@/hooks/useSalesStats"
import api from "@/lib/api"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { queryKeys } from "@/lib/queryKeys"
import type { SaleDetail } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog"
import { CreateSaleForm } from "@/components/sales/CreateSaleForm"
import { StatCard } from "@/components/StatCard"
import { Pagination } from "@/components/Pagination"
import { QueryErrorState } from "@/components/ui/query-error"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Eye, Trash2, Download, ShoppingCart, TrendingUp, CircleDollarSign, SearchX, X } from "lucide-react"
import { getErrorMessage } from "@/lib/errorMessages"

interface UserListItem { id: number; full_name: string; username: string }

export default function SalesListPage() {
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()

  const [activeTab, setActiveTab] = useState("new-sale")
  const [page, setPage] = useState(1)
  const [sellerFilter, setSellerFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [detailSale, setDetailSale] = useState<SaleDetail | null>(null)
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<number | null>(null)

  const [limit, setLimit] = useState(10)
  const filterParams: Record<string, string> = { page: String(page), limit: String(limit) }
  if (sellerFilter !== "all") filterParams.user_id = sellerFilter
  if (productFilter !== "all") filterParams.product_id = productFilter
  if (dateFrom) filterParams.date_from = dateFrom
  if (dateTo) filterParams.date_to = dateTo

  // Stat totals cover the whole filtered set (no paging) — same filters the
  // table and the Excel export use.
  const statsParams: Record<string, string> = {}
  if (sellerFilter !== "all") statsParams.user_id = sellerFilter
  if (productFilter !== "all") statsParams.product_id = productFilter
  if (dateFrom) statsParams.date_from = dateFrom
  if (dateTo) statsParams.date_to = dateTo

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.sales.list(filterParams),
    queryFn: async () => {
      const res = await api.get(`/api/sales?${new URLSearchParams(filterParams)}`)
      return { sales: res.data.sales as SaleDetail[], total: res.data.total as number, totalPages: res.data.totalPages as number }
    },
    placeholderData: (prev) => prev,
  })

  const sales = data?.sales ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const { data: users = [] } = useQuery({
    queryKey: queryKeys.users.options,
    queryFn: async () => { if (!isAdmin) return []; const res = await api.get("/api/users"); return res.data.users as UserListItem[] },
  })

  const products = useAllProducts().data ?? []

  const { data: stats, isLoading: statsLoading } = useSalesStats(statsParams)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sales/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }); toast.success(t("sales.deleted")) },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "sales.failedDelete")),
  })

  const resetPage = () => setPage(1)

  // One-tap date ranges so sellers never have to fill the two native date
  // fields for the common "how did we do today?" questions.
  const applyDatePreset = (preset: "today" | "week" | "month") => {
    const now = new Date()
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    if (preset === "today") {
      setDateFrom(fmt(now)); setDateTo(fmt(now))
    } else if (preset === "week") {
      const start = new Date(now); start.setDate(now.getDate() - 6)
      setDateFrom(fmt(start)); setDateTo(fmt(now))
    } else {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1))); setDateTo(fmt(now))
    }
    resetPage()
  }

  const hasFilters = productFilter !== "all" || dateFrom !== "" || dateTo !== "" || (isAdmin && sellerFilter !== "all")
  const clearFilters = () => { setSellerFilter("all"); setProductFilter("all"); setDateFrom(""); setDateTo(""); resetPage() }

  return (
    <div className="space-y-4">
      <h2 className="text-headline-lg">{t("sales.title")}</h2>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new-sale">{t("sales.tabs.newSale")}</TabsTrigger>
          <TabsTrigger value="history">{t("sales.tabs.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="new-sale">
          <CreateSaleForm />
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <div className={`grid gap-4 grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            <StatCard label={t("sales.stats.totalSales")} value={total} icon={ShoppingCart} loading={isLoading} />
            <StatCard label={t("sales.stats.totalRevenue")} value={formatCurrency(stats?.total_revenue ?? 0)} icon={TrendingUp} loading={statsLoading} />
            {isAdmin && (
              <StatCard label={t("sales.stats.totalProfit")} value={formatCurrency(stats?.total_profit ?? 0)} icon={CircleDollarSign} loading={statsLoading} />
            )}
            <StatCard label={t("sales.stats.avgSale")} value={formatCurrency(stats?.avg_sale_value ?? 0)} icon={TrendingUp} loading={statsLoading} />
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-end gap-3 flex-wrap">
                {isAdmin && (
                  <div className="space-y-1.5">
                    <Label className="text-label-caps text-muted-foreground">{t("sales.seller")}</Label>
                    <SearchableSelect
                      value={sellerFilter}
                      onValueChange={(v) => { setSellerFilter(v); resetPage() }}
                      options={users.map((u) => ({ value: String(u.id), label: u.full_name }))}
                      allLabel={t("sales.allSellers")}
                      searchPlaceholder={t("common.search")}
                      noResultsText={t("common.noMatches")}
                      clearLabel={t("common.clearFilter")}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.product")}</Label>
                  <SearchableSelect
                    value={productFilter}
                    onValueChange={(v) => { setProductFilter(v); resetPage() }}
                    options={products.map((p) => ({ value: String(p.id), label: p.name, keywords: [p.sku] }))}
                    allLabel={t("sales.allProducts")}
                    searchPlaceholder={t("common.search")}
                    noResultsText={t("common.noMatches")}
                    clearLabel={t("common.clearFilter")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.from")}</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage() }} className="w-[170px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.to")}</Label>
                  <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage() }} className="w-[170px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-transparent">·</Label>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => applyDatePreset("today")}>{t("sales.presets.today")}</Button>
                    <Button variant="outline" size="sm" onClick={() => applyDatePreset("week")}>{t("sales.presets.week")}</Button>
                    <Button variant="outline" size="sm" onClick={() => applyDatePreset("month")}>{t("sales.presets.month")}</Button>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" />{t("sales.clearFilters")}</Button>
                    )}
                  </div>
                </div>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => {
                  const p: Record<string, string> = {}
                  if (sellerFilter !== "all") p.user_id = sellerFilter
                  if (productFilter !== "all") p.product_id = productFilter
                  if (dateFrom) p.date_from = dateFrom
                  if (dateTo) p.date_to = dateTo
                  exportToExcel("/api/sales/export", p, "sales.xlsx")
                }}><Download className="h-4 w-4 mr-2" />{t("products.export")}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sales.saleId")}</TableHead>
                    <TableHead>{t("sales.date")}</TableHead>
                    <TableHead>{t("sales.seller")}</TableHead>
                    <TableHead className="text-right">{t("sales.items")}</TableHead>
                    <TableHead className="text-right">{t("sales.total")}</TableHead>
                    <TableHead className="w-[80px]">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isError ? (
                    <TableRow><TableCell colSpan={6} className="py-4"><QueryErrorState onRetry={refetch} error={error} /></TableCell></TableRow>
                  ) : isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-6 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                      </TableRow>
                    ))
                  ) : sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        {hasFilters ? (
                          <EmptyState
                            icon={SearchX}
                            title={t("sales.noSales")}
                            description={t("sales.noSalesFilters")}
                            action={<Button variant="outline" size="sm" onClick={clearFilters}>{t("sales.clearFilters")}</Button>}
                          />
                        ) : (
                          <EmptyState
                            icon={ShoppingCart}
                            title={t("sales.emptyTitle")}
                            description={t("sales.emptyDesc")}
                            action={<Button onClick={() => setActiveTab("new-sale")}>{t("sales.tabs.newSale")}</Button>}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-data">#{sale.id}</TableCell>
                      <TableCell className="text-body-sm">{formatDateTime(sale.created_at)}</TableCell>
                      <TableCell>{sale.seller_name}</TableCell>
                      <TableCell className="text-right font-data">{sale.items.length}</TableCell>
                      <TableCell className="text-right font-data font-semibold">{formatCurrency(sale.total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" className="h-8 w-8 p-0" aria-label={t("sales.viewSale")} onClick={() => setDetailSale(sale)}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && (
                            <Button variant="ghost" className="h-8 w-8 p-0 text-destructive" aria-label={t("common.delete")}
                              onClick={() => setConfirmDeleteSaleId(sale.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          <Pagination page={page} totalPages={totalPages} total={total} pageInfoKey="sales.pageInfo" onPageChange={setPage} limit={limit} onLimitChange={(l) => { setLimit(l); setPage(1) }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <SaleDetailDialog sale={detailSale} open={Boolean(detailSale)} onOpenChange={(o) => { if (!o) setDetailSale(null) }} />
      <ConfirmDialog
        open={confirmDeleteSaleId !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmDeleteSaleId(null) }}
        title={t("sales.confirmDeleteTitle")}
        description={confirmDeleteSaleId !== null ? t("sales.confirmDelete", { id: confirmDeleteSaleId }) : undefined}
        confirmLabel={t("common.delete")}
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => { if (confirmDeleteSaleId !== null) { deleteMutation.mutate(confirmDeleteSaleId); setConfirmDeleteSaleId(null) } }}
      />
    </div>
  )
}
