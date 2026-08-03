import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedTestProduct, seedTestUser, seedTestSale } from "./test-helper.js";
import type { SqliteAdapter } from "./db/sqlite.js";
import { productService } from "./services/productService.js";
import { discountService } from "./services/discountService.js";
import { todayDateString, nextDayDateString, startOfDay, endOfDay } from "@integracore/shared";

vi.mock("../socket/index.js", () => ({
  emitProductUpdated: vi.fn(),
  emitNotification: vi.fn(),
  emitDbRestored: vi.fn(),
}));

describe("productService", () => {
  let db: SqliteAdapter;
  let service: ReturnType<typeof productService>;

  beforeEach(() => {
    const test = createTestDb();
    db = test.db;
    service = productService(db);
  });

  describe("create", () => {
    it("creates a product", async () => {
      const product = await service.create({
        name: "Widget",
        sku: "WDG-001",
        category: "Tools",
        price: 10,
        sell_price: 15,
        stock: 100,
        low_stock_threshold: 10,
      });

      expect(product).toBeDefined();
      expect(product.id).toBeGreaterThan(0);
      expect(product.name).toBe("Widget");
      expect(product.sku).toBe("WDG-001");
      expect(product.status).toBe("active");
    });

    it("rejects duplicate SKU", async () => {
      await seedTestProduct(db, { sku: "DUP-001" });

      await expect(service.create({
        name: "Duplicate",
        sku: "DUP-001",
        category: "Test",
        price: 5,
        sell_price: 10,
        stock: 10,
        low_stock_threshold: 2,
      })).rejects.toThrow("SKU already exists");
    });

    it("allows setting status to discontinued on creation", async () => {
      const product = await service.create({
        name: "Old Widget",
        sku: "OLD-001",
        category: "Legacy",
        price: 5,
        sell_price: 8,
        stock: 0,
        low_stock_threshold: 5,
        status: "discontinued",
      });

      expect(product.status).toBe("discontinued");
    });
  });

  describe("update", () => {
    it("updates a product", async () => {
      const product = await seedTestProduct(db);

      const updated = await service.update(product.id, { name: "Updated", price: 20 });

      expect(updated.name).toBe("Updated");
      expect(updated.price).toBe(20);
    });

    it("rejects updating to duplicate SKU", async () => {
      await seedTestProduct(db, { sku: "P1" });
      const p2 = await seedTestProduct(db, { sku: "P2", name: "Other" });

      await expect(service.update(p2.id, { sku: "P1" })).rejects.toThrow("SKU already exists");
    });

    it("allows updating own SKU (no change)", async () => {
      const product = await seedTestProduct(db, { sku: "SAME" });

      const updated = await service.update(product.id, { sku: "SAME" });
      expect(updated.sku).toBe("SAME");
    });
  });

  describe("remove", () => {
    it("deletes product with no sales", async () => {
      const product = await seedTestProduct(db);

      const result = await service.remove(product.id);
      expect(result.success).toBe(true);

      const found = await db.get("SELECT * FROM products WHERE id = ?", [product.id]);
      expect(found).toBeUndefined();
    });

    it("rejects deleting product with existing sales", async () => {
      const product = await seedTestProduct(db, { stock: 100 });
      const user = await seedTestUser(db);
      await seedTestSale(db, user.id, product.id);

      await expect(service.remove(product.id)).rejects.toThrow("Cannot delete product with existing sales");
    });
  });

  describe("list", () => {
    async function seedProducts() {
      await seedTestProduct(db, { sku: "A", name: "Alpha", category: "Cat1", stock: 5 });
      await seedTestProduct(db, { sku: "B", name: "Beta", category: "Cat2", stock: 50 });
      await seedTestProduct(db, { sku: "C", name: "Gamma", category: "Cat1", stock: 10, status: "discontinued" });
    }

    it("returns paginated products", async () => {
      await seedProducts();

      const result = await service.list({ page: 1, limit: 2, search: "", category: "", status: "all", sort: "name", order: "ASC" });

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.totalPages).toBe(2);
    });

    it("filters by search term", async () => {
      await seedProducts();

      const result = await service.list({ page: 1, limit: 100, search: "beta", category: "", status: "all", sort: "name", order: "ASC" });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toBe("Beta");
    });

    it("filters by status", async () => {
      await seedProducts();

      const result = await service.list({ page: 1, limit: 100, search: "", category: "", status: "active", sort: "name", order: "ASC" });

      expect(result.products).toHaveLength(2);
      expect(result.products.every((p: any) => p.status === "active")).toBe(true);
    });

    it("filters by category", async () => {
      await seedProducts();

      const result = await service.list({ page: 1, limit: 100, search: "", category: "Cat2", status: "all", sort: "name", order: "ASC" });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].category).toBe("Cat2");
    });

    it("attaches active discount info to products", async () => {
      const product = await seedTestProduct(db, { sku: "DISC" });
      const today = todayDateString();

      await db.run(
        "INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date, status) VALUES (?, ?, ?, ?, 'active')",
        [product.id, 8, startOfDay(today), endOfDay(today)]
      );

      const result = await service.list({ page: 1, limit: 100, search: "", category: "", status: "all", sort: "name", order: "ASC" });

      const p = result.products.find((x: any) => x.id === product.id);
      expect(p.discounted_price).toBe(8);
    });

    it("does not attach a cancelled discount even within its date range", async () => {
      const product = await seedTestProduct(db, { sku: "CANCELLED" });
      const today = todayDateString();

      const created = await discountService(db).create(product.id, {
        discounted_price: 8,
        start_date: today,
        end_date: today,
      });
      await discountService(db).cancel(created.id);

      const result = await service.list({ page: 1, limit: 100, search: "", category: "", status: "all", sort: "name", order: "ASC" });

      const p = result.products.find((x: any) => x.id === product.id);
      expect(p.discounted_price).toBeNull();
      expect(p.discount_end_date).toBeNull();
    });

    it("does not attach a scheduled (future) discount", async () => {
      const product = await seedTestProduct(db, { sku: "FUTURE" });
      const tomorrow = nextDayDateString(todayDateString());

      await discountService(db).create(product.id, {
        discounted_price: 8,
        start_date: tomorrow,
        end_date: tomorrow,
      });

      const result = await service.list({ page: 1, limit: 100, search: "", category: "", status: "all", sort: "name", order: "ASC" });

      const p = result.products.find((x: any) => x.id === product.id);
      expect(p.discounted_price).toBeNull();
    });
  });

  describe("listLowStock", () => {
    it("returns active products with stock <= threshold", async () => {
      await seedTestProduct(db, { sku: "LOW", name: "Low Stock", stock: 3, low_stock_threshold: 5 });
      await seedTestProduct(db, { sku: "OK", name: "Ok Stock", stock: 50 });

      const low = await service.listLowStock() as any[];
      expect(low).toHaveLength(1);
      expect(low[0].sku).toBe("LOW");
    });

    it("excludes discontinued even with low stock", async () => {
      await seedTestProduct(db, { sku: "LOW", name: "Low Disc", stock: 0, low_stock_threshold: 5, status: "discontinued" });

      const low = await service.listLowStock() as any[];
      expect(low).toHaveLength(0);
    });
  });

  describe("getCategories", () => {
    it("returns sorted unique categories", async () => {
      await seedTestProduct(db, { sku: "A", category: "ZZZ" });
      await seedTestProduct(db, { sku: "B", name: "Other", category: "AAA" });

      const categories = await service.getCategories();
      expect(categories).toEqual(["AAA", "ZZZ"]);
    });

    it("returns empty for no categories", async () => {
      const categories = await service.getCategories();
      expect(categories).toEqual([]);
    });
  });

  describe("stockIn", () => {
    it("increases stock", async () => {
      const product = await seedTestProduct(db, { stock: 10 });

      const updated = await service.stockIn(product.id, 5);
      expect(updated.stock).toBe(15);
    });

    it("rejects non-existent product", async () => {
      await expect(service.stockIn(999, 5)).rejects.toThrow("Product not found");
    });
  });

  describe("stockOut", () => {
    it("decreases stock", async () => {
      const product = await seedTestProduct(db, { stock: 10 });

      const updated = await service.stockOut(product.id, 3);
      expect(updated.stock).toBe(7);
    });

    it("rejects insufficient stock", async () => {
      const product = await seedTestProduct(db, { stock: 2 });

      await expect(service.stockOut(product.id, 5)).rejects.toThrow("Insufficient stock");
    });
  });

  describe("importFromExcel", () => {
    it("parses and rejects missing name", async () => {
      const base64 = await buildTestExcel([
        ["Name", "SKU", "Category", "Price", "Sell Price", "Stock", "Low Stock", "Status"],
      ]);

      const result = await service.importFromExcel(base64);
      expect(result.imported).toBe(0);
    });

    it("imports valid rows and returns errors for invalid", async () => {
      const base64 = await buildTestExcel([
        ["Name", "SKU", "Category", "Price", "Sell Price", "Stock", "Low Stock", "Status"],
        ["Valid", "V-001", "Test", "10", "15", "100", "5", "active"],
        ["", "NO-NAME", "Test", "10", "15", "100", "5", "active"],
      ]);

      const result = await service.importFromExcel(base64);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it("detects duplicate SKU in file", async () => {
      const base64 = await buildTestExcel([
        ["Name", "SKU", "Category", "Price", "Sell Price", "Stock", "Low Stock", "Status"],
        ["Widget", "DUP", "Test", "10", "15", "100", "5", "active"],
        ["Gadget", "DUP", "Test", "10", "15", "100", "5", "active"],
      ]);

      const result = await service.importFromExcel(base64);
      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Duplicate SKU");
    });
  });
});

async function buildTestExcel(rows: string[][]): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  rows.forEach((r) => ws.addRow(r));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf).toString("base64");
}
