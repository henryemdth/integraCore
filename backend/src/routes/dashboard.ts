import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { dashboardService } from "../services/dashboardService.js";

const router = Router();

router.get("/summary", authenticate, async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = dashboardService(db);
  const summary = await svc.getSummary();
  res.json(summary);
});

export default router;
