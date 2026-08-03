import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedTestProduct, seedTestUser } from "./test-helper.js";
import type { SqliteAdapter } from "./db/sqlite.js";
import { saleService } from "./services/saleService.js";

vi.mock("../socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
}));

describe("saleService", () => {
  let db: SqliteAdapter;
  let service: ReturnType<typeof saleService>;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
    service = saleService(db);
  });

  describe("create", () => {
    it("creates a sale and decrements stock", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 15, stock: 50 });

      const result = await service.create(user.id, [{ product_id: product.id, quantity: 2 }]);
      expect(result.sale).toBeDefined();
      expect(result.sale.id).toBeGreaterThan(0);
      expect(result.sale.items).toHaveLength(1);
      expect(result.sale.items[0].unit_price).toBe(15);
      expect(result.sale.items[0].original_price).toBe(15);
      expect(result.sale.items[0].discount_id).toBeNull();

      const updated = await db.get("SELECT stock FROM products WHERE id = ?", [product.id]) as any;
      expect(updated.stock).toBe(48);
    });

    it("applies active discount when creating sale", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 20, stock: 50 });
      const today = new Date().toISOString().slice(0, 10);

      await db.run(
        "INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date, status) VALUES (?, ?, ?, ?, 'active')",
        [product.id, 15, today, today]
      );

      const result = await service.create(user.id, [{ product_id: product.id, quantity: 3 }]);
      expect(result.sale.items[0].unit_price).toBe(15);
      expect(result.sale.items[0].original_price).toBe(20);
      expect(result.sale.items[0].discount_id).not.toBeNull();
    });

    it("uses normal price if discount exists but out of range", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 20, stock: 50 });

      await db.run(
        "INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date, status) VALUES (?, ?, ?, ?, 'active')",
        [product.id, 15, "2025-01-01", "2025-01-31"]
      );

      const result = await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);
      expect(result.sale.items[0].unit_price).toBe(20);
      expect(result.sale.items[0].discount_id).toBeNull();
    });

    it("rejects insufficient stock", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { stock: 3 });

      await expect(
        service.create(user.id, [{ product_id: product.id, quantity: 10 }])
      ).rejects.toThrow("Insufficient stock");
    });

    it("rejects selling discontinued product", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { stock: 10, status: "discontinued" });

      await expect(
        service.create(user.id, [{ product_id: product.id, quantity: 1 }])
      ).rejects.toThrow("Cannot sell discontinued product");
    });

    it("rejects non-existent product", async () => {
      const user = await seedTestUser(db);

      await expect(
        service.create(user.id, [{ product_id: 999, quantity: 1 }])
      ).rejects.toThrow("Product not found");
    });

    it("handles multiple items in one sale", async () => {
      const user = await seedTestUser(db);
      const p1 = await seedTestProduct(db, { sku: "P1", sell_price: 10, stock: 20 });
      const p2 = await seedTestProduct(db, { sku: "P2", name: "Other", sell_price: 25, stock: 15 });

      const result = await service.create(user.id, [
        { product_id: p1.id, quantity: 2 },
        { product_id: p2.id, quantity: 1 },
      ]);

      expect(result.sale.items).toHaveLength(2);
      expect(result.sale.total).toBe(45); // 20 + 25
    });
  });

  describe("list", () => {
    it("returns paginated sales for admin", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 10, stock: 100 });

      await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);
      await service.create(user.id, [{ product_id: product.id, quantity: 2 }]);

      const result = await service.list({
        page: 1, limit: 1, isAdmin: true, requesterId: user.id,
      });

      expect(result.sales).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it("filters by user for admin", async () => {
      const admin = await seedTestUser(db, { username: "admin", role: "admin" });
      const user2 = await seedTestUser(db, { username: "seller", role: "user" });
      const product = await seedTestProduct(db, { sell_price: 10, stock: 100 });

      await service.create(admin.id, [{ product_id: product.id, quantity: 1 }]);
      await service.create(user2.id, [{ product_id: product.id, quantity: 2 }]);

      const result = await service.list({
        page: 1, limit: 100, isAdmin: true, requesterId: admin.id, userId: user2.id,
      });

      expect(result.sales).toHaveLength(1);
      result.sales.forEach((s: any) => expect(s.user_id).toBe(user2.id));
    });

    it("non-admin can only see own sales", async () => {
      const user = await seedTestUser(db, { username: "seller1", role: "user" });
      const user2 = await seedTestUser(db, { username: "seller2", role: "user" });
      const product = await seedTestProduct(db, { sell_price: 10, stock: 100 });

      await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);
      await service.create(user2.id, [{ product_id: product.id, quantity: 2 }]);

      const result = await service.list({
        page: 1, limit: 100, isAdmin: false, requesterId: user.id,
      });

      expect(result.sales).toHaveLength(1);
      expect(result.sales[0].user_id).toBe(user.id);
    });

    it("filters by date range", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 10, stock: 100 });

      await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);

      const result = await service.list({
        page: 1, limit: 100, isAdmin: true, requesterId: user.id,
        dateFrom: "2099-01-01",
      });

      expect(result.sales).toHaveLength(0);
    });
  });

  describe("getById", () => {
    it("returns sale with items", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 15, stock: 50 });

      const created = await service.create(user.id, [{ product_id: product.id, quantity: 2 }]);

      const result = await service.getById(created.sale.id, user.id, true);
      expect(result.sale!.id).toBe(created.sale.id);
      expect(result.sale!.items).toHaveLength(1);
      expect(result.sale!.seller_name).toBeDefined();
    });

    it("non-admin can access own sale", async () => {
      const user = await seedTestUser(db, { username: "seller", role: "user" });
      const product = await seedTestProduct(db, { sell_price: 15, stock: 50 });

      const created = await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);
      const result = await service.getById(created.sale.id, user.id, false);
      expect(result.sale!.id).toBe(created.sale.id);
    });

    it("non-admin cannot access another's sale", async () => {
      const user = await seedTestUser(db, { username: "seller1", role: "user" });
      const other = await seedTestUser(db, { username: "seller2", role: "user" });
      const product = await seedTestProduct(db, { sell_price: 15, stock: 50 });

      const created = await service.create(user.id, [{ product_id: product.id, quantity: 1 }]);

      await expect(
        service.getById(created.sale.id, other.id, false)
      ).rejects.toThrow("Insufficient permissions");
    });

    it("throws 404 for non-existent sale", async () => {
      const user = await seedTestUser(db);

      await expect(
        service.getById(999, user.id, true)
      ).rejects.toThrow("Sale not found");
    });
  });

  describe("remove", () => {
    it("deletes sale and restores stock", async () => {
      const user = await seedTestUser(db);
      const product = await seedTestProduct(db, { sell_price: 15, stock: 50 });

      const created = await service.create(user.id, [{ product_id: product.id, quantity: 3 }]);
      expect((await db.get("SELECT stock FROM products WHERE id = ?", [product.id]) as any).stock).toBe(47);

      await service.remove(created.sale.id);

      expect((await db.get("SELECT stock FROM products WHERE id = ?", [product.id]) as any).stock).toBe(50);

      const gone = await db.get("SELECT * FROM sales WHERE id = ?", [created.sale.id]);
      expect(gone).toBeUndefined();
    });
  });
});
