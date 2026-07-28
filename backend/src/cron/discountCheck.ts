import cron from "node-cron";
import type { DatabaseAdapter } from "../db/adapter.js";
import { discountService } from "../services/discountService.js";

export function startDiscountCron(db: DatabaseAdapter) {
  cron.schedule("0 0 * * *", async () => {
    try {
      const svc = discountService(db);
      const result = await svc.checkDateTriggers();
      if (result.activated > 0 || result.expired > 0) {
        console.log(`[cron] Discount date triggers: ${result.activated} activated, ${result.expired} expired`);
      }
    } catch (err) {
      console.error("[cron] Discount check failed:", err);
    }
  });

  console.log("[cron] Discount check scheduled daily at midnight");
}
