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
import { getErrorMessage } from "@/lib/errorMessages"

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
      const msg = getErrorMessage(err, "discounts.failedCreate")
      setError(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!product) return
    if (product.status === "discontinued") { setError(t("discounts.discontinuedBlocked")); return }
    const price = parseFloat(discountedPrice)
    if (!discountedPrice || price < 0) { setError(t("discounts.priceInvalid")); return }
    if (product && price >= product.sell_price) { setError(t("errors.discountPriceAboveSell")); return }
    if (!startDate) { setError(t("discounts.startDateRequired")); return }
    if (!endDate) { setError(t("discounts.endDateRequired")); return }
    if (startDate > endDate) { setError(t("discounts.dateOrder")); return }
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
        {product?.status === "discontinued" ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{t("discounts.discontinuedBlocked")}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            </DialogFooter>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  )
}
