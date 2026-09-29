import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { CreateSaleSchema, resolveReportLanguage } from "@integracore/shared";
import { saleService } from "../services/saleService.js";
import { parseId } from "../utils/parseId.js";
import { parsePagination } from "../utils/pagination.js";

const router = Router();

router.post("/", authenticate, writeLockGuard, validate(CreateSaleSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const result = await svc.create(req.user!.id, req.body.items, req.body.notes);
  res.status(201).json(result);
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const result = await svc.list({
    ...parsePagination(req.query, 20),
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseInt(req.query.user_id as string) || undefined,
    dateFrom: (req.query.date_from as string) || undefined,
    dateTo: (req.query.date_to as string) || undefined,
    productId: parseInt(req.query.product_id as string) || undefined,
  });
  res.json(result);
});

router.get("/export", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const workbook = await svc.exportToExcel({
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseInt(req.query.user_id as string) || undefined,
    dateFrom: (req.query.date_from as string) || undefined,
    dateTo: (req.query.date_to as string) || undefined,
    productId: parseInt(req.query.product_id as string) || undefined,
  }, resolveReportLanguage(req.query.lang as string));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/stats", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const result = await svc.stats({
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseInt(req.query.user_id as string) || undefined,
    dateFrom: (req.query.date_from as string) || undefined,
    dateTo: (req.query.date_to as string) || undefined,
    productId: parseInt(req.query.product_id as string) || undefined,
  });
  res.json(result);
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const result = await svc.getById(parseId(req.params.id as string), req.user!.id, req.user!.role === "admin");
  res.json(result);
});

router.delete("/:id", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = saleService(db);
  const result = await svc.remove(parseId(req.params.id as string));
  res.json(result);
});

export default router;
