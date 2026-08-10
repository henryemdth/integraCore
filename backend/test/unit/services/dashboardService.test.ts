import { describe, it, expect } from "vitest";
import { createTestDb, seedTestUser, seedTestProduct, seedTestSale } from "../../helpers/test-helper.js";
import { dashboardService } from "../../../src/services/dashboardService.js";

describe("dashboardService", () => {
  it("getSummary returns totals for seeded data (booleans bind on SQLite)", async () => {
    const { db } = createTestDb();
    await seedTestUser(db, { username: "admin", role: "admin" });
    await seedTestUser(db, { username: "inactive", role: "user", active: 0 });
    const product = await seedTestProduct(db);
    await seedTestSale(db, 1, product.id, 2);

    const summary = await dashboardService(db).getSummary();

    expect(summary.totalProducts).toBe(1);
    expect(summary.totalUsers).toBe(1); // inactive excluded via `active = ?` [true]
    expect(summary.totalSalesToday).toBe(1);
    expect(summary.revenueToday).toBe(30);
    expect(summary.revenueThisMonth).toBe(30);
    expect(summary.recentSales).toHaveLength(1);
    expect(summary.recentSales[0].seller_name).toBe("Admin User");
  });

  it("low stock counts only active products", async () => {
    const { db } = createTestDb();
    await seedTestProduct(db, { sku: "LOW-1", stock: 2, status: "active" });
    await seedTestProduct(db, { sku: "DIS-1", stock: 0, status: "discontinued" });

    const summary = await dashboardService(db).getSummary();

    expect(summary.lowStockCount).toBe(1);
  });
});
