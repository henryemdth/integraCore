import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./db/schema.js";

describe("schema migrations", () => {
  it("backfills legacy date-only discount ranges to full-day timestamps", () => {
    const raw = new Database(":memory:");
    runMigrations(raw);
    raw.prepare(
      "INSERT INTO products (name, sku, price, sell_price, stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("Widget", "W-1", 10, 15, 50, 5);
    raw.prepare(
      "INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date) VALUES (?, ?, ?, ?)"
    ).run(1, 10, "2026-08-03", "2026-08-10");

    runMigrations(raw);

    const row = raw.prepare("SELECT start_date, end_date FROM product_discounts WHERE id = 1").get() as any;
    expect(row.start_date).toBe("2026-08-03 00:00:00.000");
    expect(row.end_date).toBe("2026-08-10 23:59:59.999");
  });

  it("backfill is idempotent across restarts", () => {
    const raw = new Database(":memory:");
    runMigrations(raw);
    raw.prepare(
      "INSERT INTO products (name, sku, price, sell_price, stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("Widget", "W-1", 10, 15, 50, 5);
    raw.prepare(
      "INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date) VALUES (?, ?, ?, ?)"
    ).run(1, 10, "2026-08-03", "2026-08-10");

    runMigrations(raw);
    runMigrations(raw);

    const row = raw.prepare("SELECT start_date, end_date FROM product_discounts WHERE id = 1").get() as any;
    expect(row.start_date).toBe("2026-08-03 00:00:00.000");
    expect(row.end_date).toBe("2026-08-10 23:59:59.999");
  });
});
