import { DatabaseAdapter } from "../db/adapter.js";

export function dashboardService(db: DatabaseAdapter) {
  async function getSummary() {
    const productRow = await db.get<{ total: number }>(
      "SELECT COUNT(*) as total FROM products"
    );
    const totalProducts = productRow?.total ?? 0;

    const lowStockRow = await db.get<{ total: number }>(
      "SELECT COUNT(*) as total FROM products WHERE stock <= low_stock_threshold AND status = 'active'"
    );
    const lowStockCount = lowStockRow?.total ?? 0;

    // sales.created_at is stored in UTC (datetime('now') default), but the
    // dashboard counts "today" in local wall-clock terms. Compute the UTC
    // instants of local midnight boundaries so late-evening sales (e.g. local
    // 22:00 in a UTC-4 timezone) land on the correct day. String params keep
    // this driver-agnostic (Neon/Postgres default session TZ is UTC).
    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmtUtc = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const dayStart = fmtUtc(localMidnight);
    const tomorrowStart = fmtUtc(new Date(localMidnight.getTime() + 86400000));

    const todaySalesRow = await db.get<{ total: number; revenue: number }>(
      `SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE created_at >= ? AND created_at < ?`,
      [dayStart, tomorrowStart]
    );
    const totalSalesToday = todaySalesRow?.total ?? 0;
    const revenueToday = todaySalesRow?.revenue ?? 0;

    const monthRevenueRow = await db.get<{ revenue: number }>(
      `SELECT COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`
    );
    const revenueThisMonth = monthRevenueRow?.revenue ?? 0;

    const targetRow = await db.get<{ target_amount: number; period_days: number }>(
      "SELECT target_amount, period_days FROM profit_targets ORDER BY id DESC LIMIT 1"
    );
    const targetAmount = targetRow?.target_amount ?? 0;
    const targetPercentage = targetAmount > 0 ? Math.min(Math.round((revenueThisMonth / targetAmount) * 100), 999) : 0;

    const usersRow = await db.get<{ total: number }>(
      "SELECT COUNT(*) as total FROM users WHERE active = ?",
      [true]
    );
    const totalUsers = usersRow?.total ?? 0;

    const recentSales = await db.all<{ id: number; total: number; seller_name: string; created_at: string }>(
      `SELECT s.id, s.total, u.full_name as seller_name, s.created_at
       FROM sales s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC
       LIMIT 5`
    );

    return {
      totalProducts,
      lowStockCount,
      totalSalesToday,
      revenueToday,
      revenueThisMonth,
      targetAmount,
      targetPercentage,
      totalUsers,
      recentSales,
    };
  }

  return { getSummary };
}
