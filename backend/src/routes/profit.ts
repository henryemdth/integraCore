import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { ProfitTargetSchema } from "@integracore/shared";
import { getServices } from "../services/container.js";

const router = Router();

router.get("/target", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const svc = getServices().profit;
  res.json({ target: await svc.getTarget() });
});

router.put("/target", authenticate, requireRole("admin"), writeLockGuard, validate(ProfitTargetSchema), async (req: Request, res: Response) => {
  const svc = getServices().profit;
  const target = await svc.updateTarget(req.body.target_amount, req.body.period_days);
  res.json({ target });
});

router.get("/check", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const svc = getServices().profit;
  const result = await svc.checkProfit();
  res.json(result);
});

export default router;
