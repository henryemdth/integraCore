import type Database from "better-sqlite3";
import type { DatabaseAdapter, RunResult } from "./adapter.js";

export class SqliteAdapter implements DatabaseAdapter {
  constructor(private db: Database.Database) {}

  async get<T = any>(sql: string, params?: any[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...(params ?? [])) as T | undefined;
  }

  async all<T = any>(sql: string, params?: any[]): Promise<T[]> {
    return this.db.prepare(sql).all(...(params ?? [])) as T[];
  }

  async run(sql: string, params?: any[]): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...(params ?? []));
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
