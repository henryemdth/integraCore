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
import { formatCurrency, formatDateTime } from "@/lib/format"

interface SaleDetailDialogProps {
  sale: SaleDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SaleDetailDialog({ sale, open, onOpenChange }: SaleDetailDialogProps) {
  const { t } = useTranslation()
  if (!sale) return null

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
              <TableHead className="text-right">{t("sales.create.subtotal")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product_name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-surface-container-highest px-1.5 py-0.5 rounded font-data">{item.product_sku}</code>
                </TableCell>
                <TableCell className="text-right font-data">{item.quantity}</TableCell>
                <TableCell className="text-right font-data">{formatCurrency(item.unit_price)}</TableCell>
                <TableCell className="text-right font-data font-semibold">{formatCurrency(item.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Separator />

        <div className="flex justify-end">
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
