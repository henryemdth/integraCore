import "dotenv/config";
import path from "path";

const corsOrigins = (process.env.CORS_ORIGIN ||"")
  .split(",")
  .map(url => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

const dataDir = process.env.DATA_DIR || path.resolve("data");

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  corsOrigin: corsOrigins || "http://localhost:5173",

  // Database driver: "sqlite" or "postgresql"
  dbDriver: (process.env.DB_DRIVER || "sqlite") as "sqlite" | "postgresql",

  // Paths
  dataDir,
  backupDir: path.join(dataDir, "backups"),

  // SQLite
  dbPath: process.env.DB_PATH || path.join(dataDir, "integracore.db"),

  // PostgreSQL
  pg: {
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    database: process.env.PG_DATABASE || "integracore",
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "",
    ssl: process.env.PG_SSL === "true",
  },
} as const;
