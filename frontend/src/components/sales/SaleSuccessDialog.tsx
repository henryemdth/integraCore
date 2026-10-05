import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import type { SaleDetail } from "@integracore/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDateTime } from "@/lib/format"

interface SaleSuccessDialogProps {
  sale: SaleDetail | null
  open: boolean
  onNewSale: () => void
}

// On-screen receipt shown right after a sale is registered: the seller confirms
// at a glance what was sold, at which prices, and what discounts saved.
export function SaleSuccessDialog({ sale, open, onNewSale }: SaleSuccessDialogProps) {
  const { t } = useTranslation()
  if (!sale) return null

  const savings = sale.items.reduce(
    (sum, item) => sum + Math.max(0, item.original_price - item.unit_price) * item.quantity,
    0,
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onNewSale() }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-success" />
            {t("sales.create.receipt.title")}
          </DialogTitle>
          <DialogDescription>
            {t("sales.create.receipt.saleNumber", { id: sale.id })} · {formatDateTime(sale.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {sale.items.map((item) => (
            <div key={item.id} className="flex justify-between items-baseline gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{item.product_name}</span>
                <span className="text-muted-foreground ml-2 whitespace-nowrap font-data text-xs">
                  {t("sales.create.receipt.itemLine", {
                    quantity: item.quantity,
                    price: formatCurrency(item.unit_price),
                  })}
                </span>
              </span>
              <span className="font-data font-semibold whitespace-nowrap">{formatCurrency(item.subtotal)}</span>
            </div>
          ))}
          {sale.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("sales.noSales")}</p>
          )}
        </div>

        <Separator />
        {savings > 0 && (
          <div className="flex justify-end text-sm text-muted-foreground">
            <span className="font-data">
              {t("sales.create.savingsFromDiscounts", { amount: formatCurrency(savings) })}
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <span className="text-headline-sm font-data">
            {t("sales.create.totalLabel", { amount: formatCurrency(sale.total) })}
          </span>
        </div>

        <DialogFooter>
          <Button type="button" size="lg" className="w-full" onClick={onNewSale}>
            {t("sales.create.receipt.newSale")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
