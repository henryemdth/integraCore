import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Product } from "@integracore/shared"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

interface StockMovementDialogProps {
  product: Product | null
  type: "in" | "out"
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockMovementDialog({ product, type, open, onOpenChange }: StockMovementDialogProps) {
  const { t } = useTranslation()
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) return
      await api.post(`/api/products/${product.id}/stock-${type}`, {
        quantity: parseInt(quantity),
        notes: notes || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(type === "in" ? t("products.stockMovement.added") : t("products.stockMovement.removed"))
      setQuantity("")
      setNotes("")
      setError("")
      onOpenChange(false)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || (type === "in" ? t("products.stockMovement.failedAdd") : t("products.stockMovement.failedRemove")))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "in" ? t("products.stockMovement.stockInTitle") : t("products.stockMovement.stockOutTitle")} — {product?.name}</DialogTitle>
          <DialogDescription>
            <span className="font-data">{product?.sku}</span>
            {" · "}
            {t("products.stockMovement.currentStock", { stock: product?.stock })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-2">
            <Label htmlFor={`stock-${type}-quantity`}> {t("products.stockMovement.quantity")} *</Label>
            <Input
              id={`stock-${type}-quantity`}
              type="number"
              min="1"
              {...(type === "out" && product ? { max: product.stock } : {})}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === "in" ? t("products.stockMovement.inPlaceholder") : t("products.stockMovement.outPlaceholder")}
              required
              className="font-data"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`stock-${type}-notes`}>{t("products.stockMovement.notes")}</Label>
            <Input id={`stock-${type}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sales.create.notesPlaceholder")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" variant={type === "out" ? "destructive" : "default"} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mutation.isPending ? t("common.loading") : (type === "in" ? t("products.stockMovement.addStock") : t("products.stockMovement.removeStock"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
