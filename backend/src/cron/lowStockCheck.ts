import cron from "node-cron";
import type { DatabaseAdapter } from "../db/adapter.js";
import { productService } from "../services/productService.js";
import { profitService } from "../services/profitService.js";
import { nextDayDateString, startOfDay, todayDateString } from "@integracore/shared";

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
  // One alert per local calendar day: half-open [today 00:00, tomorrow 00:00)
  // window against created_at, which createNotification stores as a local
  // wall-clock string. Plain string/TIMESTAMP comparison works identically on
  // SQLite TEXT and Postgres TIMESTAMP — no driver-specific date() function.
  const existing = await db.get(
    "SELECT 1 FROM notifications WHERE type = 'low_stock' AND created_at >= ? AND created_at < ? LIMIT 1",
    [startOfDay(todayDateString()), startOfDay(nextDayDateString(todayDateString()))]
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
