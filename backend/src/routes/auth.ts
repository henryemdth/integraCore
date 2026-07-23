import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { SetupSchema, LoginSchema, RegisterSchema, ChangePasswordSchema } from "@integracore/shared";
import { authService } from "../services/authService.js";

const router = Router();

router.get("/setup-status", (_req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  res.json({ needsSetup: svc.getSetupStatus() });
});

router.post("/setup", validate(SetupSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  const result = svc.setup(req.body.username, req.body.password, req.body.full_name);
  res.status(201).json(result);
});

router.post("/login", validate(LoginSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  const result = svc.login(req.body.username, req.body.password);
  res.json(result);
});

router.post("/register", authenticate, requireRole("admin"), validate(RegisterSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  const result = svc.register(req.body.username, req.body.password, req.body.full_name, req.body.role);
  res.status(201).json(result);
});

router.put("/password", authenticate, validate(ChangePasswordSchema), (req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  const result = svc.changePassword(req.user!.id, req.body.current_password, req.body.new_password);
  res.json(result);
});

router.get("/me", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = authService(db);
  const result = svc.getMe(req.user!.id);
  res.json(result);
});

export default router;
