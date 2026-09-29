import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { resolveReportLanguage } from "@integracore/shared";
import { discountService } from "../services/discountService.js";
import { parseId } from "../utils/parseId.js";
import { parsePagination } from "../utils/pagination.js";

// Mounted at /api/discounts. Discount creation is product-scoped
// (POST /api/products/:productId/discounts in routes/products.ts).
const router = Router();

router.get("/", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const result = await svc.listAll({
    ...parsePagination(req.query, 10),
    productId: req.query.product_id ? Number(req.query.product_id) : undefined,
    status: (req.query.status as string) || undefined,
  });
  res.json(result);
});

router.get("/export", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const workbook = await svc.exportHistory({
    productId: req.query.product_id ? Number(req.query.product_id) : undefined,
    status: (req.query.status as string) || undefined,
  }, resolveReportLanguage(req.query.lang as string));
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
