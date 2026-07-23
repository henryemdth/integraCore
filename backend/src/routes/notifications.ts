import { Router, Request, Response } from "express";
import { getDb } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { profitService } from "../services/profitService.js";

const router = Router();

router.get("/", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = profitService(db);
  const unreadOnly = req.query.unread === "true";
  res.json({ notifications: svc.listNotifications(unreadOnly) });
});

router.get("/unread-count", authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const svc = profitService(db);
  res.json({ count: svc.getUnreadCount() });
});

router.patch("/:id/read", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const svc = profitService(db);
  const result = svc.markAsRead(Number(req.params.id));
  res.json(result);
});

router.patch("/read-all", authenticate, (_req: Request, res: Response) => {
  const db = getDb();
  const svc = profitService(db);
  const result = svc.markAllAsRead();
  res.json(result);
});

export default router;
