import type Database from "better-sqlite3";
import type { DatabaseAdapter, RunResult } from "./adapter.js";

export class SqliteAdapter implements DatabaseAdapter {
  private txQueue: Promise<unknown> = Promise.resolve();
  private spSeq = 0;

  constructor(private db: Database.Database) {}

  // better-sqlite3 can only bind numbers, strings, bigints, buffers and null —
  // JS booleans throw. Services pass booleans for boolean columns (e.g.
  // `active`) so Postgres works; normalize here so SQLite accepts them too.
  private normalizeParams(params?: unknown[]): unknown[] {
    if (!params) return [];
    return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
  }

  async get<T = any>(sql: string, params?: unknown[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...this.normalizeParams(params)) as T | undefined;
  }

  async all<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...this.normalizeParams(params)) as T[];
  }

  async run(sql: string, params?: unknown[]): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...this.normalizeParams(params));
    return {
      insertId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  private async runWithSavepoint<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    const sp = `sp_${++this.spSeq}`;
    this.db.exec(`SAVEPOINT ${sp}`);
    const txAdapter: DatabaseAdapter = {
      get: (sql, params) => this.get(sql, params),
      all: (sql, params) => this.all(sql, params),
      run: (sql, params) => this.run(sql, params),
      exec: (sql) => this.exec(sql),
      transaction: (nestedFn) => this.runWithSavepoint(nestedFn),
      raw: () => this.raw(),
      close: async () => {},
    };
    try {
      const result = await fn(txAdapter);
      this.db.exec(`RELEASE ${sp}`);
      return result;
    } catch (err) {
      // In SQLite, ROLLBACK TO sp does NOT release the savepoint; RELEASE sp
      // must follow so the connection is never left inside an open transaction.
      this.db.exec(`ROLLBACK TO ${sp}`);
      this.db.exec(`RELEASE ${sp}`);
      throw err;
    }
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Serialize top-level async transactions on the single better-sqlite3
    // connection so concurrent requests never interleave SQL statements or
    // collide on savepoints.
    const run = this.txQueue.then(() => this.runWithSavepoint(fn));
    this.txQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  raw<T = any>(): T {
    return this.db as T;
  }

  replaceConnection(db: Database.Database): void {
    this.db = db;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
