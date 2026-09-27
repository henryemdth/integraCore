import { useMemo, useState, type ReactNode } from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { normalizeForSearch } from "@/lib/text"
import { Input } from "@/components/ui/input"

interface SuggestiveInputProps<T> {
  value: string
  onValueChange: (value: string) => void
  /** Pool the suggestions are matched against (already fully loaded by the caller). */
  items: T[]
  itemKey: (item: T) => string | number
  /** Text the typed value is matched against, accent- and case-insensitively. */
  itemText: (item: T) => string
  /** Row content; defaults to itemText(item). */
  renderItem?: (item: T) => ReactNode
  /** Called when a suggestion is picked; the caller decides what a pick means. */
  onPick: (item: T) => void
  placeholder?: string
  /** Max rows shown in the dropdown. */
  maxSuggestions?: number
  /** Wrapper classes (the input fills the wrapper). */
  className?: string
}

/**
 * Search input with a suggestion dropdown: typing shows the matching items
 * accent- and case-insensitively; an empty value shows nothing. The dropdown
 * closes on Escape, on picking, or on clicking anywhere else. Filtering
 * happens client-side because server-side LIKE/ILIKE is not diacritic-safe.
 */
export function SuggestiveInput<T>({
  value,
  onValueChange,
  items,
  itemKey,
  itemText,
  renderItem,
  onPick,
  placeholder,
  maxSuggestions,
  className,
}: SuggestiveInputProps<T>) {
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const q = normalizeForSearch(value)
    if (!q) return []
    return items.filter((item) => normalizeForSearch(itemText(item)).includes(q)).slice(0, maxSuggestions ?? 10)
  }, [value, items, itemText, maxSuggestions])

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => { onValueChange(e.target.value); setOpen(e.target.value.trim().length > 0) }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
        placeholder={placeholder}
        className="pl-9"
      />
      {open && suggestions.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {suggestions.map((item) => (
              <button
                key={itemKey(item)}
                type="button"
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-container"
                onClick={() => { onPick(item); setOpen(false) }}
              >
                {renderItem ? renderItem(item) : itemText(item)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
