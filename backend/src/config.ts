import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const corsOrigins = (process.env.CORS_ORIGIN ||"")
  .split(",")
  .map(url => url.trim().replace(/\/$/, ""))
  .filter(Boolean);

// "*" must stay a string so express-cors treats it as the wildcard
// (an array ["*"] would be treated as an exact-match list and reject
// origins like the "null" origin of a packaged Electron file:// page).
// Default is "*" so LAN clients work out of the box; tighten via env for
// the cloud/Postgres deployment.
const corsOrigin = corsOrigins.includes("*")
  ? "*"
  : corsOrigins.length > 0
    ? corsOrigins
    : "*";

const dataDir = process.env.DATA_DIR || path.resolve("data");

// Per-install JWT secret: if not provided via env, generate one and persist it
// under the data directory so every install (dev, packaged server) gets a
// unique secret. Never falls back to a shared hardcoded value, which would let
// anyone forge admin tokens.
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv !== "dev-secret-change-in-production" && fromEnv !== "integracore-server-secret") {
    return fromEnv;
  }
  try {
    const secretPath = path.join(dataDir, ".jwt-secret");
    if (fs.existsSync(secretPath)) {
      const stored = fs.readFileSync(secretPath, "utf-8").trim();
      if (stored) return stored;
    }
    const generated = crypto.randomBytes(32).toString("base64url");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    // Last resort — only reachable if data dir is unwritable.
    return crypto.randomBytes(32).toString("base64url");
  }
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: resolveJwtSecret(),
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
