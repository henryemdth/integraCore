import cron from "node-cron";
import type Database from "better-sqlite3";
import { profitService } from "../services/profitService.js";

export function startProfitCron(db: Database.Database) {
  cron.schedule("0 0 * * *", () => {
    try {
      const svc = profitService(db);
      const result = svc.checkProfit();

      if (result.behind) {
        svc.createNotification(
          "profit_behind",
          `Profit behind pace: ${result.revenue.toFixed(2)} / ${result.target_amount.toFixed(2)} (${result.percentage}%). Gap: ${result.gap.toFixed(2)}`
        );
        console.log(`[cron] Profit behind pace: ${result.percentage}%`);
      } else {
        console.log(`[cron] Profit check OK: ${result.percentage}%`);
      }
    } catch (err) {
      console.error("[cron] Profit check failed:", err);
    }
  });

  console.log("[cron] Profit check scheduled daily at midnight");
}
