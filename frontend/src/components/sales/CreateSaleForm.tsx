import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Product, SaleDetail } from "@integracore/shared"
import { PRODUCT_STATUS } from "@integracore/shared"
import { toast } from "sonner"
import { useAllProducts } from "@/hooks/useProductQueries"
import { queryKeys } from "@/lib/queryKeys"
import { PriceWithDiscount } from "@/components/PriceWithDiscount"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { X, Search, Loader2, Minus, Plus } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { getErrorMessage } from "@/lib/errorMessages"
import { SaleSuccessDialog } from "@/components/sales/SaleSuccessDialog"

interface CartItem { product: Product; quantity: number }

// The half-built sale survives accidental navigation and page refreshes:
// only product ids + quantities are stored and rebuilt against the fresh
// catalogue on return (prices/stock may have changed in the meantime).
const CART_STORAGE_KEY = "sales.cart.inProgress"

interface StoredCart { items: { id: number; quantity: number }[]; notes: string }

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

export function CreateSaleForm() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [highlight, setHighlight] = useState(0)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [completedSale, setCompletedSale] = useState<SaleDetail | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const restoredRef = useRef(false)
  const queryClient = useQueryClient()

  const products = useAllProducts().data ?? []

  // Keep cart lines in sync with the live catalogue: socket invalidations
  // refetch products (price/stock edits, discount start/end), and a stale
  // cart would otherwise sell at an outdated price (AGENTS.md §6).
  const priceChangeRef = useRef<Map<number, number>>(new Map())
  useEffect(() => {
    if (products.length === 0 || cart.length === 0) return
    let changed = false
    const next = cart.flatMap((item) => {
      const fresh = products.find((p) => p.id === item.product.id)
      if (!fresh || fresh.status === PRODUCT_STATUS.discontinued) {
        changed = true
        toast.warning(t("sales.create.removedUnavailable", { name: item.product.name } as Record<string, string>))
        return []
      }
      const freshPrice = fresh.discounted_price ?? fresh.sell_price
      const oldPrice = item.product.discounted_price ?? item.product.sell_price
      if (freshPrice !== oldPrice && priceChangeRef.current.get(fresh.id) !== freshPrice) {
        priceChangeRef.current.set(fresh.id, freshPrice)
        toast.info(t("sales.create.priceUpdated", { name: fresh.name } as Record<string, string>))
      }
      if (fresh !== item.product) {
        changed = true
        return [{ product: fresh, quantity: Math.min(item.quantity, Math.max(1, fresh.stock)) }]
      }
      return [item]
    })
    if (changed) setCart(next)
  }, [products, cart, t])

  // Restore an interrupted sale once the catalogue is available.
  const [pendingRestore, setPendingRestore] = useState<StoredCart | null>(() => {
    try {
      const raw = sessionStorage.getItem(CART_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as StoredCart) : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    if (restoredRef.current || !pendingRestore || products.length === 0) return
    restoredRef.current = true
    const rebuilt: CartItem[] = []
    for (const saved of pendingRestore.items) {
      const product = products.find((p) => p.id === saved.id)
      if (product && product.status !== PRODUCT_STATUS.discontinued && product.stock > 0) {
        rebuilt.push({ product, quantity: Math.min(saved.quantity, product.stock) })
      }
    }
    setPendingRestore(null)
    if (rebuilt.length > 0) {
      setCart(rebuilt)
      setNotes(pendingRestore.notes)
      toast.info(t("sales.create.cartRestored", { count: rebuilt.length }))
    }
  }, [products, pendingRestore, t])

  // Keep the stored copy in sync while the cart is being built.
  useEffect(() => {
    if (pendingRestore) return
    if (cart.length === 0) {
      sessionStorage.removeItem(CART_STORAGE_KEY)
      return
    }
    const stored: StoredCart = {
      items: cart.map((item) => ({ id: item.product.id, quantity: item.quantity })),
      notes,
    }
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stored))
  }, [cart, notes, pendingRestore])

  // Warn before closing/refreshing the tab with an unfinished sale.
  useEffect(() => {
    if (cart.length === 0) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [cart.length])

  // Focus the search box on mount so scanning/typing starts immediately.
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const filteredProducts = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return products.filter((p) => p.status !== PRODUCT_STATUS.discontinued && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, 10)
  }, [search, products])

  useEffect(() => { setHighlight(0) }, [search])

  const total = cart.reduce((sum, item) => sum + (item.product.discounted_price ?? item.product.sell_price) * item.quantity, 0)
  const totalSavings = cart.reduce((sum, item) => sum + (item.product.discounted_price ? (item.product.sell_price - item.product.discounted_price) * item.quantity : 0), 0)

  const hasInsufficientStock = cart.some((item) => item.product.stock === 0 || item.quantity > item.product.stock)

  const addToCart = (product: Product) => {
    if (product.stock === 0) return
    const inCart = cart.find((c) => c.product.id === product.id)
    if (inCart) {
      updateQuantity(product.id, inCart.quantity + 1)
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
    setSearch("")
    setHighlight(0)
    searchInputRef.current?.focus()
  }

  const updateQuantity = (productId: number, qty: number) => {
    setCart(cart.map((item) => {
      if (item.product.id !== productId) return item
      if (qty > item.product.stock) {
        toast.warning(t("sales.create.qtyCapped", { name: item.product.name, stock: item.product.stock }), {
          id: `qty-cap-${productId}`,
        })
        return { ...item, quantity: item.product.stock }
      }
      return { ...item, quantity: Math.max(1, qty) }
    }))
  }

  const removeFromCart = (productId: number) => setCart(cart.filter((item) => item.product.id !== productId))

  // Enter in the search box adds the exact SKU match (barcode scanners send
  // typed text + Enter); falling back to the highlighted suggestion. Scanning
  // an item already in the cart bumps its quantity instead. Arrow keys move
  // the highlight so sellers never touch the mouse.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && filteredProducts.length > 0) {
      e.preventDefault()
      setHighlight((h) => (h + 1) % filteredProducts.length)
      return
    }
    if (e.key === "ArrowUp" && filteredProducts.length > 0) {
      e.preventDefault()
      setHighlight((h) => (h - 1 + filteredProducts.length) % filteredProducts.length)
      return
    }
    if (e.key !== "Enter") return
    e.preventDefault()
    const query = normalize(search.trim())
    if (!query) return
    const saleable = products.filter((p) => p.status !== PRODUCT_STATUS.discontinued && p.stock > 0)
    const exact = saleable.find((p) => normalize(p.sku) === query)
    if (exact) {
      const inCart = cart.find((c) => c.product.id === exact.id)
      if (inCart) {
        updateQuantity(exact.id, inCart.quantity + 1)
        setSearch("")
        searchInputRef.current?.focus()
        return
      }
      addToCart(exact)
      return
    }
    if (filteredProducts[highlight] ?? filteredProducts[0]) addToCart((filteredProducts[highlight] ?? filteredProducts[0]))
  }

  const createSale = useMutation({
    mutationFn: async (): Promise<SaleDetail> => {
      if (cart.length === 0) throw new Error(t("sales.create.minOneProduct"))
      if (hasInsufficientStock) throw new Error(t("sales.create.insufficientStock"))
      const res = await api.post("/api/sales", {
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        notes: notes || undefined,
      })
      return res.data.sale
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      toast.success(t("sales.create.created"))
      setCompletedSale(sale)
      setCart([])
      setNotes("")
      setError("")
      setSearch("")
    },
    onError: (err: unknown) => {
      // getErrorMessage keeps translated client-side validation messages as-is
      // and maps axios failures through the backend code (never the raw
      // English axios message).
      setError(getErrorMessage(err, "sales.create.failedCreate"))
    },
  })

  // F2 completes the sale from anywhere in the form — the fastest path for
  // keyboard-driven sellers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault()
        if (cart.length > 0 && !hasInsufficientStock && !createSale.isPending) createSale.mutate()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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
            <Label htmlFor="sale-search">{t("sales.create.addProduct")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="sale-search"
                ref={searchInputRef}
                placeholder={t("sales.create.searchProduct")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoComplete="off"
                className="pl-9"
              />
            </div>
            {filteredProducts.length > 0 && (
              <div className="border border-border rounded-md max-h-40 overflow-y-auto" role="listbox" aria-label={t("sales.create.addProduct")}>
                {filteredProducts.map((product, idx) => {
                  const outOfStock = product.stock === 0
                  const inCartQty = cart.find((c) => c.product.id === product.id)?.quantity ?? 0
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={idx === highlight}
                      disabled={outOfStock}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm flex justify-between items-center border-b border-border last:border-b-0 transition-colors min-h-[44px]",
                        outOfStock ? "opacity-50 cursor-not-allowed" : "hover:bg-surface-container",
                        idx === highlight && !outOfStock && "bg-surface-container"
                      )}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => addToCart(product)}
                    >
                      <span>
                        <span className="font-medium">{product.name}</span>
                        {product.category && (
                          <span className="text-xs text-muted-foreground ml-2">{product.category}</span>
                        )}
                        {inCartQty > 0 && (
                          <span className="text-xs font-medium text-primary ml-2">×{inCartQty} {t("sales.create.inCart")}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <PriceWithDiscount original={product.sell_price} discounted={product.discounted_price} />
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
                    <TableHead className="text-right w-[140px]">{t("sales.create.qty")}</TableHead>
                    <TableHead className="text-right">{t("sales.create.subtotal")}</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => {
                    const effectivePrice = item.product.discounted_price ?? item.product.sell_price
                    return (
                      <TableRow key={item.product.id}>
                        <TableCell className="font-medium">
                          {item.product.name}
                          <code className="text-xs text-muted-foreground ml-2 font-data">{item.product.category}</code>
                        </TableCell>
                        <TableCell className="text-right">
                          <PriceWithDiscount original={item.product.sell_price} discounted={item.product.discounted_price} align="right" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              disabled={item.quantity <= 1}
                              aria-label={t("common.decrease")}
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="1"
                              max={item.product.stock}
                              value={item.quantity}
                              aria-label={t("sales.create.qty")}
                              onChange={(e) => {
                                const parsed = parseInt(e.target.value)
                                if (e.target.value === "") return
                                updateQuantity(item.product.id, Number.isNaN(parsed) ? 1 : parsed)
                              }}
                              onBlur={(e) => {
                                const parsed = parseInt(e.target.value)
                                const clamped = Number.isNaN(parsed)
                                  ? 1
                                  : Math.min(Math.max(1, parsed), Math.max(1, item.product.stock))
                                if (clamped !== item.quantity) updateQuantity(item.product.id, clamped)
                              }}
                              className="h-11 w-16 text-center font-data"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-11 w-11"
                              aria-label={t("common.increase")}
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-data font-semibold">{formatCurrency(effectivePrice * item.quantity)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9 w-9 p-0"
                            aria-label={t("sales.create.removeItem")}
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
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
              <div className="sticky bottom-0 bg-card py-2 space-y-1">
                {totalSavings > 0 && (
                  <div className="flex justify-end text-sm text-muted-foreground">
                    <span className="font-data">{t("sales.create.savingsFromDiscounts", { amount: formatCurrency(totalSavings) })}</span>
                  </div>
                )}
                <div className="flex justify-end"><span className="text-headline-sm font-data">{t("sales.create.totalLabel", { amount: formatCurrency(total) })}</span></div>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="sale-notes">{t("sales.create.notes")}</Label>
            <Textarea id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sales.create.notesPlaceholder")} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            {cart.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => { setCart([]); setSearch("") }}>
                {t("sales.create.clearCart")}
              </Button>
            )}
            <Button type="submit" className="min-h-[44px] px-6" disabled={createSale.isPending || cart.length === 0 || hasInsufficientStock} title="F2">
              {createSale.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {createSale.isPending ? t("sales.create.processing") : t("sales.create.completeSale")}
            </Button>
          </div>
        </form>
      </CardContent>
      <SaleSuccessDialog
        sale={completedSale}
        open={!!completedSale}
        onNewSale={() => {
          setCompletedSale(null)
          // The dialog unmounts synchronously and Radix's focus restore runs
          // after this handler; refocus the search box once it has finished.
          window.setTimeout(() => searchInputRef.current?.focus(), 100)
        }}
      />
    </Card>
  )
}
