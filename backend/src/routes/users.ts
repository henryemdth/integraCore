import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { UpdateUserSchema, AdminResetPasswordSchema } from "@integracore/shared";
import { getServices } from "../services/container.js";
import { parseId } from "../utils/parseId.js";
import { parsePagination } from "../utils/pagination.js";

const router = Router();

router.get("/", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const svc = getServices().users;
  const result = await svc.list({
    ...parsePagination(req.query, 10),
    active: (req.query.active as string) || undefined,
    search: (req.query.search as string) || undefined,
  });
  res.json(result);
});

router.get("/:id", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const svc = getServices().users;
  const user = await svc.getById(parseId(req.params.id as string));
  res.json({ user });
});

router.put("/:id", authenticate, requireRole("admin"), writeLockGuard, validate(UpdateUserSchema), async (req: Request, res: Response) => {
  const svc = getServices().users;
  const user = await svc.update(parseId(req.params.id as string), req.body, req.user!.id);
  res.json({ user });
});

router.patch("/:id/deactivate", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const svc = getServices().users;
  const user = await svc.deactivate(parseId(req.params.id as string), req.user!.id);
  res.json({ user });
});

router.patch("/:id/activate", authenticate, requireRole("admin"), writeLockGuard, async (req: Request, res: Response) => {
  const svc = getServices().users;
  const user = await svc.activate(parseId(req.params.id as string));
  res.json({ user });
});

router.put("/:id/password", authenticate, requireRole("admin"), writeLockGuard, validate(AdminResetPasswordSchema), async (req: Request, res: Response) => {
  const svc = getServices().users;
  const result = await svc.resetPassword(parseId(req.params.id as string), req.body.password);
  res.json(result);
});

export default router;
