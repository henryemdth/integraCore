import type Database from "better-sqlite3";
import { AppError } from "./authService.js";
import { emitNotification } from "../socket/index.js";

export function profitService(db: Database.Database) {
  function getTarget() {
    const target = db.prepare("SELECT * FROM profit_targets ORDER BY id DESC LIMIT 1").get() as any;
    return target || { id: 0, target_amount: 0, period_days: 15, period: "custom", created_at: "", updated_at: "" };
  }

  function updateTarget(targetAmount: number, periodDays: number) {
    const existing = db.prepare("SELECT id FROM profit_targets LIMIT 1").get() as any;
    if (existing) {
      db.prepare(
        "UPDATE profit_targets SET target_amount = ?, period_days = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(targetAmount, periodDays, existing.id);
    } else {
      db.prepare(
        "INSERT INTO profit_targets (target_amount, period_days, period) VALUES (?, ?, 'custom')"
      ).run(targetAmount, periodDays);
    }
    return getTarget();
  }

  function checkProfit(periodDays?: number) {
    const target = getTarget();
    const days = periodDays || (target as any).period_days || 15;

    const sales = db.prepare(
      `SELECT COALESCE(SUM(si.subtotal), 0) as total_revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= datetime('now', '-' || ? || ' days')`
    ).get(days) as { total_revenue: number };

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

  function getRevenueSummary(periodDays: number) {
    const sales = db.prepare(
      `SELECT COALESCE(SUM(si.subtotal), 0) as total_revenue
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.created_at >= datetime('now', '-' || ? || ' days')`
    ).get(periodDays) as { total_revenue: number };

    return { total_revenue: sales.total_revenue, period_days: periodDays };
  }

  function createNotification(type: string, message: string) {
    const result = db.prepare(
      "INSERT INTO notifications (type, message) VALUES (?, ?)"
    ).run(type, message);

    const notification = {
      id: Number(result.lastInsertRowid),
      type,
      message,
    };

    emitNotification(notification);
    return notification;
  }

  function listNotifications(unreadOnly = false) {
    const where = unreadOnly ? "WHERE read = 0" : "";
    return db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT 50`).all();
  }

  function markAsRead(id: number) {
    db.prepare("UPDATE notifications SET read = 1 WHERE id = ?").run(id);
    return { success: true };
  }

  function markAllAsRead() {
    db.prepare("UPDATE notifications SET read = 1 WHERE read = 0").run();
    return { success: true };
  }

  function getUnreadCount() {
    const row = db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as { count: number };
    return row.count;
  }

  return { getTarget, updateTarget, checkProfit, getRevenueSummary, createNotification, listNotifications, markAsRead, markAllAsRead, getUnreadCount };
}
