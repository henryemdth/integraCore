import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { profitService } from "../services/profitService.js";
import { parseId } from "../utils/parseId.js";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const unreadOnly = req.query.unread === "true";
  const isAdmin = req.user!.role === "admin";
  res.json({ notifications: await svc.listNotifications(unreadOnly, isAdmin) });
});

router.get("/unread-count", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  res.json({ count: await svc.getUnreadCount(req.user!.role === "admin") });
});

// Static segment first so it can never be shadowed by /:id routes.
router.patch("/read-all", authenticate, async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.markAllAsRead();
  res.json(result);
});

router.patch("/:id/read", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.markAsRead(parseId(req.params.id as string));
  res.json(result);
});

export default router;
