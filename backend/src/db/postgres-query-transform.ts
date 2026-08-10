/**
 * Pure SQLite→PostgreSQL query transforms, extracted from PostgresAdapter so
 * the dialect conversion can be unit-tested without a live Postgres connection.
 */

/**
 * Transforms SQLite datetime functions to PostgreSQL equivalents.
 * - datetime('now') → NOW()
 * - datetime('now', '-' || ? || ' days') → (NOW() - ($N::int * interval '1 day'))
 */
export function convertDatetimeFunctions(sql: string): string {
  // Simple replacement: datetime('now') → NOW()
  // This regex does NOT match datetime('now', ...) because 'now' is followed by , not )
  let converted = sql.replace(/datetime\('now'\)/g, "NOW()");

  // For date subtraction, replace the whole pattern before placeholder conversion
  // Pattern: datetime('now', '-' || ? || ' days')
  converted = converted.replace(
    /datetime\('now', '\-' \|\| \? \|\| ' days'\)/g,
    "(NOW() - (${DAYS_PARAM}::int * interval '1 day'))"
  );

  // date('now') → CURRENT_DATE
  converted = converted.replace(/date\('now'\)/g, "CURRENT_DATE");

  // strftime('%Y-%m', 'now') → TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  converted = converted.replace(
    /strftime\('%Y-%m',\s*'now'\)/g,
    "TO_CHAR(CURRENT_DATE, 'YYYY-MM')"
  );

  // strftime('%Y-%m', column) → TO_CHAR(column, 'YYYY-MM')
  converted = converted.replace(
    /strftime\('%Y-%m',\s*([a-zA-Z_][a-zA-Z0-9_.]*)\)/g,
    "TO_CHAR($1, 'YYYY-MM')"
  );

  // Now convert ? placeholders to $N, and ${DAYS_PARAM} marker to $N
  let result = "";
  let paramIndex = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < converted.length; i++) {
    const ch = converted[i];

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      result += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += ch;
    } else if (ch === "?" && !inSingleQuote && !inDoubleQuote) {
      paramIndex++;
      result += `$${paramIndex}`;
    } else if (
      converted.substring(i, i + 13) === "${DAYS_PARAM}" &&
      !inSingleQuote &&
      !inDoubleQuote
    ) {
      paramIndex++;
      result += `$${paramIndex}`;
      i += 12; // Skip past "${DAYS_PARAM}" (13 chars - 1 for loop increment)
    } else {
      result += ch;
    }
  }

  return result;
}

/**
 * Detect if an INSERT statement needs a RETURNING clause
 * to get the last inserted ID.
 */
export function addReturningIfNeeded(sql: string): string {
  const trimmed = sql.trim().toUpperCase();
  if (
    trimmed.startsWith("INSERT ") &&
    !trimmed.includes("RETURNING")
  ) {
    return sql + " RETURNING id";
  }
  return sql;
}
