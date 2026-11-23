import fs from "fs";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";
import type { DatabaseAdapter } from "../db/adapter.js";
import { AppError } from "../utils/appError.js";
import { acquireWriteLock, releaseWriteLock } from "./lockService.js";
import { emitDbRestored } from "../socket/index.js";
import { runMigrations } from "../db/schema.js";
import { replaceAdapter } from "../db/index.js";
import { rotateJwtSecret } from "../config.js";
import { todayDateString } from "@integracore/shared";

const REQUIRED_SCHEMA: Record<string, string[]> = {
  users: ["id", "username", "password_hash", "full_name", "role", "active"],
  products: ["id", "name", "sku", "price", "stock"],
  sales: ["id", "user_id", "total", "created_at"],
  sale_items: ["id", "sale_id", "product_id", "quantity", "unit_price", "subtotal"],
  product_discounts: ["id", "product_id", "discounted_price", "start_date", "end_date"],
  profit_targets: ["id", "target_amount"],
  notifications: ["id", "type", "message", "read"],
};

// Windows can briefly hold a file handle open (AV scanners, indexers, NTFS
// bookkeeping) right after a connection closes. Retrying instead of failing
// immediately handles the common case, which clears within a few hundred ms.
const RETRYABLE_FS_CODES = ["EBUSY", "EPERM", "EACCES", "ETXTBSY"];

function isRetryableFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return !!code && RETRYABLE_FS_CODES.includes(code);
}

async function withRetry<T>(fn: () => T, retries = 5, delayMs = 200): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryableFsError(err)) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function validateSqliteFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  const sqliteHeader = Buffer.from("SQLite format 3\0");
  return buf.slice(0, 16).equals(sqliteHeader);
}

function validateSchema(filePath: string): string | null {
  let db: Database.Database | null = null;
  try {
    db = new Database(filePath, { readonly: true });
    const integrity = db.pragma("quick_check", { simple: true });
    if (integrity !== "ok") {
      return "Database integrity check failed";
    }
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = rows.map(r => r.name);
    for (const [table, requiredCols] of Object.entries(REQUIRED_SCHEMA)) {
      if (!tableNames.includes(table)) return `Missing required table: ${table}`;
      const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      const colNames = cols.map((c) => c.name);
      for (const col of requiredCols) {
        if (!colNames.includes(col)) return `Missing required column: ${table}.${col}`;
      }
    }
    return null;
  } catch {
    return "Could not read database schema";
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}

// Remove the WAL/SHM side files that accompany a SQLite file. A leftover `-wal`
// from the previous database would be re-applied over the swapped main file and
// corrupt it, so its removal is mandatory (throws on failure).
async function removeWalShm(dbPath: string): Promise<void> {
  for (const suffix of ["-wal", "-shm"]) {
    try {
      await withRetry(() => fs.rmSync(dbPath + suffix, { force: true }), 3, 100);
    } catch (err) {
      if (suffix === "-wal") throw err;
    }
  }
}

function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function backupService(adapter: DatabaseAdapter, dataDir: string) {
  const backupDir = path.join(dataDir, "backups");

  async function exportBackup(): Promise<{ filePath: string; fileName: string }> {
    const db = adapter.raw<Database.Database>();
    db.exec("PRAGMA wal_checkpoint(FULL)");

    const dbPath = db.name;
    if (!dbPath) throw new AppError(500, "Could not determine database path");

    fs.mkdirSync(backupDir, { recursive: true });

    // Local calendar date (shared convention), not UTC — around midnight in
    // UTC-negative zones an ISO-based name would lag a day behind.
    const fileName = `backup-${todayDateString()}.sqlite`;
    const destPath = path.join(backupDir, fileName);

    fs.copyFileSync(dbPath, destPath);
    return { filePath: destPath, fileName };
  }

  async function restoreBackup(fileBase64: string): Promise<void> {
    if (!dataDir) throw new AppError(500, "dataDir not configured");

    const tempDir = path.join(dataDir, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `restore-${Date.now()}-${crypto.randomUUID()}.sqlite`);
    let lockAcquired = false;

    try {
      const buf = Buffer.from(fileBase64, "base64");
      fs.writeFileSync(tempPath, buf);

      if (!validateSqliteFile(tempPath)) {
        throw new AppError(400, "Uploaded file is not a valid SQLite database", "INVALID_SQLITE_FILE");
      }

      const schemaError = validateSchema(tempPath);
      if (schemaError) {
        throw new AppError(400, `Invalid database schema: ${schemaError}`, "INVALID_DB_SCHEMA", { detail: String(schemaError) });
      }

      if (!acquireWriteLock()) {
        throw new AppError(409, "Another restore or maintenance operation is already in progress", "RESTORE_IN_PROGRESS");
      }
      lockAcquired = true;

      const currentDb = adapter.raw<Database.Database>();
      const dbPath = currentDb.name;

      fs.mkdirSync(backupDir, { recursive: true });
      const autoBackupPath = path.join(backupDir, `auto-${Date.now()}.sqlite`);

      // Consolidate all committed writes into the main file BEFORE copying, so
      // the automatic safety backup is complete and consistent (a raw copy of a
      // WAL-mode file while frames sit in `-wal` would be incomplete).
      try {
        currentDb.pragma("wal_checkpoint(FULL)");
      } catch (err) {
        // Best-effort — the auto-backup is a safety net, not the primary path,
        // but a failed checkpoint is worth knowing about.
        console.warn("[backup] WAL checkpoint before auto-backup failed:", (err as Error).message);
      }
      fs.copyFileSync(dbPath, autoBackupPath);

      // Close the live connection first so Windows releases its handle, then
      // drop the WAL/SHM side files. This must happen BEFORE the swap, or a
      // stale WAL from the old database could be applied over the new file.
      currentDb.close();

      // Roll the auto-backup back into place and reopen it, keeping the running
      // server usable instead of dying on a half-swapped file.
      const rollback = async (): Promise<void> => {
        await withRetry(() => fs.copyFileSync(autoBackupPath, dbPath));
        await removeWalShm(dbPath);
        const reopened = openDatabase(dbPath);
        replaceAdapter(reopened);
      };

      try {
        await removeWalShm(dbPath);
        await withRetry(() => fs.copyFileSync(tempPath, dbPath));
        const newDb = openDatabase(dbPath);
        replaceAdapter(newDb);
      } catch (err) {
        try {
          await rollback();
        } catch (rollbackErr) {
          console.error("[backup] Swap failed and rollback also failed:", rollbackErr);
          throw new AppError(500, "Restore failed and the database could not be rolled back: " + (rollbackErr as Error).message, "RESTORE_FAILED_CRITICAL", { detail: (rollbackErr as Error).message });
        }
        throw new AppError(500, "Restore failed: " + (err as Error).message + ". Auto-backup restored.", "RESTORE_FAILED", { detail: (err as Error).message });
      }

      // Invalidate all pre-restore JWTs so an old token can never map to a
      // different user/admin ID in the restored database.
      rotateJwtSecret();
      emitDbRestored();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, "Restore failed: " + (err as Error).message, "RESTORE_FAILED", { detail: (err as Error).message });
    } finally {
      if (lockAcquired) {
        releaseWriteLock();
      }
      try { fs.rmSync(tempPath, { force: true }); } catch { /* ignore */ }
    }
  }

  return { exportBackup, restoreBackup };
}
