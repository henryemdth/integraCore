import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { X, Search, Loader2, Tag } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface CartItem { product: Product; quantity: number }

interface CreateSaleFormProps {
  onSaleCreated?: () => void
}

export function CreateSaleForm({ onSaleCreated }: CreateSaleFormProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const queryClient = useQueryClient()

  const { data: products = [] } = useQuery({
    queryKey: ["products", "list-all"],
    queryFn: async () => { const res = await api.get("/api/products?limit=100"); return res.data.products as Product[] },
  })

  useEffect(() => {
    setCart([])
    setNotes("")
    setError("")
    setSearch("")
  }, [])

  const filteredProducts = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return products.filter((p) => p.status !== "discontinued" && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) && !cart.some((c) => c.product.id === p.id)).slice(0, 10)
  }, [search, products, cart])

  const total = cart.reduce((sum, item) => sum + (item.product.discounted_price ?? item.product.sell_price) * item.quantity, 0)
  const totalSavings = cart.reduce((sum, item) => sum + (item.product.discounted_price ? (item.product.sell_price - item.product.discounted_price) * item.quantity : 0), 0)

  const hasInsufficientStock = cart.some((item) => item.product.stock === 0 || item.quantity > item.product.stock)

  const addToCart = (product: Product) => {
    if (product.stock === 0) return
    setCart([...cart, { product, quantity: 1 }])
    setSearch("")
  }

  const updateQuantity = (productId: number, qty: number) => {
    if (qty < 1) return
    setCart(cart.map((item) => {
      if (item.product.id !== productId) return item
      const maxQty = item.product.stock
      return { ...item, quantity: Math.min(qty, maxQty) }
    }))
  }

  const removeFromCart = (productId: number) => setCart(cart.filter((item) => item.product.id !== productId))

  const createSale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error(t("sales.create.minOneProduct"))
      if (hasInsufficientStock) throw new Error(t("sales.create.insufficientStock"))
      await api.post("/api/sales", {
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        notes: notes || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(t("sales.create.created"))
      setCart([])
      setNotes("")
      setError("")
      setSearch("")
      onSaleCreated?.()
    },
    onError: (err: any) => {
      const msg = err.message || err.response?.data?.error || t("sales.create.failedCreate")
      setError(msg)
      if (!err.message) toast.error(msg)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sales.create.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); setError(""); createSale.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label>{t("sales.create.addProduct")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("sales.products.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {filteredProducts.length > 0 && (
              <div className="border border-border rounded-md max-h-40 overflow-y-auto">
                {filteredProducts.map((product) => {
                  const outOfStock = product.stock === 0
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={outOfStock}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm flex justify-between items-center border-b border-border last:border-b-0 transition-colors",
                        outOfStock ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-container"
                      )}
                      onClick={() => addToCart(product)}
                    >
                      <span>
                        <span className="font-medium">{product.name}</span>
                        <code className="text-xs text-muted-foreground ml-2 font-data">{product.sku}</code>
                      </span>
                      <span className="flex items-center gap-3">
                        {product.discounted_price ? (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3 text-amber-500" />
                            <span className="line-through text-muted-foreground font-data">{formatCurrency(product.sell_price)}</span>
                            <span className="font-semibold text-amber-600 font-data">{formatCurrency(product.discounted_price)}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-data">{formatCurrency(product.sell_price)}</span>
                        )}
                        <span className={cn("text-body-sm font-data", outOfStock ? "text-destructive font-medium" : "text-muted-foreground")}>
                          {outOfStock ? t("sales.create.outOfStock") : t("sales.create.stockLabel", { stock: product.stock })}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sales.product")}</TableHead>
                    <TableHead className="text-right">{t("products.sellPrice")}</TableHead>
                    <TableHead className="text-right w-[100px]">{t("sales.create.qty")}</TableHead>
                    <TableHead className="text-right">{t("sales.create.subtotal")}</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => {
                    const atLimit = item.quantity >= item.product.stock
                    const effectivePrice = item.product.discounted_price ?? item.product.sell_price
                    return (
                      <TableRow key={item.product.id}>
                        <TableCell className="font-medium">
                          {item.product.name}
                          <code className="text-xs text-muted-foreground ml-2 font-data">{item.product.sku}</code>
                        </TableCell>
                        <TableCell className="text-right font-data">
                          {item.product.discounted_price ? (
                            <span className="flex items-center justify-end gap-1">
                              <Tag className="h-3 w-3 text-amber-500" />
                              <span className="line-through text-muted-foreground">{formatCurrency(item.product.sell_price)}</span>
                              <span className="font-semibold text-amber-600">{formatCurrency(item.product.discounted_price)}</span>
                            </span>
                          ) : (
                            formatCurrency(item.product.sell_price)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                            className={cn("h-8 w-16 text-right font-data", atLimit && "text-destructive")}
                          />
                        </TableCell>
                        <TableCell className="text-right font-data font-semibold">{formatCurrency(effectivePrice * item.quantity)}</TableCell>
                        <TableCell><Button type="button" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeFromCart(item.product.id)}><X className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Separator />
              {hasInsufficientStock && (
                <Alert variant="destructive">
                  <AlertDescription>{t("sales.create.insufficientStock")}</AlertDescription>
                </Alert>
              )}
              {totalSavings > 0 && (
                <div className="flex justify-end text-sm text-muted-foreground">
                  <span className="font-data">{t("sales.create.savingsFromDiscounts", { amount: formatCurrency(totalSavings) })}</span>
                </div>
              )}
              <div className="flex justify-end"><span className="text-headline-sm font-data">{t("sales.create.totalLabel", { amount: formatCurrency(total) })}</span></div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="sale-notes">{t("sales.create.notes")}</Label>
            <Textarea id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sales.create.notesPlaceholder")} rows={2} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createSale.isPending || cart.length === 0 || hasInsufficientStock}>
              {createSale.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {createSale.isPending ? t("sales.create.processing") : t("sales.create.completeSale")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
