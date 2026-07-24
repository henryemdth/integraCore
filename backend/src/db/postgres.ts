import pg from "pg";
import type { DatabaseAdapter, RunResult } from "./adapter.js";

export class PostgresAdapter implements DatabaseAdapter {
  private pool: pg.Pool;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  }) {
    this.pool = new pg.Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
    });
  }

  /**
   * Transforms SQLite datetime functions to PostgreSQL equivalents.
   * - datetime('now') → NOW()
   * - datetime('now', '-' || ? || ' days') → (NOW() - ($N::int * interval '1 day'))
   */
  private convertDatetimeFunctions(sql: string): string {
    // Simple replacement: datetime('now') → NOW()
    // This regex does NOT match datetime('now', ...) because 'now' is followed by , not )
    let converted = sql.replace(/datetime\('now'\)/g, "NOW()");

    // For date subtraction, replace the whole pattern before placeholder conversion
    // Pattern: datetime('now', '-' || ? || ' days')
    converted = converted.replace(
      /datetime\('now', '\-' \|\| \? \|\| ' days'\)/g,
      "(NOW() - (${DAYS_PARAM}::int * interval '1 day'))"
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
  private addReturningIfNeeded(sql: string): string {
    const trimmed = sql.trim().toUpperCase();
    if (
      trimmed.startsWith("INSERT ") &&
      !trimmed.includes("RETURNING")
    ) {
      return sql + " RETURNING id";
    }
    return sql;
  }

  /**
   * Creates a transaction-scoped adapter that runs all queries
   * on the given client connection instead of the pool.
   */
  private createTxAdapter(client: pg.PoolClient): DatabaseAdapter {
    const parent = this;
    return {
      async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
        const q = parent.convertDatetimeFunctions(sql);
        const result = await client.query(q, params);
        return result.rows[0] as T | undefined;
      },
      async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const q = parent.convertDatetimeFunctions(sql);
        const result = await client.query(q, params);
        return result.rows as T[];
      },
      async run(sql: string, params?: any[]): Promise<RunResult> {
        let q = parent.convertDatetimeFunctions(sql);
        q = parent.addReturningIfNeeded(q);
        const result = await client.query(q, params);
        return {
          insertId: result.rows?.[0]?.id ?? 0,
          changes: result.rowCount ?? 0,
        };
      },
      async exec(sql: string): Promise<void> {
        await client.query(sql);
      },
      async transaction<T>(_fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
        throw new Error("Nested transactions are not supported");
      },
      async close(): Promise<void> {
        // No-op: transaction adapter does not own the connection
      },
    };
  }

  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    const pgSql = this.convertDatetimeFunctions(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows[0] as T | undefined;
  }

  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const pgSql = this.convertDatetimeFunctions(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows as T[];
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    let pgSql = this.convertDatetimeFunctions(sql);
    pgSql = this.addReturningIfNeeded(pgSql);
    const result = await this.pool.query(pgSql, params);
    return {
      insertId: result.rows?.[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const txAdapter = this.createTxAdapter(client);
      const result = await fn(txAdapter);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
