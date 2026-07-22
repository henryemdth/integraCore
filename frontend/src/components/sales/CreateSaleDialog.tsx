import { useState, useEffect, useMemo } from "react"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { X, Search } from "lucide-react"

interface CartItem {
  product: Product
  quantity: number
}

interface CreateSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      api.get("/api/products?limit=100").then((res) => setProducts(res.data.products))
      setCart([])
      setNotes("")
      setError("")
      setSearch("")
    }
  }, [open])

  const filteredProducts = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return products
      .filter(
        (p) =>
          (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
          !cart.some((c) => c.product.id === p.id)
      )
      .slice(0, 10)
  }, [search, products, cart])

  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  const addToCart = (product: Product) => {
    setCart([...cart, { product, quantity: 1 }])
    setSearch("")
  }

  const updateQuantity = (productId: number, qty: number) => {
    if (qty < 1) return
    setCart(cart.map((item) => (item.product.id === productId ? { ...item, quantity: qty } : item)))
  }

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) {
      setError("Add at least one product to the sale")
      return
    }
    setError("")
    setLoading(true)
    try {
      await api.post("/api/sales", {
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        notes: notes || undefined,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create sale")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Sale</DialogTitle>
          <DialogDescription>Search for products and add them to the sale</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Add Product</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {filteredProducts.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center"
                    onClick={() => addToCart(product)}
                  >
                    <span>
                      {product.name}{" "}
                      <code className="text-xs text-muted-foreground">{product.sku}</code>
                    </span>
                    <span className="text-muted-foreground">
                      ${product.price.toFixed(2)} | Stock: {product.stock}
                    </span>
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
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right w-[100px]">Qty</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.product.id}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell className="text-right">${item.product.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              <div className="flex justify-end">
                <span className="text-lg font-bold">Total: ${total.toFixed(2)}</span>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="sale-notes">Notes</Label>
            <Textarea
              id="sale-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this sale"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || cart.length === 0}>
              {loading ? "Processing..." : "Complete Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
