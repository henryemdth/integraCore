import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { writeLockGuard } from "../middleware/writeLock.js";
import { getServices } from "../services/container.js";
import { parseId } from "../utils/parseId.js";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().profit;
  const unreadOnly = req.query.unread === "true";
  const isAdmin = req.user!.role === "admin";
  res.json({ notifications: await svc.listNotifications(unreadOnly, isAdmin) });
});

router.get("/unread-count", authenticate, async (req: Request, res: Response) => {
  const svc = getServices().profit;
  res.json({ count: await svc.getUnreadCount(req.user!.role === "admin") });
});

// Static segment first so it can never be shadowed by /:id routes.
router.patch("/read-all", authenticate, writeLockGuard, async (req: Request, res: Response) => {
  const svc = getServices().profit;
  const result = await svc.markAllAsRead(req.user!.role === "admin");
  res.json(result);
});

router.patch("/:id/read", authenticate, writeLockGuard, async (req: Request, res: Response) => {
  const svc = getServices().profit;
  const result = await svc.markAsRead(parseId(req.params.id as string), req.user!.role === "admin");
  res.json(result);
});

export default router;
