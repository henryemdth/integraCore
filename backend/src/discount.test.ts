import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedTestProduct } from "./test-helper.js";
import type { SqliteAdapter } from "./db/sqlite.js";
import { discountService } from "./services/discountService.js";
import { todayDateString, nextDayDateString } from "@integracore/shared";

vi.mock("../socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
}));

describe("discountService", () => {
  let db: SqliteAdapter;
  let service: ReturnType<typeof discountService>;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
    service = discountService(db);
  });

  describe("create", () => {
    it("creates a discount for an active product", async () => {
      const product = await seedTestProduct(db);

      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
        reason: "Test promotion",
      });

      expect(discount).toBeDefined();
      expect(discount.id).toBeGreaterThan(0);
      expect(discount.discounted_price).toBe(10);
      expect(discount.status).toBe("active");
      expect(discount.product_id).toBe(product.id);
    });

    it("rejects discount for discontinued product", async () => {
      const product = await seedTestProduct(db, { status: "discontinued" });

      await expect(service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      })).rejects.toThrow("Cannot create discounts for discontinued products");
    });

    it("rejects discount with price >= sell_price", async () => {
      const product = await seedTestProduct(db, { sell_price: 15 });

      await expect(service.create(product.id, {
        discounted_price: 15,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      })).rejects.toThrow("Discounted price must be less than sell price");

      await expect(service.create(product.id, {
        discounted_price: 20,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      })).rejects.toThrow("Discounted price must be less than sell price");
    });

    it("rejects overlapping discount dates for same product", async () => {
      const product = await seedTestProduct(db);

      await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      await expect(service.create(product.id, {
        discounted_price: 12,
        start_date: "2026-01-15",
        end_date: "2026-02-15",
      })).rejects.toThrow("Discount date range overlaps");
    });

    it("allows overlapping dates for different products", async () => {
      const p1 = await seedTestProduct(db, { sku: "P1" });
      const p2 = await seedTestProduct(db, { sku: "P2", name: "Other" });

      const d1 = await service.create(p1.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      const d2 = await service.create(p2.id, {
        discounted_price: 12,
        start_date: "2026-01-15",
        end_date: "2026-02-15",
      });

      expect(d1.id).toBeGreaterThan(0);
      expect(d2.id).toBeGreaterThan(0);
    });

    it("allows overlap with cancelled discount that has no sales", async () => {
      const product = await seedTestProduct(db);

      const d1 = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      await service.cancel(d1.id);

      const d2 = await service.create(product.id, {
        discounted_price: 12,
        start_date: "2026-01-15",
        end_date: "2026-02-15",
      });

      expect(d2.id).toBeGreaterThan(0);
    });

    it("rejects if product does not exist", async () => {
      await expect(service.create(999, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      })).rejects.toThrow("Product not found");
    });
  });

  describe("cancel", () => {
    it("cancels an active discount", async () => {
      const product = await seedTestProduct(db);
      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      const result = await service.cancel(discount.id);
      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);

      const updated = await db.get("SELECT * FROM product_discounts WHERE id = ?", [discount.id]) as any;
      expect(updated.status).toBe("cancelled");
    });

    it("rejects cancelling already cancelled discount", async () => {
      const product = await seedTestProduct(db);
      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });
      await service.cancel(discount.id);

      await expect(service.cancel(discount.id)).rejects.toThrow("already cancelled");
    });

    it("rejects cancelling non-existent discount", async () => {
      await expect(service.cancel(999)).rejects.toThrow("Discount not found");
    });
  });

  describe("remove", () => {
    it("deletes discount with no sales", async () => {
      const product = await seedTestProduct(db);
      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      const result = await service.remove(discount.id);
      expect(result.success).toBe(true);

      const found = await db.get("SELECT * FROM product_discounts WHERE id = ?", [discount.id]);
      expect(found).toBeUndefined();
    });
  });

  describe("list / getActive", () => {
    it("lists all discounts for a product", async () => {
      const product = await seedTestProduct(db);

      await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });
      await service.create(product.id, {
        discounted_price: 12,
        start_date: "2026-03-01",
        end_date: "2026-03-31",
      });

      const list = await service.list(product.id);
      expect(list).toHaveLength(2);
    });

    it("getActive returns undefined when no active discount", async () => {
      const product = await seedTestProduct(db);
      await service.create(product.id, {
        discounted_price: 10,
        start_date: "2025-01-01",
        end_date: "2025-01-31",
      });

      const active = await service.getActive(product.id);
      expect(active).toBeUndefined();
    });

    it("getActive returns discount when active today", async () => {
      const product = await seedTestProduct(db);
      const today = todayDateString();
      await service.create(product.id, {
        discounted_price: 10,
        start_date: today,
        end_date: today,
      });

      const active = await service.getActive(product.id);
      expect(active).toBeDefined();
      expect(active!.id).toBeGreaterThan(0);
    });

    it("stores start and end dates as full-day timestamps", async () => {
      const product = await seedTestProduct(db);
      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-08-10",
        end_date: "2026-08-20",
      });

      expect(discount.start_date).toBe("2026-08-10 00:00:00.000");
      expect(discount.end_date).toBe("2026-08-20 23:59:59.999");
    });

    it("getActive ignores cancelled discount even within date range", async () => {
      const product = await seedTestProduct(db);
      const today = todayDateString();
      const discount = await service.create(product.id, {
        discounted_price: 10,
        start_date: today,
        end_date: today,
      });

      await service.cancel(discount.id);

      const active = await service.getActive(product.id);
      expect(active).toBeUndefined();
    });

    it("getActive returns undefined for scheduled (future) discount", async () => {
      const product = await seedTestProduct(db);
      const tomorrow = nextDayDateString(todayDateString());
      await service.create(product.id, {
        discounted_price: 10,
        start_date: tomorrow,
        end_date: tomorrow,
      });

      const active = await service.getActive(product.id);
      expect(active).toBeUndefined();
    });
  });

  describe("listAll", () => {
    it("returns all discounts with product info and units sold", async () => {
      const p1 = await seedTestProduct(db, { sku: "P1" });
      const p2 = await seedTestProduct(db, { sku: "P2", name: "Other" });

      await service.create(p1.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });
      await service.create(p2.id, {
        discounted_price: 12,
        start_date: "2026-02-01",
        end_date: "2026-02-28",
      });

      const all = await service.listAll();
      expect(all).toHaveLength(2);
      expect(all[0].product_name).toBeDefined();
      expect(all[0].product_sku).toBeDefined();
    });
  });

  describe("overlap (inclusive boundaries)", () => {
    it("rejects discount starting on the same day an active one ends", async () => {
      const product = await seedTestProduct(db);

      await service.create(product.id, {
        discounted_price: 10,
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      await expect(service.create(product.id, {
        discounted_price: 12,
        start_date: "2026-01-31",
        end_date: "2026-02-15",
      })).rejects.toThrow("Discount date range overlaps");
    });
  });

  describe("checkDateTriggers", () => {
    it("reports discount starting today as activated and one ending today as expired", async () => {
      const p1 = await seedTestProduct(db, { sku: "P1" });
      const p2 = await seedTestProduct(db, { sku: "P2", name: "Other" });
      const today = todayDateString();

      await service.create(p1.id, { discounted_price: 10, start_date: today, end_date: today });
      await service.create(p2.id, { discounted_price: 12, start_date: today, end_date: today });

      const result = await service.checkDateTriggers();
      expect(result.activated).toBeGreaterThanOrEqual(1);
      expect(result.expired).toBeGreaterThanOrEqual(1);
    });

    it("does not report discounts outside today as activated", async () => {
      const product = await seedTestProduct(db);
      const tomorrow = nextDayDateString(todayDateString());

      await service.create(product.id, { discounted_price: 10, start_date: "2000-01-01", end_date: tomorrow });

      const result = await service.checkDateTriggers();
      expect(result.activated).toBe(0);
      expect(result.expired).toBe(0);
    });
  });
});
