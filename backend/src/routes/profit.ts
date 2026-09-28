import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { ProfitTargetSchema } from "@integracore/shared";
import { profitService } from "../services/profitService.js";

const router = Router();

router.get("/target", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  res.json({ target: await svc.getTarget() });
});

router.put("/target", authenticate, requireRole("admin"), writeLockGuard, validate(ProfitTargetSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const target = await svc.updateTarget(req.body.target_amount, req.body.period_days);
  res.json({ target });
});

router.get("/check", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.checkProfit();
  res.json(result);
});

export default router;
