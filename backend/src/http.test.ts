import { vi, describe, beforeAll, it, expect } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Must be set before config (and thus app.js) is imported.
vi.stubEnv("DB_DRIVER", "sqlite");
vi.stubEnv("DB_PATH", ":memory:");

const { createApp } = await import("./app.js");
const { initDatabase, getAdapter } = await import("./db/index.js");
const { seedTestUser, seedTestProduct } = await import("./test-helper.js");

let app: Express;
let adminToken: string;

beforeAll(async () => {
  await initDatabase();
  await seedTestUser(getAdapter(), { username: "admin", password: "password123" });

  const { authService } = await import("./services/authService.js");
  const login = await authService(getAdapter()).login("admin", "password123");
  adminToken = login.token;

  app = createApp();
});

describe("HTTP error handling — async gap regression (FIX.md §1)", () => {
  it("GET /api/health returns 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("protected route without token returns 401", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "No token provided" });
  });

  it("invalid login returns 401 with error body (was: hang)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid credentials" });
  });

  it("non-admin cannot list users (403)", async () => {
    const { authService } = await import("./services/authService.js");

    const register = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: "seller", password: "password123", full_name: "Seller", role: "user" });
    expect(register.status).toBe(201);

    const login = await authService(getAdapter()).login("seller", "password123");
    const sellerRes = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${login.token}`);
    expect(sellerRes.status).toBe(403);
    expect(sellerRes.body).toEqual({ error: "Insufficient permissions" });
  });

  it("duplicate SKU returns 409 with error body (was: hang)", async () => {
    await seedTestProduct(getAdapter(), { sku: "DUP-001", name: "First" });

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Second", sku: "DUP-001", price: 10, sell_price: 15, stock: 5 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "SKU already exists" });
  });

  it("insufficient-stock sale returns 400 with error body (was: hang)", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "STK-001", stock: 3 });

    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ product_id: product.id, quantity: 99 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient stock/);
  });

  it("discount date overlap returns 409 with error body (was: hang)", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "DSC-001", sell_price: 15 });

    const first = await request(app)
      .post(`/api/products/${product.id}/discounts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ discounted_price: 12, start_date: "2026-01-01", end_date: "2026-01-10" });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/products/${product.id}/discounts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ discounted_price: 11, start_date: "2026-01-05", end_date: "2026-01-15" });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/overlaps/);
  });

  it("zod validation failure returns 400 with details", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sku: "NO-NAME" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("non-existent user returns 404 (was: hang)", async () => {
    const res = await request(app)
      .get("/api/users/999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });
});
