import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { discountService } from "../services/discountService.js";
import { parseId } from "../utils/parseId.js";

// Mounted at /api/discounts. Product-scoped discount endpoints
// (GET/POST /api/products/:productId/discounts) live in routes/products.ts.
const router = Router();

router.get("/", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const discounts = await svc.listAll();
  res.json({ discounts });
});

router.get("/export", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const workbook = await svc.exportHistory();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=discount-history.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.patch("/:id/cancel", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const result = await svc.cancel(parseId(req.params.id as string));
  res.json(result);
});

router.delete("/:id", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const result = await svc.remove(parseId(req.params.id as string));
  res.json(result);
});

export default router;
