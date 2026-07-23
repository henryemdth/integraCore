import i18n from "i18next"

const DEFAULT_CURRENCY = "Bs."

export function getCurrencySymbol(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("currency_symbol") || DEFAULT_CURRENCY
  }
  return DEFAULT_CURRENCY
}

export function formatCurrency(amount: number): string {
  const symbol = getCurrencySymbol()
  const formatted = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `${symbol} ${formatted}`
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}
