import pg from "pg";
import type { DatabaseAdapter, RunResult } from "./adapter.js";
import { convertDatetimeFunctions, addReturningIfNeeded } from "./postgres-query-transform.js";

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
   * Creates a transaction-scoped adapter that runs all queries
   * on the given client connection instead of the pool.
   */
  private createTxAdapter(client: pg.PoolClient): DatabaseAdapter {
    return {
      async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
        const q = convertDatetimeFunctions(sql);
        const result = await client.query(q, params);
        return result.rows[0] as T | undefined;
      },
      async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const q = convertDatetimeFunctions(sql);
        const result = await client.query(q, params);
        return result.rows as T[];
      },
      async run(sql: string, params?: any[]): Promise<RunResult> {
        let q = convertDatetimeFunctions(sql);
        q = addReturningIfNeeded(q);
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
      raw(): any {
        throw new Error("raw() is not available on a transaction adapter");
      },
      async close(): Promise<void> {
        // No-op: transaction adapter does not own the connection
      },
    };
  }

  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    const pgSql = convertDatetimeFunctions(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows[0] as T | undefined;
  }

  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const pgSql = convertDatetimeFunctions(sql);
    const result = await this.pool.query(pgSql, params);
    return result.rows as T[];
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    let pgSql = convertDatetimeFunctions(sql);
    pgSql = addReturningIfNeeded(pgSql);
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

  raw(): any {
    return this.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
