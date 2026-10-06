import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { getServices } from "../services/container.js";

const router = Router();

router.get("/summary", authenticate, async (_req: Request, res: Response) => {
  const svc = getServices().dashboard;
  const summary = await svc.getSummary();
  res.json(summary);
});

export default router;
