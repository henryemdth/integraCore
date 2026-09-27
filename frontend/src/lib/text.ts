/**
 * Normalizes free text for accent- and case-insensitive matching
 * (Spanish-friendly): lowercase, NFD decomposition stripping combining
 * diacritics, trimmed with inner whitespace collapsed to single spaces.
 * Shared by the SearchableSelect filter and the duplicate-name check so
 * "Café" and "cafe" always compare equal.
 */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
}
