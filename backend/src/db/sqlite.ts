import type Database from "better-sqlite3";
import type { DatabaseAdapter, RunResult } from "./adapter.js";

export class SqliteAdapter implements DatabaseAdapter {
  constructor(private db: Database.Database) {}

  // better-sqlite3 can only bind numbers, strings, bigints, buffers and null —
  // JS booleans throw. Services pass booleans for boolean columns (e.g.
  // `active`) so Postgres works; normalize here so SQLite accepts them too.
  private normalizeParams(params?: any[]): any[] {
    if (!params) return [];
    return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
  }

  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...this.normalizeParams(params)) as T | undefined;
  }

  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.db.prepare(sql).all(...this.normalizeParams(params)) as T[];
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...this.normalizeParams(params));
    return {
      insertId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T> {
    this.db.exec("SAVEPOINT sp");
    try {
      const result = await fn(this);
      this.db.exec("RELEASE sp");
      return result;
    } catch (err) {
      this.db.exec("ROLLBACK TO sp");
      throw err;
    }
  }

  raw(): any {
    return this.db;
  }

  replaceConnection(db: Database.Database): void {
    this.db = db;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
