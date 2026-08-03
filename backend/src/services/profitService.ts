import type { DatabaseAdapter } from "../db/adapter.js";
import { emitNotification } from "../socket/index.js";

export function profitService(db: DatabaseAdapter) {
  async function getTarget() {
    const target = await db.get("SELECT * FROM profit_targets ORDER BY id DESC LIMIT 1") as any;
    return target || { id: 0, target_amount: 0, period_days: 15, period: "custom", created_at: "", updated_at: "" };
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

  async function checkProfit(periodDays?: number) {
    const target = await getTarget();
    const days = periodDays || (target as any).period_days || 15;

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

  async function getRevenueSummary(periodDays: number) {
    const sales = await db.get(
      `SELECT COALESCE(SUM(si.subtotal), 0) as total_revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= datetime('now', '-' || ? || ' days')`,
      [periodDays]
    ) as { total_revenue: number };

    return { total_revenue: sales.total_revenue, period_days: periodDays };
  }

  async function createNotification(type: string, message: string) {
    const result = await db.run(
      "INSERT INTO notifications (type, message) VALUES (?, ?)",
      [type, message]
    );

    const notification = {
      id: result.insertId,
      type,
      message,
    };

    emitNotification(notification);
    return notification;
  }

  async function listNotifications(unreadOnly = false) {
    const where = unreadOnly ? "WHERE read = 0" : "";
    return await db.all(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`);
  }

  async function markAsRead(id: number) {
    await db.run("UPDATE notifications SET read = 1 WHERE id = ?", [id]);
    return { success: true };
  }

  async function markAllAsRead() {
    await db.run("UPDATE notifications SET read = 1 WHERE read = 0");
    return { success: true };
  }

  async function getUnreadCount() {
    const row = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM notifications WHERE read = 0");
    return row!.count;
  }

  return { getTarget, updateTarget, checkProfit, getRevenueSummary, createNotification, listNotifications, markAsRead, markAllAsRead, getUnreadCount };
}
