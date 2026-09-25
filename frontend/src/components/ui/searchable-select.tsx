import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
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
}

// cmdk's default filter is ASCII-only; normalize so accents don't break
// Spanish searches ("josé" finds "José", "montag" finds "Montagüe").
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

const diacriticInsensitiveFilter = (
  value: string,
  search: string,
  keywords?: string[]
): number => {
  const haystack = normalize(`${value} ${keywords?.join(" ") ?? ""}`)
  return haystack.includes(normalize(search)) ? 1 : 0
}

/**
 * Combobox (type-to-search dropdown) built on cmdk + Radix Popover.
 * Drop-in replacement for Select-based filters whose option lists are long
 * enough that scrolling beats typing. Empty search shows all options; no
 * match shows `noResultsText` inside the panel.
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
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)

  const allOptions: SearchableSelectOption[] = React.useMemo(
    () => (allLabel ? [{ value: "all", label: allLabel }, ...options] : options),
    [allLabel, options]
  )

  const selected = allOptions.find((opt) => opt.value === value)
  const hasSelection = Boolean(allLabel) && value !== "all"

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? value : currentValue)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    // Reset to the "no filter" value without opening the option panel.
    e.stopPropagation()
    e.preventDefault()
    onValueChange("all")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span>{selected?.label ?? allLabel}</span>
          {hasSelection ? (
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
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
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
