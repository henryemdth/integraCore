import { Router, Request, Response } from "express";
import { getAdapter } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { profitService } from "../services/profitService.js";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const unreadOnly = req.query.unread === "true";
  res.json({ notifications: await svc.listNotifications(unreadOnly) });
});

router.get("/unread-count", authenticate, async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  res.json({ count: await svc.getUnreadCount() });
});

router.patch("/:id/read", authenticate, async (req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.markAsRead(Number(req.params.id));
  res.json(result);
});

router.patch("/read-all", authenticate, async (_req: Request, res: Response) => {
  const db = getAdapter();
  const svc = profitService(db);
  const result = await svc.markAllAsRead();
  res.json(result);
});

export default router;
