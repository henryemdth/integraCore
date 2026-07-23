import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { UpdateUserSchema, AdminResetPasswordSchema } from "@integracore/shared";
import { userService } from "../services/userService.js";

const router = Router();

router.get("/", authenticate, requireRole("admin"), (_req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  res.json({ users: svc.list() });
});

router.get("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  const user = svc.getById(Number(req.params.id));
  res.json({ user });
});

router.put("/:id", authenticate, requireRole("admin"), validate(UpdateUserSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  const user = svc.update(Number(req.params.id), req.body, req.user!.id);
  res.json({ user });
});

router.patch("/:id/deactivate", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  const user = svc.deactivate(Number(req.params.id), req.user!.id);
  res.json({ user });
});

router.patch("/:id/activate", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  const user = svc.activate(Number(req.params.id));
  res.json({ user });
});

router.put("/:id/password", authenticate, requireRole("admin"), validate(AdminResetPasswordSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = userService(db);
  const result = svc.resetPassword(Number(req.params.id), req.body.password);
  res.json(result);
});

export default router;
