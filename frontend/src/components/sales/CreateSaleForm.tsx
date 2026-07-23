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
import { X, Search } from "lucide-react"
import { formatCurrency } from "@/lib/format"

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
    return products.filter((p) => (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) && !cart.some((c) => c.product.id === p.id)).slice(0, 10)
  }, [search, products, cart])

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const addToCart = (product: Product) => { setCart([...cart, { product, quantity: 1 }]); setSearch("") }
  const updateQuantity = (productId: number, qty: number) => { if (qty < 1) return; setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item))) }
  const removeFromCart = (productId: number) => setCart(cart.filter((item) => item.product.id !== productId))

  const createSale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error(t("sales.create.minOneProduct"))
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
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button key={product.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center" onClick={() => addToCart(product)}>
                    <span>{product.name} <code className="text-xs text-muted-foreground">{product.sku}</code></span>
                    <span className="text-muted-foreground">{formatCurrency(product.price)} | {t("sales.create.stockLabel", { stock: product.stock })}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sales.product")}</TableHead>
                    <TableHead className="text-right">{t("products.price")}</TableHead>
                    <TableHead className="text-right w-[100px]">{t("sales.create.qty")}</TableHead>
                    <TableHead className="text-right">{t("sales.create.subtotal")}</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.product.id}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.product.price)}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)} className="h-8 w-16 text-right" />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.product.price * item.quantity)}</TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.product.id)}><X className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="flex justify-end"><span className="text-lg font-bold">{t("sales.create.totalLabel", { amount: formatCurrency(total) })}</span></div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="sale-notes">{t("sales.create.notes")}</Label>
            <Textarea id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sales.create.notesPlaceholder")} rows={2} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={createSale.isPending || cart.length === 0}>{createSale.isPending ? t("sales.create.processing") : t("sales.create.completeSale")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
