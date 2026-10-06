export interface RunResult {
  insertId: number;
  changes: number;
}

export interface DatabaseAdapter {
  get<T = any>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  // Driver-specific escape hatch (e.g. better-sqlite3 handle for backup/restore
  // file operations). Callers declare what they expect via T.
  raw<T = any>(): T;
  close(): Promise<void>;
}
