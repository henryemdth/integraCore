import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  dbPath: process.env.DB_PATH || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
} as const;
