import cron from "node-cron";
import type { DatabaseAdapter } from "../db/adapter.js";
import { productService } from "../services/productService.js";
import { profitService } from "../services/profitService.js";
import { todayDateString } from "@integracore/shared";

export function startLowStockCron(db: DatabaseAdapter) {
  cron.schedule("0 0 * * *", async () => {
    try {
      await runLowStockCheck(db);
    } catch (err) {
      console.error("[cron] Low stock check failed:", err);
    }
  });

  console.log("[cron] Low stock check scheduled daily at midnight");
}

export async function runLowStockCheck(db: DatabaseAdapter) {
  const svc = profitService(db);
  // One alert per day: date(created_at) = ? works on both SQLite (TEXT) and
  // Postgres (TIMESTAMP). Param injection avoids driver-specific datetime
  // functions that PostgresAdapter doesn't translate.
  const existing = await db.get(
    "SELECT 1 FROM notifications WHERE type = 'low_stock' AND date(created_at) = ? LIMIT 1",
    [todayDateString()]
  );
  if (existing) return;

  const lowStock = await productService(db).listLowStock();
  if (lowStock.length === 0) return;

  const names = lowStock.slice(0, 5).map((p: any) => p.name).join(", ");
  const extra = lowStock.length > 5 ? ` (+${lowStock.length - 5} more)` : "";
  await svc.createNotification(
    "low_stock",
    `Low stock: ${lowStock.length} product(s) below threshold — ${names}${extra}`
  );
  console.log(`[cron] Low stock alert: ${lowStock.length} product(s) below threshold`);
}
