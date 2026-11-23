import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { CreateSaleSchema, resolveReportLanguage } from "@integracore/shared";
import { getServices } from "../services/container.js";
import { parseId } from "../utils/parseId.js";
import { parsePagination } from "../utils/pagination.js";
import { AppError } from "../utils/appError.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateQuery(raw: unknown, field: string): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  if (!DATE_RE.test(s)) {
    throw new AppError(400, `${field} must be YYYY-MM-DD`, "VALIDATION_FAILED");
  }
  return s;
}

function parseOptionalId(raw: unknown): number | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, "Invalid ID parameter", "INVALID_ID");
  }
  return n;
}

const router = Router();

router.post("/", authenticate, writeLockGuard, validate(CreateSaleSchema), async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const result = await svc.create(req.user!.id, req.body.items, req.body.notes);
  res.status(201).json(result);
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const result = await svc.list({
    ...parsePagination(req.query, 20),
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseOptionalId(req.query.user_id),
    dateFrom: parseDateQuery(req.query.date_from, "date_from"),
    dateTo: parseDateQuery(req.query.date_to, "date_to"),
    productId: parseOptionalId(req.query.product_id),
  });
  res.json(result);
});

router.get("/export", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const workbook = await svc.exportToExcel({
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseOptionalId(req.query.user_id),
    dateFrom: parseDateQuery(req.query.date_from, "date_from"),
    dateTo: parseDateQuery(req.query.date_to, "date_to"),
    productId: parseOptionalId(req.query.product_id),
  }, resolveReportLanguage(req.query.lang as string));
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

router.get("/stats", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const result = await svc.stats({
    isAdmin: req.user!.role === "admin",
    requesterId: req.user!.id,
    userId: parseOptionalId(req.query.user_id),
    dateFrom: parseDateQuery(req.query.date_from, "date_from"),
    dateTo: parseDateQuery(req.query.date_to, "date_to"),
    productId: parseOptionalId(req.query.product_id),
  });
  res.json(result);
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const result = await svc.getById(parseId(req.params.id as string), req.user!.id, req.user!.role === "admin");
  res.json(result);
});

router.delete("/:id", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const svc = getServices().sales;
  const result = await svc.remove(parseId(req.params.id as string));
  res.json(result);
});

export default router;
