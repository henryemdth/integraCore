import path from "path";
import dotenv from "dotenv";

dotenv.config();

const corsOrigins = (process.env.CORS_ORIGIN ||"")
  .split(",")
  .map(url => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

// "*" must stay a string so express-cors treats it as the wildcard
// (an array ["*"] would be treated as an exact-match list and reject
// origins like the "null" origin of a packaged Electron file:// page).
const corsOrigin = corsOrigins.includes("*") ? "*" : (corsOrigins || "http://localhost:5173");

const dataDir = process.env.DATA_DIR || path.resolve("data");

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  corsOrigin,

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
