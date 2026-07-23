import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { useExportExcel } from "@/hooks/useExportExcel"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/format"
import type { SaleDetail, Product } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog"
import { CreateSaleForm } from "@/components/sales/CreateSaleForm"
import { Eye, Trash2, Download } from "lucide-react"

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

  const limit = 10
  const filterParams: Record<string, string> = { page: String(page), limit: String(limit) }
  if (sellerFilter !== "all") filterParams.user_id = sellerFilter
  if (productFilter !== "all") filterParams.product_id = productFilter
  if (dateFrom) filterParams.date_from = dateFrom
  if (dateTo) filterParams.date_to = dateTo

  const { data, isLoading } = useQuery({
    queryKey: ["sales", filterParams],
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
    queryKey: ["users"],
    queryFn: async () => { if (!isAdmin) return []; const res = await api.get("/api/users"); return res.data.users as UserListItem[] },
  })

  const { data: products = [] } = useQuery({
    queryKey: ["products", "list-all"],
    queryFn: async () => { const res = await api.get("/api/products?limit=100"); return res.data.products as Product[] },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sales/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sales"] }); toast.success(t("sales.deleted")) },
    onError: (err: any) => toast.error(err.response?.data?.error || t("sales.failedDelete")),
  })

  const resetPage = () => setPage(1)

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
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-end gap-3 flex-wrap">
                {isAdmin && (
                  <div className="space-y-1.5">
                    <Label className="text-label-caps text-muted-foreground">{t("sales.seller")}</Label>
                    <Select value={sellerFilter} onValueChange={(v) => { setSellerFilter(v); resetPage() }}>
                      <SelectTrigger><SelectValue placeholder={t("sales.allSellers")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("sales.allSellers")}</SelectItem>
                        {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.product")}</Label>
                  <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); resetPage() }}>
                    <SelectTrigger><SelectValue placeholder={t("sales.allProducts")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("sales.allProducts")}</SelectItem>
                      {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.from")}</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage() }} className="w-[170px]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-label-caps text-muted-foreground">{t("sales.to")}</Label>
                  <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage() }} className="w-[170px]" />
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
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("sales.noSales")}</TableCell></TableRow>
                  ) : sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">#{sale.id}</TableCell>
                      <TableCell>{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{sale.seller_name}</TableCell>
                      <TableCell className="text-right">{sale.items.length}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(sale.total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetailSale(sale)}><Eye className="h-4 w-4" /></Button>
                          {isAdmin && (
                            <Button variant="ghost" className="h-8 w-8 p-0 text-destructive"
                              onClick={() => { if (confirm(t("sales.confirmDelete", { id: sale.id }))) deleteMutation.mutate(sale.id) }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">{t("sales.pageInfo", { page, totalPages, total })}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <SaleDetailDialog sale={detailSale} open={Boolean(detailSale)} onOpenChange={(o) => { if (!o) setDetailSale(null) }} />
    </div>
  )
}
