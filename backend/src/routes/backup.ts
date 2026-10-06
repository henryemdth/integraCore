import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { setupOrAdmin } from "../middleware/setupGate.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { getServices } from "../services/container.js";
import { config } from "../config.js";

const router = Router();

router.get("/export", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  if (config.dbDriver !== "sqlite") {
    res.status(400).json({ error: "Backup is only available for SQLite databases" });
    return;
  }
  const svc = getServices().backup;
  const { filePath, fileName } = await svc.exportBackup();
  res.download(filePath, fileName);
});

router.post("/restore", setupOrAdmin, writeLockGuard, async (req: Request, res: Response) => {
  if (config.dbDriver !== "sqlite") {
    res.status(400).json({ error: "Restore is only available for SQLite databases" });
    return;
  }
  const { file } = req.body as { file?: string };
  if (!file) {
    res.status(400).json({ error: "No file provided. Send base64-encoded .sqlite in 'file' field.", code: "NO_FILE" });
    return;
  }
  const svc = getServices().backup;
  await svc.restoreBackup(file);
  res.json({ success: true });
});

export default router;
