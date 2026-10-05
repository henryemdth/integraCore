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

/**
 * Parses a number from a text input tolerating both decimal conventions —
 * "1234.56", "1234,56" and thousands "1,234.56" / "1.234,56" all work.
 * Returns NaN when nothing numeric remains, so callers keep their existing
 * `|| fallback` / validation behavior.
 */
export function parseDecimalInput(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return NaN
  const lastComma = trimmed.lastIndexOf(",")
  const lastDot = trimmed.lastIndexOf(".")
  let normalized = trimmed
  if (lastComma > lastDot) {
    // Comma is the decimal separator; dots (if any) are thousands groups.
    normalized = trimmed.replace(/\./g, "").replace(",", ".")
  } else {
    // Dot is the decimal separator; commas (if any) are thousands groups.
    normalized = trimmed.replace(/,/g, "")
  }
  return Number(normalized)
}

// Canonical backend timestamps are "YYYY-MM-DD HH:MM:SS.mmm" (SQLite TEXT
// contract, space-separated). Accept ISO ("T"-separated) too so a stray
// ISO value can never silently render as day 1 again.
function parseTimestampParts(dateStr: string): { y: number; m: number; d: number; h?: number; min?: number; s?: number; ms?: number } {
  const [datePart, timePart = ""] = String(dateStr).split(/[ T]/)
  const [y, m, d] = datePart.split("-").map(Number)
  const [h, min, rest = ""] = timePart.split(":")
  const [s, ms = "0"] = rest.split(".")
  return {
    y,
    m,
    d,
    h: Number(h) || undefined,
    min: Number(min) || undefined,
    s: Number(s) || undefined,
    ms: Number(ms) || undefined,
  }
}

export function formatDate(dateStr: string): string {
  const { y, m, d } = parseTimestampParts(dateStr)
  const date = new Date(y, (m || 1) - 1, d || 1)
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date)
}

// Space-format timestamps carry no timezone: render the wall-clock digits as
// local time (same convention as the SQLite deployment), never via new Date()'s
// implementation-defined non-ISO parsing.
export function formatDateTime(dateStr: string): string {
  const { y, m, d, h = 0, min = 0, s = 0, ms = 0 } = parseTimestampParts(dateStr)
  const parsed = new Date(y, (m || 1) - 1, d || 1, h, min, s, ms)
  return new Intl.DateTimeFormat(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}
