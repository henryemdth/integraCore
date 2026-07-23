import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CreateProductSchema, UpdateProductSchema, StockMovementSchema } from "@integracore/shared";
import { productService } from "../services/productService.js";

const router = Router();

router.get("/", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const result = svc.list({
    page: Math.max(1, parseInt(req.query.page as string) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)),
    search: (req.query.search as string) || "",
    category: (req.query.category as string) || "",
    sort: (req.query.sort as string) || "created_at",
    order: (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC",
  });
  res.json(result);
});

router.get("/low-stock", authenticate, requireRole("admin"), (_req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  res.json({ products: svc.listLowStock() });
});

router.get("/categories", authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  res.json({ categories: svc.getCategories() });
});

router.get("/export", authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const workbook = await svc.exportToExcel(
    (req.query.search as string) || "",
    (req.query.category as string) || ""
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.post("/import", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const { file } = req.body as { file?: string };
  if (!file) {
    res.status(400).json({ error: "No file provided. Send base64-encoded .xlsx in 'file' field." });
    return;
  }
  const db = getDb();
  const svc = productService(db);
  const result = await svc.importFromExcel(file);
  res.json(result);
});

router.post("/", authenticate, requireRole("admin"), validate(CreateProductSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const product = svc.create(req.body);
  res.status(201).json({ product });
});

router.put("/:id", authenticate, requireRole("admin"), validate(UpdateProductSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const product = svc.update(Number(req.params.id), req.body);
  res.json({ product });
});

router.delete("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const result = svc.remove(Number(req.params.id));
  res.json(result);
});

router.post("/:id/stock-in", authenticate, requireRole("admin"), validate(StockMovementSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const product = svc.stockIn(Number(req.params.id), req.body.quantity);
  res.json({ product });
});

router.post("/:id/stock-out", authenticate, requireRole("admin"), validate(StockMovementSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = productService(db);
  const product = svc.stockOut(Number(req.params.id), req.body.quantity);
  res.json({ product });
});

export default router;
