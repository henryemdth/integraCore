import "express-async-errors";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import usersRoutes from "./routes/users.js";
import profitRoutes from "./routes/profit.js";
import notificationRoutes from "./routes/notifications.js";
import discountRoutes from "./routes/discounts.js";
import dashboardRoutes from "./routes/dashboard.js";
import systemRoutes from "./routes/system.js";
import backupRoutes from "./routes/backup.js";

export function createApp() {
  const app = express();

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
  app.use("/api/dashboard", dashboardRoutes)
  app.use("/api/system", systemRoutes)
  app.use("/api/backup", backupRoutes)
  app.use("/api", discountRoutes)

  app.use(errorHandler)

  return app;
}
