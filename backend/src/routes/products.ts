import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { CreateProductSchema, UpdateProductSchema, StockMovementSchema, CreateDiscountSchema, resolveReportLanguage } from "@integracore/shared";
import { productService } from "../services/productService.js";
import { discountService } from "../services/discountService.js";
import { parseId } from "../utils/parseId.js";
import { parsePagination } from "../utils/pagination.js";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.list({
    ...parsePagination(req.query, 20),
    search: (req.query.search as string) || "",
    category: (req.query.category as string) || "",
    status: (req.query.status as string) || "",
    sort: (req.query.sort as string) || "created_at",
    order: (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC",
  });
  res.json(result);
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
    (req.query.status as string) || "",
    resolveReportLanguage(req.query.lang as string)
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

// Header-only template so users always have a correctly-shaped file to fill
// in; column names come in the requested language (frontend sends lang).
// Registered before GET /:id so "import-template" isn't captured as an id.
router.get("/import-template", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const workbook = await svc.buildImportTemplate(resolveReportLanguage(req.query.lang as string));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=product-import-template.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.getById(parseId(req.params.id as string));
  res.json({ product });
});

router.post("/import", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const { file } = req.body as { file?: string };
  if (!file) {
    res.status(400).json({ error: "No file provided. Send base64-encoded .xlsx in 'file' field.", code: "NO_FILE" });
    return;
  }
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.importFromExcel(file);
  res.json(result);
});

router.post("/", authenticate, requireRole("admin"), writeLockGuard, validate(CreateProductSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.create(req.body);
  res.status(201).json({ product });
});

router.put("/:id", authenticate, requireRole("admin"), writeLockGuard, validate(UpdateProductSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.update(parseId(req.params.id as string), req.body);
  res.json({ product });
});

router.delete("/:id", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const result = await svc.remove(parseId(req.params.id as string));
  res.json(result);
});

router.post("/:id/stock-in", authenticate, requireRole("admin"), writeLockGuard, validate(StockMovementSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.stockIn(parseId(req.params.id as string), req.body.quantity);
  res.json({ product });
});

router.post("/:id/stock-out", authenticate, requireRole("admin"), writeLockGuard, validate(StockMovementSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = productService(db);
  const product = await svc.stockOut(parseId(req.params.id as string), req.body.quantity);
  res.json({ product });
});

// Discount creation is product-scoped; discount-level operations (history,
// cancel/delete/export) live in routes/discounts.ts.
router.post("/:productId/discounts", authenticate, requireRole("admin"), writeLockGuard, validate(CreateDiscountSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = discountService(db);
  const discount = await svc.create(parseId(req.params.productId as string), req.body);
  res.status(201).json({ discount });
});

export default router;
