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

  // When deployed behind a reverse proxy (e.g. Render), trust the first proxy
  // hop so express-rate-limit keys off the real client IP instead of sharing
  // one bucket across every user.
  if (process.env.TRUST_PROXY) {
    app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : Number(process.env.TRUST_PROXY) || 1);
  }

  app.use(cors({ origin: config.corsOrigin }))
  // Only backup/restore and bulk product import send base64 files in JSON
  // (~33% inflation). Scope the 50mb cap to those two routes and keep a tight
  // 1mb limit everywhere else to protect memory and limit DoS surface.
  const largeJsonParser = express.json({ limit: "50mb" });
  app.use("/api/backup/restore", largeJsonParser);
  app.use("/api/products/import", largeJsonParser);
  app.use(express.json({ limit: "1mb" }));

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
  app.use("/api/discounts", discountRoutes)

  app.use(errorHandler)

  return app;
}
