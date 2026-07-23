import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { runMigrations } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export function initDatabase(): Database.Database {
  const dbPath = config.dbPath || path.join(__dirname, "../../data/integracore.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  console.log(`[db] Connected to ${dbPath}`);
  return db;
}
