import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { validate } from "../middleware/validate.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { SetupSchema, LoginSchema, RegisterSchema, ChangePasswordSchema } from "@integracore/shared";
import { authService } from "../services/authService.js";
import { config } from "../config.js";

const router = Router();

router.get("/setup-status", async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  res.json({ needsSetup: await svc.getSetupStatus(), dbDriver: config.dbDriver });
});

router.post("/setup", authRateLimiter, writeLockGuard, validate(SetupSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  const result = await svc.setup(req.body.username, req.body.password, req.body.full_name);
  res.status(201).json(result);
});

router.post("/login", authRateLimiter, validate(LoginSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  const result = await svc.login(req.body.username, req.body.password);
  res.json(result);
});

router.post("/register", authenticate, requireRole("admin"), writeLockGuard, validate(RegisterSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  const result = await svc.register(req.body.username, req.body.password, req.body.full_name, req.body.role);
  res.status(201).json(result);
});

router.put("/password", authenticate, writeLockGuard, validate(ChangePasswordSchema), async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  const result = await svc.changePassword(req.user!.id, req.body.current_password, req.body.new_password);
  res.json(result);
});

router.get("/me", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = authService(db);
  const result = await svc.getMe(req.user!.id);
  res.json(result);
});

export default router;
