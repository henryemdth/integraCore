import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { backupService } from "../services/backupService.js";
import { config } from "../config.js";

const router = Router();

router.get("/export", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  if (config.dbDriver !== "sqlite") {
    res.status(400).json({ error: "Backup is only available for SQLite databases" });
    return;
  }
  const db = getAdapter();
  const svc = backupService(db, config.dataDir);
  const { filePath, fileName } = await svc.exportBackup();
  res.download(filePath, fileName);
});

router.post("/restore", writeLockGuard, async (req: Request, res: Response) => {
  if (config.dbDriver !== "sqlite") {
    res.status(400).json({ error: "Restore is only available for SQLite databases" });
    return;
  }
  const { file } = req.body as { file?: string };
  if (!file) {
    res.status(400).json({ error: "No file provided. Send base64-encoded .sqlite in 'file' field." });
    return;
  }
  const db = getAdapter();
  const svc = backupService(db, config.dataDir);
  await svc.restoreBackup(file);
  res.json({ success: true });
});

export default router;
