import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../services/authService.js";
import { CreateDiscountSchema } from "@integracore/shared";
import { discountService } from "../services/discountService.js";

const router = Router();

function parseId(raw: string): number {
  const id = Number(raw);
  if (isNaN(id) || id <= 0) throw new AppError(400, "Invalid ID parameter");
  return id;
}

router.get("/products/:productId/discounts", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const discounts = await svc.list(parseId(req.params.productId as string));
  res.json({ discounts });
});

router.post("/products/:productId/discounts", authenticate, requireRole("admin"), writeLockGuard, validate(CreateDiscountSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const discount = await svc.create(parseId(req.params.productId as string), req.body);
  res.status(201).json({ discount });
});

router.patch("/discounts/:id/cancel", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const result = await svc.cancel(parseId(req.params.id as string));
  res.json(result);
});

router.delete("/discounts/:id", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const result = await svc.remove(parseId(req.params.id as string));
  res.json(result);
});

router.get("/discounts/export", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const workbook = await svc.exportHistory();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=discount-history.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/discounts", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const discounts = await svc.listAll();
  res.json({ discounts });
});

export default router;
