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

    const todaySalesRow = await db.get<{ total: number; revenue: number }>(
      `SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE date(created_at) = date('now')`
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
      "SELECT COUNT(*) as total FROM users WHERE active = 1"
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
