import { useTranslation } from "react-i18next"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { generatePageRange } from "@/lib/pagination"

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  /** i18n key for the "Page X of Y (N items)" label, e.g. "products.pageInfo". */
  pageInfoKey: string
  onPageChange: (page: number) => void
  /** Current rows-per-page; renders the selector when paired with onLimitChange. */
  limit?: number
  onLimitChange?: (limit: number) => void
  limitOptions?: number[]
}

const DEFAULT_LIMIT_OPTIONS = [10, 20, 50]

/**
 * Table footer pagination: "Page X of Y" info, optional rows-per-page selector,
 * and a numbered page bar — first and last pages are always one click away, so
 * there are no separate first/last buttons.
 *
 * Renders nothing when there is a single page.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageInfoKey,
  onPageChange,
  limit,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
}: PaginationProps) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  const goTo = (target: number) => {
    if (target !== page) onPageChange(target)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {t(pageInfoKey, { page, totalPages, total })}
        </span>
        {limit !== undefined && onLimitChange && (
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger aria-label={t("common.rowsPerPage")} className="h-9 w-[74px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {limitOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          {t("common.previous")}
        </Button>
        {generatePageRange(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} aria-hidden className="px-1.5 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "default" : "ghost"}
              size="sm"
              className="min-w-9 px-2"
              aria-current={item === page ? "page" : undefined}
              aria-label={t("common.goToPage", { page: item })}
              onClick={() => goTo(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </div>
  )
}
