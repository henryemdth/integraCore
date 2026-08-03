import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import type { DatabaseAdapter } from "./adapter.js";
import { SqliteAdapter } from "./sqlite.js";
import { runMigrations, runPostgresMigrations } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let adapter: DatabaseAdapter | null = null;
let rawDb: Database.Database | null = null;

/** Returns the database adapter (async-capable). */
export function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return adapter;
}

export function replaceAdapter(newDb: Database.Database): void {
  if (adapter instanceof SqliteAdapter) {
    (adapter as SqliteAdapter).replaceConnection(newDb);
    rawDb = newDb;
  } else {
    throw new Error("replaceAdapter is only supported for SQLite adapters");
  }
}

export async function initDatabase(): Promise<{ adapter: DatabaseAdapter }> {
  if (config.dbDriver === "postgresql") {
    const { PostgresAdapter } = await import("./postgres.js");
    adapter = new PostgresAdapter(config.pg);
    console.log(`[db] Connected to PostgreSQL at ${config.pg.host}:${config.pg.port}/${config.pg.database}`);
    await runPostgresMigrations(adapter);
    return { adapter };
  }

  // SQLite (default)
  const dbPath = config.dbPath || path.join(__dirname, "../../data/integracore.db");
  rawDb = new Database(dbPath);
  rawDb.pragma("journal_mode = WAL");
  rawDb.pragma("foreign_keys = ON");
  adapter = new SqliteAdapter(rawDb);
  runMigrations(rawDb);
  console.log(`[db] Connected to ${dbPath}`);
  return { adapter };
}
