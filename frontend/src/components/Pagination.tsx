import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  /** i18n key for the "Page X of Y (N items)" label, e.g. "products.pageInfo". */
  pageInfoKey: string
  onPageChange: (page: number) => void
}

/**
 * Table footer pagination. The same markup was repeated in the products, sales
 * and users lists; only the i18n key differed, so that is the one prop.
 *
 * Renders nothing when there is a single page, which is what each of the three
 * call sites did with its own `totalPages > 1` guard.
 */
export function Pagination({ page, totalPages, total, pageInfoKey, onPageChange }: PaginationProps) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-muted-foreground">
        {t(pageInfoKey, { page, totalPages, total })}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t("common.previous")}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  )
}
