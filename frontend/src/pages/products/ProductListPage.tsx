import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/contexts/AuthContext"
import { useExportExcel } from "@/hooks/useExportExcel"
import { useAllProducts, useProductCategories } from "@/hooks/useProductQueries"
import api from "@/lib/api"
import { formatCurrency, formatDate } from "@/lib/format"
import { queryKeys } from "@/lib/queryKeys"
import { PRODUCT_STATUS, type Product } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { SuggestiveInput } from "@/components/ui/suggestive-input"
import { Pagination } from "@/components/Pagination"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { StockMovementDialog } from "@/components/products/StockMovementDialog"
import { ImportDialog } from "@/components/products/ImportDialog"
import { CreateDiscountDialog } from "@/components/discounts/CreateDiscountDialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { QueryErrorState } from "@/components/ui/query-error"
import { EmptyState } from "@/components/ui/empty-state"
import { Plus, MoreHorizontal, PackagePlus, PackageMinus, Download, Upload, Tag, Percent, Info, SearchX } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errorMessages"

export default function ProductListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { exportToExcel } = useExportExcel()

  const [page, setPage] = useState(1)
  // `searchInput` is what the user types; `search` follows it debounced so a
  // keystroke-per-query doesn't flash the table on slow LAN links.
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sort, setSort] = useState("created_at")
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC")
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockType, setStockType] = useState<"in" | "out">("in")
  const [importOpen, setImportOpen] = useState(false)
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null)
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null)

  const [limit, setLimit] = useState(20)
  const params = { page: String(page), limit: String(limit), sort, order, ...(search && { search }), ...(category !== "all" && { category }), ...(statusFilter !== "all" && { status: statusFilter }) }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: async () => {
      const res = await api.get(`/api/products?${new URLSearchParams(params)}`)
      return { products: res.data.products as Product[], total: res.data.total as number, totalPages: res.data.totalPages as number }
    },
    placeholderData: (prev) => prev,
  })

  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(id)
  }, [searchInput])

  const products = data?.products ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1

  const categories = useProductCategories().data ?? []

  // Suggestion source for the search box: all products, matched accent- and
  // case-insensitively on name or SKU (server-side LIKE is not diacritic-safe).
  const allProducts = useAllProducts().data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/products/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.products.all }); toast.success(t("products.deleted")) },
    onError: (err: unknown) => toast.error(getErrorMessage(err, "products.failedDelete")),
  })

  const handleSort = (column: string) => {
    if (sort === column) setOrder(order === "ASC" ? "DESC" : "ASC")
    else { setSort(column); setOrder("ASC") }
    setPage(1)
  }

  const handleExport = () => {
    const p: Record<string, string> = {}
    if (search) p.search = search
    if (category !== "all") p.category = category
    if (statusFilter !== "all") p.status = statusFilter
    exportToExcel("/api/products/export", p, "products.xlsx")
  }

  const openStock = (product: Product, type: "in" | "out") => { setStockProduct(product); setStockType(type) }

  const hasFilters = searchInput !== "" || category !== "all" || statusFilter !== "all"
  const clearFilters = () => { setSearchInput(""); setSearch(""); setCategory("all"); setStatusFilter("all"); setPage(1) }

  const colCount = isAdmin ? 8 : 6

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline-lg">{t("products.title")}</h2>
        {isAdmin && <Button onClick={() => navigate("/products/new")}><Plus className="h-4 w-4 mr-2" />{t("products.addProduct")}</Button>}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <SuggestiveInput
              value={searchInput}
              onValueChange={setSearchInput}
              className="flex-1 min-w-[200px] max-w-sm"
              items={allProducts}
              itemKey={(p) => p.id}
              itemText={(p) => `${p.name} ${p.sku}`}
              renderItem={(p) => (
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <code className="text-xs text-muted-foreground font-data">{p.sku}</code>
                </span>
              )}
              onPick={(p) => { setSearch(p.sku); setPage(1) }}
              placeholder={t("products.search")}
            />
            <SearchableSelect
              value={category}
              onValueChange={(v) => { setCategory(v); setPage(1) }}
              options={categories.map((cat: string) => ({ value: cat, label: cat }))}
              allLabel={t("products.allCategories")}
              searchPlaceholder={t("common.search")}
              noResultsText={t("common.noMatches")}
              clearLabel={t("common.clearFilter")}
            />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("products.statusFilter")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("products.statusFilter")}</SelectItem>
                <SelectItem value="active">{t("products.active")}</SelectItem>
                <SelectItem value="discontinued">{t("products.discontinued")}</SelectItem>
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
                <TableHead aria-sort={sort === "name" ? (order === "ASC" ? "ascending" : "descending") : undefined}>
                  <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" onClick={() => handleSort("name")}>
                    {t("products.name")} {sort === "name" && <span aria-hidden>{order === "ASC" ? "↑" : "↓"}</span>}
                  </button>
                </TableHead>
                <TableHead aria-sort={sort === "sku" ? (order === "ASC" ? "ascending" : "descending") : undefined}>
                  <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" onClick={() => handleSort("sku")}>
                    {t("products.sku")} {sort === "sku" && <span aria-hidden>{order === "ASC" ? "↑" : "↓"}</span>}
                  </button>
                </TableHead>
                <TableHead>{t("products.category")}</TableHead>
                {isAdmin && (
                  <TableHead className="text-right" aria-sort={sort === "price" ? (order === "ASC" ? "ascending" : "descending") : undefined}>
                    <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" onClick={() => handleSort("price")}>
                      {t("products.purchasePrice")} {sort === "price" && <span aria-hidden>{order === "ASC" ? "↑" : "↓"}</span>}
                    </button>
                  </TableHead>
                )}
                <TableHead className="text-right">{t("products.effectivePrice")}</TableHead>
                <TableHead className="text-right" aria-sort={sort === "stock" ? (order === "ASC" ? "ascending" : "descending") : undefined}>
                  <button type="button" className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground" onClick={() => handleSort("stock")}>
                    {t("products.stock")} {sort === "stock" && <span aria-hidden>{order === "ASC" ? "↑" : "↓"}</span>}
                  </button>
                </TableHead>
                <TableHead>{t("products.status")}</TableHead>
                {isAdmin && <TableHead className="w-[50px]">{t("common.actions")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isError ? (
                <TableRow><TableCell colSpan={colCount} className="py-4"><QueryErrorState onRetry={refetch} error={error} /></TableCell></TableRow>
              ) : isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    {isAdmin && <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>}
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    {isAdmin && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                  </TableRow>
                ))
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount}>
                    {hasFilters ? (
                      <EmptyState
                        icon={SearchX}
                        title={t("products.noProducts")}
                        description={t("products.noProductsFilters")}
                        action={<Button variant="outline" size="sm" onClick={clearFilters}>{t("products.clearFilters")}</Button>}
                      />
                    ) : (
                      <EmptyState
                        title={t("products.emptyTitle")}
                        description={isAdmin ? t("products.emptyDescAdmin") : t("products.emptyDescSeller")}
                        action={isAdmin && (
                          <Button onClick={() => navigate("/products/new")}>
                            <Plus className="h-4 w-4 mr-2" />{t("products.addProduct")}
                          </Button>
                        )}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : products.map((product) => (
                <TableRow key={product.id} className={cn((product.status ?? PRODUCT_STATUS.active) === PRODUCT_STATUS.discontinued && "opacity-60")}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code></TableCell>
                  <TableCell>{product.category || "—"}</TableCell>
                  {isAdmin && <TableCell className="text-right">{formatCurrency(product.price)}</TableCell>}
                  <TableCell className="text-right">
                    {product.discounted_price ? (
                      <span className="flex items-center justify-end gap-1">
                        <Tag className="h-3.5 w-3.5 text-warning" />
                        <div className="flex flex-col items-end">
                          <span className="line-through text-muted-foreground mr-1">{formatCurrency(product.sell_price)}</span>
                          <span className="font-semibold text-warning">{formatCurrency(product.discounted_price)}</span>
                        </div>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {product.discount_end_date
                                ? t("products.until", { date: formatDate(product.discount_end_date) })
                                : t("discounts.active")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                    ) : (
                      <span>{formatCurrency(product.sell_price)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {product.stock <= product.low_stock_threshold ? (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><Badge variant="destructive">{product.stock}</Badge></span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {t("products.lowStockHint", { count: product.low_stock_threshold })}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : <span>{product.stock}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={(product.status ?? PRODUCT_STATUS.active) === PRODUCT_STATUS.active ? "success-light" : "secondary"}>
                      {t(`products.${product.status ?? PRODUCT_STATUS.active}`)}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 min-h-0 p-0" aria-label={t("common.actions")}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/products/${product.id}/edit`)}>{t("common.edit")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openStock(product, "in")}><PackagePlus className="h-4 w-4 mr-2" />{t("products.stockIn")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openStock(product, "out")}><PackageMinus className="h-4 w-4 mr-2" />{t("products.stockOut")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate(`/discounts?productId=${product.id}`)}><Percent className="h-4 w-4 mr-2" />{t("discounts.history")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDiscountProduct(product)}><Tag className="h-4 w-4 mr-2" />{t("discounts.createDiscount")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteProduct(product)}>{t("common.delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} total={total} pageInfoKey="products.pageInfo" onPageChange={setPage} limit={limit} onLimitChange={(l) => { setLimit(l); setPage(1) }} />
        </CardContent>
      </Card>
      <StockMovementDialog product={stockProduct} type={stockType} open={Boolean(stockProduct)} onOpenChange={(open: boolean) => { if (!open) setStockProduct(null) }} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CreateDiscountDialog product={discountProduct} open={Boolean(discountProduct)} onOpenChange={(open: boolean) => { if (!open) setDiscountProduct(null) }} />
      <ConfirmDialog
        open={confirmDeleteProduct !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmDeleteProduct(null) }}
        title={t("products.confirmDeleteTitle")}
        description={confirmDeleteProduct ? t("products.confirmDelete", { name: confirmDeleteProduct.name }) : undefined}
        confirmLabel={t("common.delete")}
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => { if (confirmDeleteProduct) { deleteMutation.mutate(confirmDeleteProduct.id); setConfirmDeleteProduct(null) } }}
      />
    </div>
  )
}
