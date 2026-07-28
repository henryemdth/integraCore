import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CreateProductSchema, UpdateProductSchema, StockMovementSchema } from "@integracore/shared";
import { productService } from "../services/productService.js";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.list({
    page: Math.max(1, parseInt(req.query.page as string) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20)),
    search: (req.query.search as string) || "",
    category: (req.query.category as string) || "",
    status: (req.query.status as string) || "",
    sort: (req.query.sort as string) || "created_at",
    order: (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC",
  });
  res.json(result);
});

router.get("/low-stock", authenticate, requireRole("admin"), async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  res.json({ products: await svc.listLowStock() });
});

router.get("/categories", authenticate, async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  res.json({ categories: await svc.getCategories() });
});

router.get("/export", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const workbook = await svc.exportToExcel(
    (req.query.search as string) || "",
    (req.query.category as string) || "",
    (req.query.status as string) || ""
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
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.importFromExcel(file);
  res.json(result);
});

router.post("/", authenticate, requireRole("admin"), validate(CreateProductSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.create(req.body);
  res.status(201).json({ product });
});

router.put("/:id", authenticate, requireRole("admin"), validate(UpdateProductSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.update(Number(req.params.id), req.body);
  res.json({ product });
});

router.delete("/:id", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.remove(Number(req.params.id));
  res.json(result);
});

router.post("/:id/stock-in", authenticate, requireRole("admin"), validate(StockMovementSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.stockIn(Number(req.params.id), req.body.quantity);
  res.json({ product });
});

router.post("/:id/stock-out", authenticate, requireRole("admin"), validate(StockMovementSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.stockOut(Number(req.params.id), req.body.quantity);
  res.json({ product });
});

export default router;
