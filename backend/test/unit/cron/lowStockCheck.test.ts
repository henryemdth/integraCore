import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedTestProduct } from "../../helpers/test-helper.js";
import type { SqliteAdapter } from "../../../src/db/sqlite.js";
import { runLowStockCheck } from "../../../src/cron/lowStockCheck.js";
import { nextDayDateString, startOfDay, todayDateString } from "@integracore/shared";

vi.mock("../../../src/socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
}));

describe("runLowStockCheck", () => {
  let db: SqliteAdapter;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
  });

  it("creates no notification when nothing is below threshold", async () => {
    await seedTestProduct(db, { name: "Healthy", stock: 50, low_stock_threshold: 5 });

    await runLowStockCheck(db);

    const notifications = await db.all("SELECT * FROM notifications");
    expect(notifications).toHaveLength(0);
  });

  it("creates one notification listing low-stock product names", async () => {
    await seedTestProduct(db, { name: "Widget", sku: "L-1", stock: 2, low_stock_threshold: 5 });
    await seedTestProduct(db, { name: "Gadget", sku: "L-2", stock: 0, low_stock_threshold: 5 });
    await seedTestProduct(db, { name: "Healthy", sku: "L-3", stock: 50, low_stock_threshold: 5 });

    await runLowStockCheck(db);

    const notifications = await db.all<{ type: string; message: string }>(
      "SELECT * FROM notifications"
    );
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("low_stock");
    expect(notifications[0].message).toContain("2 product(s) below threshold");
    expect(notifications[0].message).toContain("Widget");
    expect(notifications[0].message).toContain("Gadget");
    expect(notifications[0].message).not.toContain("Healthy");
  });

  it("caps the name list at 5 and adds a +N more suffix", async () => {
    for (let i = 1; i <= 7; i++) {
      await seedTestProduct(db, {
        name: `Low-${i}`,
        sku: `L-${i}`,
        stock: 0,
        low_stock_threshold: 1,
      });
    }

    await runLowStockCheck(db);

    const notifications = await db.all<{ message: string }>("SELECT * FROM notifications");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("Low-1");
    expect(notifications[0].message).toContain("Low-5");
    expect(notifications[0].message).not.toContain("Low-6");
    expect(notifications[0].message).toContain("(+2 more)");
  });

  it("deduplicates: only one alert per day", async () => {
    await seedTestProduct(db, { name: "Widget", sku: "L-1", stock: 2, low_stock_threshold: 5 });

    await runLowStockCheck(db);
    await runLowStockCheck(db);

    const notifications = await db.all("SELECT * FROM notifications");
    expect(notifications).toHaveLength(1);
  });

  it("ignores discontinued products sitting at zero stock", async () => {
    await seedTestProduct(db, {
      name: "Old",
      stock: 0,
      low_stock_threshold: 1,
      status: "discontinued",
    });

    await runLowStockCheck(db);

    const notifications = await db.all("SELECT * FROM notifications");
    expect(notifications).toHaveLength(0);
  });

  it("matches against today's date for the one-per-day rule", async () => {
    await seedTestProduct(db, { name: "Widget", sku: "L-1", stock: 2, low_stock_threshold: 5 });

    await runLowStockCheck(db);

    const existing = await db.get(
      "SELECT 1 FROM notifications WHERE type = 'low_stock' AND created_at >= ? AND created_at < ? LIMIT 1",
      [startOfDay(todayDateString()), startOfDay(nextDayDateString(todayDateString()))]
    );
    expect(existing).toBeDefined();
  });
});
