import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UpdateUserSchema, AdminResetPasswordSchema } from "@integracore/shared";
import { userService } from "../services/userService.js";

const router = Router();

router.get("/", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const result = await svc.list({
    page: Math.max(1, parseInt(req.query.page as string) || 1),
    limit: Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10)),
    active: (req.query.active as string) || undefined,
  });
  res.json(result);
});

router.get("/:id", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const user = await svc.getById(Number(req.params.id));
  res.json({ user });
});

router.put("/:id", authenticate, requireRole("admin"), validate(UpdateUserSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const user = await svc.update(Number(req.params.id), req.body, req.user!.id);
  res.json({ user });
});

router.patch("/:id/deactivate", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const user = await svc.deactivate(Number(req.params.id), req.user!.id);
  res.json({ user });
});

router.patch("/:id/activate", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const user = await svc.activate(Number(req.params.id));
  res.json({ user });
});

router.put("/:id/password", authenticate, requireRole("admin"), validate(AdminResetPasswordSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = userService(db);
  const result = await svc.resetPassword(Number(req.params.id), req.body.password);
  res.json(result);
});

export default router;
