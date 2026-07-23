import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CreateSaleSchema } from "@integracore/shared";
import { saleService } from "../services/saleService.js";

const router = Router();

router.post("/", authenticate, validate(CreateSaleSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = saleService(db);
  const result = svc.create(req.user!.id, req.body.items, req.body.notes);
  res.status(201).json(result);
});

router.get("/", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = saleService(db);
  const result = svc.list({
    page: Math.max(1, parseInt(req.query.page as string) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)),
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
  const db = getDb();
  const svc = saleService(db);
  const workbook = await svc.exportToExcel({
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseInt(req.query.user_id as string) || undefined,
    dateFrom: (req.query.date_from as string) || undefined,
    dateTo: (req.query.date_to as string) || undefined,
    productId: parseInt(req.query.product_id as string) || undefined,
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/:id", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = saleService(db);
  const result = svc.getById(Number(req.params.id), req.user!.id, req.user!.role === "admin");
  res.json(result);
});

router.delete("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const svc = saleService(db);
  const result = svc.remove(Number(req.params.id));
  res.json(result);
});

export default router;
