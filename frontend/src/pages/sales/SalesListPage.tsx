import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import type { SaleDetail, Product } from "@integracore/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog"
import { CreateSaleDialog } from "@/components/sales/CreateSaleDialog"
import { Plus, Eye, Trash2, Download } from "lucide-react"

interface UserListItem {
  id: number
  full_name: string
  username: string
}

export default function SalesListPage() {
  const { isAdmin } = useAuth()

  const [sales, setSales] = useState<SaleDetail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [sellerFilter, setSellerFilter] = useState("all")
  const [productFilter, setProductFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [users, setUsers] = useState<UserListItem[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [detailSale, setDetailSale] = useState<SaleDetail | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (sellerFilter && sellerFilter !== "all") params.set("user_id", sellerFilter)
      if (productFilter && productFilter !== "all") params.set("product_id", productFilter)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)

      const res = await api.get(`/api/sales?${params}`)
      setSales(res.data.sales)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [page, sellerFilter, productFilter, dateFrom, dateTo])

  const fetchFilters = useCallback(async () => {
    try {
      if (isAdmin) {
        const usersRes = await api.get("/api/users")
        setUsers(usersRes.data.users)
      }
      const productsRes = await api.get("/api/products?limit=100")
      setProducts(productsRes.data.products)
    } catch {
    }
  }, [isAdmin])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  useEffect(() => {
    fetchFilters()
  }, [fetchFilters])

  useEffect(() => {
    setPage(1)
  }, [sellerFilter, productFilter, dateFrom, dateTo])

  const handleExport = async () => {
    const params = new URLSearchParams()
    if (sellerFilter && sellerFilter !== "all") params.set("user_id", sellerFilter)
    if (productFilter && productFilter !== "all") params.set("product_id", productFilter)
    if (dateFrom) params.set("date_from", dateFrom)
    if (dateTo) params.set("date_to", dateTo)
    const res = await api.get(`/api/sales/export?${params}`, { responseType: "blob" })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement("a")
    a.href = url
    a.download = "sales.xlsx"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (sale: SaleDetail) => {
    if (!confirm(`Delete sale #${sale.id} (${sale.seller_name}, $${sale.total.toFixed(2)})? This will restore stock.`))
      return
    try {
      await api.delete(`/api/sales/${sale.id}`)
      fetchSales()
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete sale")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Sales</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sale
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-end gap-3 flex-wrap">
            {isAdmin && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Seller</Label>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All sellers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sellers</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Product</Label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">#{sale.id}</TableCell>
                    <TableCell>
                      {new Date(sale.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{sale.seller_name}</TableCell>
                    <TableCell className="text-right">{sale.items.length}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${sale.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDetailSale(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(sale)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} sales)
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

      <SaleDetailDialog
        sale={detailSale}
        open={Boolean(detailSale)}
        onOpenChange={(open) => { if (!open) setDetailSale(null) }}
      />
      <CreateSaleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={fetchSales}
      />
    </div>
  )
}
