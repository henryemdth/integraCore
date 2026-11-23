import { DatabaseAdapter } from "../db/adapter.js";
import { productService } from "./productService.js";

export function dashboardService(db: DatabaseAdapter) {
  // Bound once per service lifetime (the service itself is a singleton) —
  // getSummary must not re-allocate it on every dashboard request.
  const products = productService(db);

  async function getSummary(requester: { isAdmin: boolean; requesterId: number } = { isAdmin: true, requesterId: 0 }) {
    const { isAdmin, requesterId } = requester;

    const productRow = await db.get<{ total: number | string }>(
      "SELECT COUNT(*) as total FROM products"
    );
    const totalProducts = Number(productRow?.total ?? 0);

    // Same predicate as the low-stock alerts, so the dashboard count can never
    // diverge from what the alerts report.
    const lowStockCount = (await products.listLowStock()).length;

    // sales.created_at is stored in UTC (datetime('now') default), but the
    // dashboard counts "today" and "this month" in local wall-clock terms.
    // Compute the UTC instants of local boundaries so late-evening sales land
    // on the correct day/month.
    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const localMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const localNextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const fmtUtc = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
    const dayStart = fmtUtc(localMidnight);
    const tomorrowStart = fmtUtc(new Date(localMidnight.getTime() + 86400000));
    const monthStart = fmtUtc(localMonthStart);
    const nextMonthStart = fmtUtc(localNextMonthStart);

    const userFilterSql = isAdmin ? "" : " AND user_id = ?";
    const userFilterParams = isAdmin ? [] : [requesterId];

    const todaySalesRow = await db.get<{ total: number | string; revenue: number | string }>(
      `SELECT COUNT(*) as total, COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE created_at >= ? AND created_at < ?${userFilterSql}`,
      [dayStart, tomorrowStart, ...userFilterParams]
    );
    const totalSalesToday = Number(todaySalesRow?.total ?? 0);
    const revenueToday = Number(todaySalesRow?.revenue ?? 0);

    const monthRevenueRow = await db.get<{ revenue: number | string }>(
      `SELECT COALESCE(SUM(total), 0) as revenue
       FROM sales
       WHERE created_at >= ? AND created_at < ?${userFilterSql}`,
      [monthStart, nextMonthStart, ...userFilterParams]
    );
    const revenueThisMonth = Number(monthRevenueRow?.revenue ?? 0);

    // Profit targets and total user count are admin-only business data.
    let targetAmount = 0;
    let targetPercentage = 0;
    let totalUsers = 0;
    let profitThisMonth = 0;

    if (isAdmin) {
      const monthProfitRow = await db.get<{ profit: number | string }>(
        `SELECT COALESCE(SUM((si.unit_price - COALESCE(si.cost_price, p.price, 0)) * si.quantity), 0) as profit
         FROM sale_items si
         JOIN sales s ON si.sale_id = s.id
         JOIN products p ON p.id = si.product_id
         WHERE s.created_at >= ? AND s.created_at < ?`,
        [monthStart, nextMonthStart]
      );
      profitThisMonth = Number(monthProfitRow?.profit ?? 0);

      const targetRow = await db.get<{ target_amount: number | string; period_days: number }>(
        "SELECT target_amount, period_days FROM profit_targets ORDER BY id DESC LIMIT 1"
      );
      targetAmount = Number(targetRow?.target_amount ?? 0);
      targetPercentage = targetAmount > 0 ? Math.min(Math.max(Math.round((profitThisMonth / targetAmount) * 100), 0), 999) : 0;

      const usersRow = await db.get<{ total: number | string }>(
        "SELECT COUNT(*) as total FROM users WHERE active = ?",
        [true]
      );
      totalUsers = Number(usersRow?.total ?? 0);
    }

    const recentSalesSql = isAdmin
      ? `SELECT s.id, s.total, u.full_name as seller_name, s.created_at
         FROM sales s
         JOIN users u ON s.user_id = u.id
         ORDER BY s.created_at DESC
         LIMIT 5`
      : `SELECT s.id, s.total, u.full_name as seller_name, s.created_at
         FROM sales s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC
         LIMIT 5`;
    const recentSales = await db.all<{ id: number; total: number; seller_name: string; created_at: string }>(
      recentSalesSql,
      isAdmin ? [] : [requesterId]
    );

    return {
      totalProducts,
      lowStockCount,
      totalSalesToday,
      revenueToday,
      revenueThisMonth,
      profitThisMonth: isAdmin ? profitThisMonth : null,
      targetAmount,
      targetPercentage,
      totalUsers,
      recentSales,
    };
  }

  return { getSummary };
}
