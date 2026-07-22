import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import api from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { Product } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StockInDialog } from "@/components/products/StockInDialog"
import { StockOutDialog } from "@/components/products/StockOutDialog"
import { ImportDialog } from "@/components/products/ImportDialog"
import { Plus, MoreHorizontal, Search, PackagePlus, PackageMinus, Download, Upload } from "lucide-react"

export default function ProductListPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [sort, setSort] = useState("created_at")
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC")
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])

  const [stockInProduct, setStockInProduct] = useState<Product | null>(null)
  const [stockOutProduct, setStockOutProduct] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        sort,
        order,
      })
      if (search) params.set("search", search)
      if (category && category !== "all") params.set("category", category)

      const res = await api.get(`/api/products?${params}`)
      setProducts(res.data.products)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, search, category, sort, order])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/api/products?limit=100")
      const cats = [...new Set(res.data.products.map((p: Product) => p.category).filter(Boolean))] as string[]
      setCategories(cats.sort())
    } catch {
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    setPage(1)
  }, [search, category])

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (category && category !== "all") params.set("category", category)
    const res = await api.get(`/api/products/export?${params}`, { responseType: "blob" })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement("a")
    a.href = url
    a.download = "products.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"?`)) return
    try {
      await api.delete(`/api/products/${product.id}`)
      fetchProducts()
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete product")
    }
  }

  const handleSort = (column: string) => {
    if (sort === column) {
      setOrder(order === "ASC" ? "DESC" : "ASC")
    } else {
      setSort(column)
      setOrder("ASC")
    }
  }

  const isLowStock = (product: Product) => product.stock <= product.low_stock_threshold

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Products</h2>
        {isAdmin && (
          <Button onClick={() => navigate("/products/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("name")}
                >
                  Name {sort === "name" && (order === "ASC" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort("sku")}
                >
                  SKU {sort === "sku" && (order === "ASC" ? "↑" : "↓")}
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground text-right"
                  onClick={() => handleSort("price")}
                >
                  Price {sort === "price" && (order === "ASC" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground text-right"
                  onClick={() => handleSort("stock")}
                >
                  Stock {sort === "stock" && (order === "ASC" ? "↑" : "↓")}
                </TableHead>
                {isAdmin && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{product.sku}</code>
                    </TableCell>
                    <TableCell>{product.category || "—"}</TableCell>
                    <TableCell className="text-right">${product.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {isLowStock(product) ? (
                        <Badge variant="destructive">{product.stock}</Badge>
                      ) : (
                        <span>{product.stock}</span>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/products/${product.id}/edit`)}>
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStockInProduct(product)}>
                              <PackagePlus className="h-4 w-4 mr-2" />
                              Stock In
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStockOutProduct(product)}>
                              <PackageMinus className="h-4 w-4 mr-2" />
                              Stock Out
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(product)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} products)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <StockInDialog
        product={stockInProduct}
        open={Boolean(stockInProduct)}
        onOpenChange={(open) => { if (!open) setStockInProduct(null) }}
        onSuccess={fetchProducts}
      />
      <StockOutDialog
        product={stockOutProduct}
        open={Boolean(stockOutProduct)}
        onOpenChange={(open) => { if (!open) setStockOutProduct(null) }}
        onSuccess={fetchProducts}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => { fetchProducts(); fetchCategories() }}
      />
    </div>
  )
}
