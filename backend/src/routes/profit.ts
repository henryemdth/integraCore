import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { profitService } from "../services/profitService.js";

const router = Router();

router.get("/target", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  res.json({ target: await svc.getTarget() });
});

router.put("/target", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const { target_amount, period_days } = req.body;
  if (target_amount === undefined || target_amount < 0) {
    res.status(400).json({ error: "target_amount must be >= 0" });
    return;
  }
  if (period_days === undefined || period_days < 1) {
    res.status(400).json({ error: "period_days must be >= 1" });
    return;
  }
  const db = getAdapter();
  const svc = profitService(db);
  const target = await svc.updateTarget(target_amount, period_days);
  res.json({ target });
});

router.get("/check", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.checkProfit();
  res.json(result);
});

router.get("/revenue", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const days = parseInt(req.query.days as string) || 15;
  const result = await svc.getRevenueSummary(days);
  res.json(result);
});

export default router;
