import cron from "node-cron";
import type { DatabaseAdapter } from "../db/adapter.js";
import { profitService } from "../services/profitService.js";

export function startProfitCron(db: DatabaseAdapter) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const svc = profitService(db);
      const result = await svc.checkProfit();

      if (result.behind) {
        await svc.createNotification(
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
