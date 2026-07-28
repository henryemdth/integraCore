import { useTranslation } from "react-i18next"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tag } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/format"

interface SaleDetailDialogProps {
  sale: SaleDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaleDetailDialog({ sale, open, onOpenChange }: SaleDetailDialogProps) {
  const { t } = useTranslation()
  if (!sale) return null

  const totalSavings = sale.items.reduce((sum, item) => {
    if (item.discount_id) {
      return sum + (item.original_price - item.unit_price) * item.quantity
    }
    return sum
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("sales.detail.title", { id: sale.id })}</DialogTitle>
          <DialogDescription>
            {formatDateTime(sale.created_at)}
            {" — "}
            {sale.seller_name}
          </DialogDescription>
        </DialogHeader>

        {sale.notes && (
          <div className="text-body-sm text-muted-foreground bg-surface-container-low rounded-md p-3">
            {t("sales.detail.notes")}: {sale.notes}
          </div>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("sales.product")}</TableHead>
              <TableHead>{t("products.sku")}</TableHead>
              <TableHead className="text-right">{t("sales.create.qty")}</TableHead>
              <TableHead className="text-right">{t("products.price")}</TableHead>
              <TableHead className="text-right">{t("sales.detail.originalPrice")}</TableHead>
              <TableHead className="text-right">{t("sales.detail.discountApplied")}</TableHead>
              <TableHead className="text-right">{t("sales.create.subtotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => {
              const hasDiscount = item.discount_id != null
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-surface-container-highest px-1.5 py-0.5 rounded font-data">{item.product_sku}</code>
                  </TableCell>
                  <TableCell className="text-right font-data">{item.quantity}</TableCell>
                  <TableCell className="text-right font-data">
                    {hasDiscount ? (
                      <span className="flex items-center justify-end gap-1">
                        <Tag className="h-3 w-3 text-amber-500" />
                        <span className="line-through text-muted-foreground">{formatCurrency(item.original_price)}</span>
                        <span className="font-semibold text-amber-600">{formatCurrency(item.unit_price)}</span>
                      </span>
                    ) : (
                      formatCurrency(item.unit_price)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-data text-muted-foreground">{formatCurrency(item.original_price)}</TableCell>
                  <TableCell className="text-right">
                    {hasDiscount ? t("discounts.yes") : t("discounts.no")}
                  </TableCell>
                  <TableCell className="text-right font-data font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <Separator />

        <div className="flex flex-col items-end gap-1">
          {totalSavings > 0 && (
            <span className="text-body-sm text-muted-foreground font-data">
              {t("sales.detail.savingsFromDiscounts", { amount: formatCurrency(totalSavings) })}
            </span>
          )}
          <span className="text-headline-sm font-data">
            {t("sales.create.totalLabel", { amount: formatCurrency(sale.total) })}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}