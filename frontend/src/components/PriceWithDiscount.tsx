import { Tag } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Price display for a possibly-discounted product: the discounted price with
 * the normal price struck through and a discount tag, or the plain price when
 * no discount applies. Keeps the discount styling identical across the sale
 * form, sale detail, and product list (AGENTS.md discount-summary rule).
 */
export function PriceWithDiscount({
  original,
  discounted,
  align = "left",
  className,
}: {
  original: number
  discounted?: number | null
  align?: "left" | "right"
  className?: string
}) {
  if (!discounted) {
    return <span className={cn("font-data", className)}>{formatCurrency(original)}</span>
  }
  return (
    <span className={cn("inline-flex items-center gap-1 font-data", align === "right" && "justify-end", className)}>
      <Tag className="h-3 w-3 text-warning" />
      <span className="line-through text-muted-foreground">{formatCurrency(original)}</span>
      <span className="font-semibold text-warning">{formatCurrency(discounted)}</span>
    </span>
  )
}
