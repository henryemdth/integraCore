import { vi, describe, beforeAll, it, expect } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Must be set before config (and thus app.js) is imported.
vi.stubEnv("DB_DRIVER", "sqlite");
vi.stubEnv("DB_PATH", ":memory:");

const { createApp } = await import("../../src/app.js");
const { initDatabase, getAdapter } = await import("../../src/db/index.js");
const { seedTestUser, seedTestProduct } = await import("../helpers/test-helper.js");
const { todayDateString, nextDayDateString } = await import("@integracore/shared");

let app: Express;
let adminToken: string;

beforeAll(async () => {
  await initDatabase();
  await seedTestUser(getAdapter(), { username: "admin", password: "password123" });

  const { authService } = await import("../../src/services/authService.js");
  const login = await authService(getAdapter()).login("admin", "password123");
  adminToken = login.token;

  app = createApp();
});

const auth = () => ({ Authorization: `Bearer ${adminToken}` });
const today = todayDateString();
const tomorrow = nextDayDateString(today);
const in4days = nextDayDateString(nextDayDateString(nextDayDateString(today)));

const createDiscount = (productId: number, body: Record<string, unknown>) =>
  request(app)
    .post(`/api/products/${productId}/discounts`)
    .set(auth())
    .send(body);

const createSale = (items: { product_id: number; quantity: number }[]) =>
  request(app).post("/api/sales").set(auth()).send({ items });

const getProduct = async (productId: number) => {
  const res = await request(app).get("/api/products?limit=100").set(auth());
  expect(res.status).toBe(200);
  return res.body.products.find((p: any) => p.id === productId);
};

const listDiscounts = async () => {
  const res = await request(app).get("/api/discounts").set(auth());
  expect(res.status).toBe(200);
  return res.body.discounts as any[];
};

describe("discount lifecycle e2e (create → sale → cancel → recreate)", () => {
  let productId: number;
  let d1Id: number;
  let firstSaleId: number;

  it("applies the discount to the product and freezes discounted fields into the sale", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-LC-1", sell_price: 15, stock: 50 });
    productId = product.id;

    const res = await createDiscount(productId, { discounted_price: 12, start_date: today, end_date: today });
    expect(res.status).toBe(201);
    d1Id = res.body.discount.id;

    const p = await getProduct(productId);
    expect(p.discounted_price).toBe(12);
    expect(p.discount_end_date).toContain(today);

    const sale = await createSale([{ product_id: productId, quantity: 2 }]);
    expect(sale.status).toBe(201);
    firstSaleId = sale.body.sale.id;
    const item = sale.body.sale.items[0];
    expect(item.unit_price).toBe(12);
    expect(item.original_price).toBe(15);
    expect(item.discount_id).toBe(d1Id);
    expect(item.subtotal).toBe(24);
    expect(sale.body.sale.total).toBe(24);
  });

  it("clears the product effective price after cancelling", async () => {
    const res = await request(app).patch(`/api/discounts/${d1Id}/cancel`).set(auth());
    expect(res.status).toBe(200);

    const p = await getProduct(productId);
    expect(p.discounted_price).toBeNull();
    expect(p.discount_end_date).toBeNull();
  });

  it("keeps the historical sale frozen after the cancel", async () => {
    const res = await request(app).get(`/api/sales/${firstSaleId}`).set(auth());
    expect(res.status).toBe(200);
    const item = res.body.sale.items[0];
    expect(item.unit_price).toBe(12);
    expect(item.original_price).toBe(15);
    expect(item.discount_id).toBe(d1Id);
  });

  it("reports units sold on the discount history", async () => {
    const discounts = await listDiscounts();
    const d1 = discounts.find((d) => d.id === d1Id);
    expect(d1.status).toBe("cancelled");
    expect(d1.units_sold).toBe(2);
  });

  it("allows recreating a discount over the same cancelled range and applies it (reported issue)", async () => {
    // The first discount was cancelled AFTER it had sales — its range must be reusable.
    const res = await createDiscount(productId, { discounted_price: 13, start_date: today, end_date: today });
    expect(res.status).toBe(201);
    const d2Id = res.body.discount.id;
    expect(d2Id).not.toBe(d1Id);

    const p = await getProduct(productId);
    expect(p.discounted_price).toBe(13);

    // A new sale uses the new discount; the old sale keeps referencing the old one.
    const sale = await createSale([{ product_id: productId, quantity: 1 }]);
    expect(sale.body.sale.items[0].unit_price).toBe(13);
    expect(sale.body.sale.items[0].discount_id).toBe(d2Id);

    const old = await request(app).get(`/api/sales/${firstSaleId}`).set(auth());
    expect(old.body.sale.items[0].unit_price).toBe(12);
    expect(old.body.sale.items[0].discount_id).toBe(d1Id);
  });
});

