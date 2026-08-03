import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { DatabaseAdapter } from "../db/adapter.js";
import { AppError } from "./authService.js";
import { acquireWriteLock, releaseWriteLock } from "./lockService.js";
import { emitDbRestored } from "../socket/index.js";
import { runMigrations } from "../db/schema.js";
import { replaceAdapter } from "../db/index.js";

const REQUIRED_TABLES = [
  "users", "products", "sales", "sale_items",
  "product_discounts", "profit_targets", "notifications",
];

function validateSqliteFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const sqliteHeader = Buffer.from("SQLite format 3\0");
  return buf.slice(0, 16).equals(sqliteHeader);
}

function removeWalShm(dbPath: string) {
  try { fs.rmSync(dbPath + "-wal", { force: true }); } catch { /* ignore */ }
  try { fs.rmSync(dbPath + "-shm", { force: true }); } catch { /* ignore */ }
}

function validateSchema(filePath: string): string | null {
  try {
    const db = new Database(filePath);
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    db.close();
    const tableNames = rows.map(r => r.name);
    for (const table of REQUIRED_TABLES) {
      if (!tableNames.includes(table)) return `Missing required table: ${table}`;
    }
    return null;
  } catch {
    return "Could not read database schema";
  }
}

export function backupService(adapter: DatabaseAdapter, dataDir: string) {
  async function exportBackup(): Promise<{ filePath: string; fileName: string }> {
    const db = (adapter as any).raw();
    db.exec("PRAGMA wal_checkpoint(FULL)");

    const dbPath = db.name;
    if (!dbPath) throw new AppError(500, "Could not determine database path");

    const backupDir = path.join(dataDir, "backups");
    fs.mkdirSync(backupDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const fileName = `backup-${date}.sqlite`;
    const destPath = path.join(backupDir, fileName);

    fs.copyFileSync(dbPath, destPath);
    return { filePath: destPath, fileName };
  }

  async function restoreBackup(fileBase64: string): Promise<void> {
    if (!dataDir) throw new AppError(500, "dataDir not configured");

    const tempDir = path.join(dataDir, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `restore-${Date.now()}.sqlite`);

    try {
      const buf = Buffer.from(fileBase64, "base64");
      fs.writeFileSync(tempPath, buf);

      if (!validateSqliteFile(tempPath)) {
        throw new AppError(400, "Uploaded file is not a valid SQLite database");
      }

      const schemaError = validateSchema(tempPath);
      if (schemaError) {
        throw new AppError(400, `Invalid database schema: ${schemaError}`);
      }

      acquireWriteLock();

      const currentDb = (adapter as any).raw();
      const dbPath = currentDb.name;

      const backupDir = path.join(dataDir, "backups");
      fs.mkdirSync(backupDir, { recursive: true });
      const autoBackupPath = path.join(backupDir, `auto-${Date.now()}.sqlite`);
      fs.copyFileSync(dbPath, autoBackupPath);

      currentDb.close();

      removeWalShm(dbPath);

      try {
        fs.copyFileSync(tempPath, dbPath);
      } catch (err) {
        fs.copyFileSync(autoBackupPath, dbPath);
        removeWalShm(dbPath);
        throw new AppError(500, "Failed to swap database file. Auto-backup restored.");
      }

      const newDb = new Database(dbPath);
      newDb.pragma("journal_mode = WAL");
      newDb.pragma("foreign_keys = ON");
      runMigrations(newDb);
      replaceAdapter(newDb);
      emitDbRestored();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, "Restore failed: " + (err as Error).message);
    } finally {
      releaseWriteLock();
      try { fs.rmSync(tempPath, { force: true }); } catch { /* ignore */ }
    }
  }

  return { exportBackup, restoreBackup };
}
