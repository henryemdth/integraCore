import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"

interface StockOutDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function StockOutDialog({ product, open, onOpenChange, onSuccess }: StockOutDialogProps) {
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product) return
    setError("")
    setLoading(true)
    try {
      await api.post(`/api/products/${product.id}/stock-out`, {
        quantity: parseInt(quantity),
        notes: notes || undefined,
      })
      setQuantity("")
      setNotes("")
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to remove stock")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock Out — {product?.name}</DialogTitle>
          <DialogDescription>
            SKU: {product?.sku} | Current stock: {product?.stock}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="stock-out-quantity">Quantity *</Label>
            <Input
              id="stock-out-quantity"
              type="number"
              min="1"
              max={product?.stock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to remove"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-out-notes">Notes</Label>
            <Input
              id="stock-out-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Removing..." : "Remove Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
