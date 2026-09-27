import * as React from "react"
import { Check, ChevronDown, Plus, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { normalizeForSearch } from "@/lib/text"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface SearchableSelectOption {
  value: string
  label: string
  /** Extra strings matched by the search besides the label (e.g. product SKU). */
  keywords?: string[]
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  /** Rendered as the first option with value "all" — the "no filter" choice. */
  allLabel?: string
  searchPlaceholder?: string
  noResultsText?: string
  /** Accessible label for the clear (✕) button shown while a filter is active. */
  clearLabel?: string
  className?: string
  disabled?: boolean
  /** Form mode: typed text that matches no existing option can be committed as the value. */
  creatable?: boolean
  /** Label factory for the create item; defaults to the raw typed text. */
  createLabel?: (text: string) => string
  /** Trigger text while the value is empty (form mode). */
  placeholder?: string
}

const diacriticInsensitiveFilter = (
  value: string,
  search: string,
  keywords?: string[]
): number => {
  const haystack = normalizeForSearch(`${value} ${keywords?.join(" ") ?? ""}`)
  return haystack.includes(normalizeForSearch(search)) ? 1 : 0
}

/**
 * Combobox (type-to-search dropdown) built on cmdk + Radix Popover.
 * Drop-in replacement for Select-based filters whose option lists are long
 * enough that scrolling beats typing. Empty search shows all options; no
 * match shows `noResultsText` inside the panel.
 *
 * With `creatable`, it doubles as a form field: typed text that no existing
 * option covers is offered as a "use this text" item, and the raw value is
 * shown on the trigger when it matches no option. Filter usage (allLabel)
 * keeps its select-only behavior.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  allLabel,
  searchPlaceholder,
  noResultsText,
  clearLabel,
  className,
  disabled,
  creatable,
  createLabel,
  placeholder,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const allOptions: SearchableSelectOption[] = React.useMemo(
    () => (allLabel ? [{ value: "all", label: allLabel }, ...options] : options),
    [allLabel, options]
  )

  const selected = allOptions.find((opt) => opt.value === value)
  const hasSelection = Boolean(allLabel) && value !== "all"
  const emptyValue = value === "" || value === "all"

  // A typed text that is (accent/case-insensitively) equal to, or a fragment
  // of, an existing option gets no create item — the existing option is
  // offered instead, so near-duplicates ("BEBIDAS", "Beb") can't be created.
  // Extending an option into new text ("Bebidas" → "Bebidas Alcohólicas")
  // stays creatable.
  const query = normalizeForSearch(search)
  const showCreateItem =
    Boolean(creatable) &&
    query.length > 0 &&
    !allOptions.some((opt) => {
      const label = normalizeForSearch(opt.label)
      return label === query || label.includes(query)
    })

  const displayLabel =
    selected?.label ?? (creatable && !emptyValue ? value : (allLabel ?? placeholder ?? ""))
  const showPlaceholder = !selected && placeholder !== undefined && emptyValue

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setSearch("")
  }

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? value : currentValue)
    setOpen(false)
  }

  const handleCreate = (text: string) => {
    onValueChange(text)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    // Reset to the "no filter" value (filters) or empty (form) without opening the panel.
    e.stopPropagation()
    e.preventDefault()
    onValueChange(allLabel ? "all" : "")
  }

  const canClear = allLabel ? hasSelection : Boolean(creatable) && value !== ""

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-11 min-w-[160px] max-w-[280px] items-center justify-between rounded bg-surface-container px-3 py-2 text-body-md text-foreground border border-b-2 border-border focus:outline-none focus:border-b-primary focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate",
            hasSelection && "border-b-primary",
            className
          )}
        >
          <span className={cn(showPlaceholder && "text-muted-foreground")}>{displayLabel}</span>
          {canClear ? (
            <span
              role="button"
              aria-label={clearLabel}
              title={clearLabel}
              onClick={handleClear}
              className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm opacity-60 transition-colors hover:bg-muted hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : (
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-0">
        <Command filter={diacriticInsensitiveFilter}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            {showCreateItem && (
              <CommandGroup>
                <CommandItem value={query} onSelect={() => handleCreate(search.trim())}>
                  <Plus className="mr-2 h-4 w-4 opacity-70" />
                  {createLabel ? createLabel(search.trim()) : search.trim()}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {allOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  keywords={[opt.label, ...(opt.keywords ?? [])]}
                  onSelect={() => handleSelect(opt.value)}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", opt.value === value ? "opacity-100" : "opacity-0")}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
