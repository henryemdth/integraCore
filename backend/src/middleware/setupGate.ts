import { Request, Response, NextFunction } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate, requireRole } from "./auth.js";
import { authService } from "../services/authService.js";

// Restore is a destructive operation: while the system is in first-run setup
// mode (no users yet) it must be reachable anonymously so the setup screen can
// swap in a backup. Once users exist, it requires a valid admin token.
export async function setupOrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getAdapter();
  const needsSetup = await authService(db).getSetupStatus();
  if (needsSetup) {
    next();
    return;
  }
  authenticate(req, res, () => {
    requireRole("admin")(req, res, next);
  });
}