describe("overlap boundaries", () => {
  it("blocks an overlapping creation while a discount is active", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-OV-1", sell_price: 20 });
    await createDiscount(product.id, { discounted_price: 18, start_date: today, end_date: today });

    const res = await createDiscount(product.id, { discounted_price: 17, start_date: today, end_date: today });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DISCOUNT_OVERLAP");
    expect(res.body.error).toMatch(/active discount/);
  });

  it("blocks same-day adjacency (inclusive ends)", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-OV-2", sell_price: 20 });
    await createDiscount(product.id, { discounted_price: 18, start_date: today, end_date: tomorrow });

    // Starts on the day the active discount ends — inclusive boundary conflicts.
    const res = await createDiscount(product.id, { discounted_price: 17, start_date: tomorrow, end_date: in4days });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DISCOUNT_OVERLAP");
  });

  it("allows starting the day after the range ends", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-OV-3", sell_price: 20 });
    await createDiscount(product.id, { discounted_price: 18, start_date: today, end_date: today });

    const res = await createDiscount(product.id, { discounted_price: 17, start_date: tomorrow, end_date: in4days });
    expect(res.status).toBe(201);
  });
});

describe("creation validation edges", () => {
  it("rejects a discounted price at or above the sell price", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-V1", sell_price: 15 });
    const res = await createDiscount(product.id, { discounted_price: 15, start_date: today, end_date: today });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DISCOUNT_PRICE_ABOVE_SELL");
  });

  it("rejects discounts for discontinued products", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-V2", status: "discontinued" });
    const res = await createDiscount(product.id, { discounted_price: 10, start_date: today, end_date: today });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DISCOUNT_DISCONTINUED");
  });

  it("rejects discounts for unknown products", async () => {
    const res = await createDiscount(99999, { discounted_price: 10, start_date: today, end_date: today });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("rejects an end date before the start date", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-V3", sell_price: 15 });
    const res = await createDiscount(product.id, { discounted_price: 10, start_date: in4days, end_date: today });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
  });

  it("rejects cancelling an already cancelled discount", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-V4", sell_price: 15 });
    const created = await createDiscount(product.id, { discounted_price: 10, start_date: today, end_date: today });
    await request(app).patch(`/api/discounts/${created.body.discount.id}/cancel`).set(auth());

    const res = await request(app).patch(`/api/discounts/${created.body.discount.id}/cancel`).set(auth());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("DISCOUNT_ALREADY_CANCELLED");
  });
});

describe("delete rules", () => {
  it("deletes a discount without sales and clears the effective price", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-D1", sell_price: 15 });
    const created = await createDiscount(product.id, { discounted_price: 10, start_date: today, end_date: today });
    expect((await getProduct(product.id)).discounted_price).toBe(10);

    const res = await request(app).delete(`/api/discounts/${created.body.discount.id}`).set(auth());
    expect(res.status).toBe(200);
    expect((await getProduct(product.id)).discounted_price).toBeNull();
  });

  it("blocks deleting a discount that already has sales", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-D2", sell_price: 15 });
    const created = await createDiscount(product.id, { discounted_price: 10, start_date: today, end_date: today });
    await createSale([{ product_id: product.id, quantity: 1 }]);

    const res = await request(app).delete(`/api/discounts/${created.body.discount.id}`).set(auth());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DISCOUNT_HAS_SALES");

    // Still in the history — the sale references it.
    const discounts = await listDiscounts();
    expect(discounts.find((d) => d.id === created.body.discount.id)).toBeDefined();
  });
});

describe("scheduled (future) discount", () => {
  it("does not affect today's price or sales before it starts", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-SC-1", sell_price: 25, stock: 30 });

    const res = await createDiscount(product.id, { discounted_price: 19, start_date: tomorrow, end_date: in4days });
    expect(res.status).toBe(201);

    const p = await getProduct(product.id);
    expect(p.discounted_price).toBeNull();

    const sale = await createSale([{ product_id: product.id, quantity: 1 }]);
    expect(sale.body.sale.items[0].unit_price).toBe(25);
    expect(sale.body.sale.items[0].original_price).toBe(25);
    expect(sale.body.sale.items[0].discount_id).toBeNull();
  });
});

describe("mixed sale with discounted and non-discounted products", () => {
  it("resolves each line item independently", async () => {
    const discounted = await seedTestProduct(getAdapter(), { sku: "E2E-MX-1", sell_price: 15, stock: 20 });
    const normal = await seedTestProduct(getAdapter(), { sku: "E2E-MX-2", sell_price: 30, stock: 20 });
    await createDiscount(discounted.id, { discounted_price: 10, start_date: today, end_date: today });

    const sale = await createSale([
      { product_id: discounted.id, quantity: 2 },
      { product_id: normal.id, quantity: 1 },
    ]);
    expect(sale.status).toBe(201);

    const [a, b] = sale.body.sale.items;
    expect(a.unit_price).toBe(10);
    expect(a.original_price).toBe(15);
    expect(a.discount_id).not.toBeNull();
    expect(b.unit_price).toBe(30);
    expect(b.original_price).toBe(30);
    expect(b.discount_id).toBeNull();
    expect(sale.body.sale.total).toBe(50);
  });

  it("aggregates units sold across multiple sales on the same discount", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "E2E-MX-3", sell_price: 15, stock: 50 });
    const created = await createDiscount(product.id, { discounted_price: 11, start_date: today, end_date: today });

    await createSale([{ product_id: product.id, quantity: 2 }]);
    await createSale([{ product_id: product.id, quantity: 3 }]);

    const discounts = await listDiscounts();
    const d = discounts.find((x) => x.id === created.body.discount.id);
    expect(d.units_sold).toBe(5);
  });
});
