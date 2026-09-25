/**
 * Normalizes PostgreSQL result rows to the SQLite TEXT contract.
 *
 * node-postgres materializes TIMESTAMP columns as JS Date objects, which
 * JSON-serialize as ISO strings ("2026-07-07T23:59:59.999Z"). Everything
 * downstream — frontend formatDate, badge string comparisons, Excel export
 * slice(0, 10) — assumes the SQLite TEXT format
 * "YYYY-MM-DD HH:MM:SS.mmm" (space-separated, lexicographically comparable).
 * Converting here keeps PostgresAdapter a drop-in for SqliteAdapter: the
 * adapter layer is the dialect boundary for value shapes as well as SQL.
 *
 * Dates are formatted with UTC getters, mirroring datetime('now')'s UTC
 * digits and preserving the wall-clock digits stored on the UTC-hosted
 * cloud database.
 */

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

export function dateToTimestampString(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.` +
    pad(date.getUTCMilliseconds(), 3)
  );
}

export function normalizeRowDates<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    out[key] = value instanceof Date ? dateToTimestampString(value) : value;
  }
  return out as T;
}

export function normalizeRowDatesAll<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(normalizeRowDates);
}
