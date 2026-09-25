import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

// Auth-gated: only the frontend's Settings page consumes this (it needs to
// know whether SQLite-only features like backup/restore should be shown).
// Pre-login callers get the same information from the public
// GET /api/auth/setup-status response instead.
router.get("/info", authenticate, (_req: Request, res: Response) => {
  res.json({ dbDriver: config.dbDriver });
});

export default router;
