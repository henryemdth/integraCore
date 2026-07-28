import { config } from "./config.js"
import express from "express"
import cors from "cors"
import { createServer } from "http"
import { initDatabase } from "./db/index.js"
import { initSocket } from "./socket/index.js"
import { errorHandler } from "./middleware/errorHandler.js"
import authRoutes from "./routes/auth.js"
import productRoutes from "./routes/products.js"
import salesRoutes from "./routes/sales.js"
import usersRoutes from "./routes/users.js"
import profitRoutes from "./routes/profit.js"
import notificationRoutes from "./routes/notifications.js"
import discountRoutes from "./routes/discounts.js"
import { startProfitCron } from "./cron/profitCheck.js"
import { startDiscountCron } from "./cron/discountCheck.js"

const app = express()
const server = createServer(app)

initSocket(server)
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: "10mb" }))

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/api/auth", authRoutes)
app.use("/api/products", productRoutes)
app.use("/api/sales", salesRoutes)
app.use("/api/users", usersRoutes)
app.use("/api/profit", profitRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api", discountRoutes)

app.use(errorHandler)

async function main() {
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
