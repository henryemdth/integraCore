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

interface CreateDiscountDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDiscountDialog({ product, open, onOpenChange }: CreateDiscountDialogProps) {
  const { t } = useTranslation()
  const [discountedPrice, setDiscountedPrice] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) return
      await api.post(`/api/products/${product.id}/discounts`, {
        discounted_price: parseFloat(discountedPrice),
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(t("discounts.created"))
      setDiscountedPrice("")
      setStartDate("")
      setEndDate("")
      setReason("")
      setError("")
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || t("discounts.failedCreate")
      setError(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!product) return
    const price = parseFloat(discountedPrice)
    if (!discountedPrice || price < 0) { setError("Discounted price must be >= 0"); return }
    if (product && price >= product.sell_price) { setError("Discounted price must be less than sell price"); return }
    if (!startDate) { setError("Start date is required"); return }
    if (!endDate) { setError("End date is required"); return }
    if (startDate > endDate) { setError("Start date must be on or before end date"); return }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("discounts.createDiscount")} — {product?.name}</DialogTitle>
          <DialogDescription>
            <span className="font-data">{product?.sku}</span>
            {" · "}
            {t("products.sellPrice")}: {product?.sell_price}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discounted-price">{t("discounts.discountedPrice")} *</Label>
              <Input
                id="discounted-price"
                type="number"
                min="0"
                step="0.01"
                value={discountedPrice}
                onChange={(e) => setDiscountedPrice(e.target.value)}
                placeholder="0.00"
                required
                className="font-data"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-reason">{t("discounts.reason")}</Label>
              <Input
                id="discount-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("discounts.reasonPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-start">{t("discounts.startDate")} *</Label>
              <Input
                id="discount-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-end">{t("discounts.endDate")} *</Label>
              <Input
                id="discount-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mutation.isPending ? t("common.loading") : t("discounts.createDiscount")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
