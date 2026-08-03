import { config } from "./config.js"
import { createServer } from "http"
import fs from "fs"
import { initDatabase } from "./db/index.js"
import { initSocket } from "./socket/index.js"
import { createApp } from "./app.js"
import { startProfitCron } from "./cron/profitCheck.js"
import { startDiscountCron } from "./cron/discountCheck.js"

const app = createApp()
const server = createServer(app)

initSocket(server)

async function main() {
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(config.backupDir, { recursive: true })

  const { adapter } = await initDatabase()
  startProfitCron(adapter)
  startDiscountCron(adapter)

  // Run discount date-trigger check immediately on startup
  try {
    const { discountService } = await import("./services/discountService.js");
    const svc = discountService(adapter);
    svc.checkDateTriggers().then((r: any) => {
      if (r.activated > 0 || r.expired > 0) {
        console.log(`[startup] Discount date triggers: ${r.activated} activated, ${r.expired} expired`);
      }
    }).catch((err: any) => console.error("[startup] Discount trigger check failed:", err));
  } catch (err) {
    console.error("[startup] Failed to run discount trigger check:", err);
  }

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`[backend] Running on http://0.0.0.0:${config.port}`)
  })

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    // do not exit — log only, so one bad promise doesn't take down the whole server
  });

  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    // log and let existing graceful shutdown / process manager decide restart policy
  });

  function shutdown(signal: string) {
    console.log(`\n[backend] ${signal} received, shutting down...`)
    server.close(async () => {
      await adapter.close()
      console.log("[backend] Closed.")
      process.exit(0)
    })
    setTimeout(() => {
      console.error("[backend] Forced shutdown after timeout")
      process.exit(1)
    }, 5000)
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((err) => {
  console.error("[backend] Fatal startup error:", err)
  process.exit(1)
})
