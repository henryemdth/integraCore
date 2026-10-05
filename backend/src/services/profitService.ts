import type { DatabaseAdapter } from "../db/adapter.js";
import { nowString } from "@integracore/shared";
import { emitNotification } from "../socket/index.js";
import { AppError } from "../utils/appError.js";

// Fallback when no target row exists yet; mirrors the profit_targets DDL default.
const DEFAULT_PROFIT_PERIOD_DAYS = 15;
const NOTIFICATIONS_PAGE_SIZE = 50;

export function profitService(db: DatabaseAdapter) {
  async function getTarget() {
    const target = await db.get("SELECT * FROM profit_targets ORDER BY id DESC LIMIT 1") as any;
    return target || { id: 0, target_amount: 0, period_days: DEFAULT_PROFIT_PERIOD_DAYS, period: "custom", created_at: "", updated_at: "" };
  }

  async function updateTarget(targetAmount: number, periodDays: number) {
    const existing = await db.get("SELECT id FROM profit_targets LIMIT 1") as any;
    if (existing) {
      await db.run(
        "UPDATE profit_targets SET target_amount = ?, period_days = ?, updated_at = datetime('now') WHERE id = ?",
        [targetAmount, periodDays, existing.id]
      );
    } else {
      await db.run(
        "INSERT INTO profit_targets (target_amount, period_days, period) VALUES (?, ?, 'custom')",
        [targetAmount, periodDays]
      );
    }
    return await getTarget();
  }

  async function checkProfit() {
    const target = await getTarget();
    const days = (target as any).period_days || DEFAULT_PROFIT_PERIOD_DAYS;

    const sales = await db.get(
      `SELECT COALESCE(SUM(si.subtotal), 0) as total_revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= datetime('now', '-' || ? || ' days')`,
      [days]
    ) as { total_revenue: number };

    const revenue = sales.total_revenue;
    const targetAmount = target.target_amount;
    const percentage = targetAmount > 0 ? Math.round((revenue / targetAmount) * 100) : 0;
    const behind = targetAmount > 0 && revenue < targetAmount;

    return {
      revenue,
      target_amount: targetAmount,
      period_days: days,
      percentage,
      behind,
      gap: targetAmount - revenue,
    };
  }

  async function createNotification(
    type: string,
    message: string,
    params?: Record<string, unknown>,
    audience: "all" | "admin" = "all"
  ) {
    // Explicit local wall-clock timestamp (same convention as discount
    // ranges) instead of the column's datetime('now') UTC default — day-based
    // dedup queries compare against local calendar days, and PG display would
    // otherwise render UTC times as if they were local.
    // `params` is a JSON blob the client interpolates into a translated
    // message; `audience` keeps admin-only texts (profit pace) away from
    // sellers. Old rows have NULL params / 'all' audience and render as before.
    const result = await db.run(
      "INSERT INTO notifications (type, message, params, audience, created_at) VALUES (?, ?, ?, ?, ?)",
      [type, message, params ? JSON.stringify(params) : null, audience, nowString()]
    );

    const notification = {
      id: result.insertId,
      type,
      message,
      params: params ?? null,
      audience,
    };

    emitNotification(notification);
    return notification;
  }

  async function listNotifications(unreadOnly = false, isAdmin = false) {
    // audience 'all' rows go to everyone; 'admin' rows only when the requester
    // is an admin. `? = 1` keeps the boolean filter identical on SQLite
    // (INTEGER 0/1) and PostgreSQL.
    const visibility = "(audience = 'all' OR (? = 1 AND audience = 'admin'))";
    const where = unreadOnly
      ? `WHERE read = 0 AND ${visibility}`
      : `WHERE ${visibility}`;
    return await db.all(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ${NOTIFICATIONS_PAGE_SIZE}`,
      [isAdmin ? 1 : 0]
    );
  }

  async function markAsRead(id: number) {
    const result = await db.run("UPDATE notifications SET read = 1 WHERE id = ?", [id]);
    if (result.changes === 0) throw new AppError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
    return { success: true };
  }

  async function markAllAsRead() {
    await db.run("UPDATE notifications SET read = 1 WHERE read = 0");
    return { success: true };
  }

  async function getUnreadCount(isAdmin = false) {
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM notifications WHERE read = 0 AND (audience = 'all' OR (? = 1 AND audience = 'admin'))",
      [isAdmin ? 1 : 0]
    );
    return row!.count;
  }

  return { getTarget, updateTarget, checkProfit, createNotification, listNotifications, markAsRead, markAllAsRead, getUnreadCount };
}
