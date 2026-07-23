import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { useExportExcel } from "@/hooks/useExportExcel"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/format"
import type { Product } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StockMovementDialog } from "@/components/products/StockMovementDialog"
import { ImportDialog } from "@/components/products/ImportDialog"
import { Plus, MoreHorizontal, Search, PackagePlus, PackageMinus, Download, Upload } from "lucide-react"

export default function ProductListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState("created_at")
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC")
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockType, setStockType] = useState<"in" | "out">("in")
  const [importOpen, setImportOpen] = useState(false)

  const limit = 10
  const params = { page: String(page), limit: String(limit), sort, order, ...(search && { search }), ...(category !== "all" && { category }) }

  const { data, isLoading } = useQuery({
    queryKey: ["products", params],
    queryFn: async () => {
      const res = await api.get(`/api/products?${new URLSearchParams(params)}`)
      return { products: res.data.products as Product[], total: res.data.total as number, totalPages: res.data.totalPages as number }
    },
    placeholderData: (prev) => prev,
  })

  const products = data?.products ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const { data: catData } = useQuery({
    queryKey: ["products", "categories"],
    queryFn: async () => {
      const res = await api.get("/api/products?limit=100")
      return [...new Set(res.data.products.map((p: Product) => p.category).filter(Boolean))].sort() as string[]
    },
  })
  const categories = catData ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success(t("products.deleted")) },
    onError: (err: any) => toast.error(err.response?.data?.error || t("products.failedDelete")),
  })

  const handleSort = (column: string) => {
    if (sort === column) setOrder(order === "ASC" ? "DESC" : "ASC")
    else { setSort(column); setOrder("ASC") }
  }

  const handleExport = () => {
    const p: Record<string, string> = {}
    if (search) p.search = search
    if (category !== "all") p.category = category
    exportToExcel("/api/products/export", p, "products.xlsx")
  }

  const openStock = (product: Product, type: "in" | "out") => { setStockProduct(product); setStockType(type) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-lg">{t("products.title")}</h2>
        {isAdmin && <Button onClick={() => navigate("/products/new")}><Plus className="h-4 w-4 mr-2" />{t("products.addProduct")}</Button>}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("products.search")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder={t("products.allCategories")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("products.allCategories")}</SelectItem>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-2" />{t("products.imp")}</Button>
                <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-2" />{t("products.export")}</Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>{t("products.name")} {sort === "name" && (order === "ASC" ? "↑" : "↓")}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort("sku")}>{t("products.sku")} {sort === "sku" && (order === "ASC" ? "↑" : "↓")}</TableHead>
                <TableHead>{t("products.category")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort("price")}>{t("products.purchasePrice")} {sort === "price" && (order === "ASC" ? "↑" : "↓")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort("sell_price")}>{t("products.sellPrice")} {sort === "sell_price" && (order === "ASC" ? "↑" : "↓")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort("stock")}>{t("products.stock")} {sort === "stock" && (order === "ASC" ? "↑" : "↓")}</TableHead>
                {isAdmin && <TableHead className="w-[50px]">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">{t("products.noProducts")}</TableCell></TableRow>
              ) : products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code></TableCell>
                  <TableCell>{product.category || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(product.sell_price)}</TableCell>
                  <TableCell className="text-right">
                    {product.stock <= product.low_stock_threshold ? <Badge variant="destructive">{product.stock}</Badge> : <span>{product.stock}</span>}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/products/${product.id}/edit`)}>{t("common.edit")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openStock(product, "in")}><PackagePlus className="h-4 w-4 mr-2" />{t("products.stockIn")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openStock(product, "out")}><PackageMinus className="h-4 w-4 mr-2" />{t("products.stockOut")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(t("products.confirmDelete", { name: product.name }))) deleteMutation.mutate(product.id) }}>{t("common.delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">{t("products.pageInfo", { page, totalPages, total })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <StockMovementDialog product={stockProduct} type={stockType} open={Boolean(stockProduct)} onOpenChange={(open: boolean) => { if (!open) setStockProduct(null) }} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
