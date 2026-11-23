/**
 * Neutralizes spreadsheet formula injection (CSV/Excel injection) on
 * user-controlled text fields. Any string starting with =, +, -, @, tab, or CR
 * is prefixed with a single quote so Excel treats it strictly as literal text.
 */
export function sanitizeExcelCell(value: string | null | undefined): string {
  if (!value) return "";
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
