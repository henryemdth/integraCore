import { vi, describe, beforeAll, it, expect } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { createServer } from "http";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { Express } from "express";
import { todayDateString } from "@integracore/shared";

// Use a temp file-backed SQLite DB so backup/restore tests also run E2E.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "integracore-e2e-"));
const dbFile = path.join(tmpDir, "test.db");
vi.stubEnv("DB_DRIVER", "sqlite");
vi.stubEnv("DB_PATH", dbFile);
vi.stubEnv("DATA_DIR", tmpDir);
vi.stubEnv("RATE_LIMIT_MAX", "1000");

const { createApp } = await import("../../src/app.js");
const { initDatabase, getAdapter } = await import("../../src/db/index.js");
const { initSocket } = await import("../../src/socket/index.js");
const { seedTestProduct } = await import("../helpers/test-helper.js");
const { acquireWriteLock, releaseWriteLock, isWriteLocked } = await import("../../src/services/lockService.js");
const { profitService } = await import("../../src/services/profitService.js");
const { authService } = await import("../../src/services/authService.js");

let app: Express;
let serverUrl: string;
let adminToken: string;
let seller1Token: string;
let seller2Token: string;
let seller2Id: number;

beforeAll(async () => {
  await initDatabase();
  app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Test concurrent POST /api/auth/setup race on a brand-new empty DB
  const [s1, s2] = await Promise.all([
    request(app).post("/api/auth/setup").send({ username: "admin", password: "password123", full_name: "Admin One" }),
    request(app).post("/api/auth/setup").send({ username: "admin2", password: "password123", full_name: "Admin Two" }),
  ]);
  const statuses = [s1.status, s2.status].sort();
  expect(statuses).toEqual([201, 400]);

  const adminLogin = await request(app).post("/api/auth/login").send({ username: "admin", password: "password123" });
  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.token;

  const reg1 = await request(app)
    .post("/api/auth/register")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ username: "seller1", password: "password123", full_name: "Seller One", role: "user" });
  expect(reg1.status).toBe(201);

  const reg2 = await request(app)
    .post("/api/auth/register")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ username: "seller2", password: "password123", full_name: "Seller Two", role: "user" });
  expect(reg2.status).toBe(201);
  seller2Id = reg2.body.user.id;

  const l1 = await request(app).post("/api/auth/login").send({ username: "seller1", password: "password123" });
  const l2 = await request(app).post("/api/auth/login").send({ username: "seller2", password: "password123" });
  seller1Token = l1.body.token;
  seller2Token = l2.body.token;
});

describe("E2E Corner Cases — Sales, Stock & Concurrency", () => {
  it("blocks duplicate product_id lines that exceed stock and merges valid duplicates", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "DUP-LINE-1", sell_price: 10, stock: 4 });

    // Exceeds stock when summed (3 + 3 = 6 > 4)
    const bad = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${seller1Token}`)
      .send({
        items: [
          { product_id: product.id, quantity: 3 },
          { product_id: product.id, quantity: 3 },
        ],
      });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe("INSUFFICIENT_STOCK");

    const afterBad = await getAdapter().get<{ stock: number }>("SELECT stock FROM products WHERE id = ?", [product.id]);
    expect(afterBad!.stock).toBe(4);

    // Valid duplicate lines (2 + 1 = 3 <= 4) merge cleanly
    const ok = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${seller1Token}`)
      .send({
        items: [
          { product_id: product.id, quantity: 2 },
          { product_id: product.id, quantity: 1 },
        ],
      });
    expect(ok.status).toBe(201);
    expect(ok.body.sale.items).toHaveLength(1);
    expect(ok.body.sale.items[0].quantity).toBe(3);

    const afterOk = await getAdapter().get<{ stock: number }>("SELECT stock FROM products WHERE id = ?", [product.id]);
    expect(afterOk!.stock).toBe(1);
  });

  it("prevents overselling / negative stock under concurrent sales", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "RACE-SALE-1", sell_price: 10, stock: 5 });

    const results = await Promise.all([
      request(app).post("/api/sales").set("Authorization", `Bearer ${seller1Token}`).send({ items: [{ product_id: product.id, quantity: 3 }] }),
      request(app).post("/api/sales").set("Authorization", `Bearer ${seller2Token}`).send({ items: [{ product_id: product.id, quantity: 3 }] }),
      request(app).post("/api/sales").set("Authorization", `Bearer ${adminToken}`).send({ items: [{ product_id: product.id, quantity: 3 }] }),
    ]);

    const succeeded = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status === 400 && r.body.code === "INSUFFICIENT_STOCK");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(2);

    const finalStock = await getAdapter().get<{ stock: number }>("SELECT stock FROM products WHERE id = ?", [product.id]);
    expect(finalStock!.stock).toBe(2);
  });

  it("prevents double-restoring stock on concurrent DELETE /api/sales/:id", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "RACE-DEL-1", sell_price: 10, stock: 10 });
    const created = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ product_id: product.id, quantity: 4 }] });
    expect(created.status).toBe(201);
    const saleId = created.body.sale.id;

    const [d1, d2] = await Promise.all([
      request(app).delete(`/api/sales/${saleId}`).set("Authorization", `Bearer ${adminToken}`),
      request(app).delete(`/api/sales/${saleId}`).set("Authorization", `Bearer ${adminToken}`),
    ]);
    expect([d1.status, d2.status].sort()).toEqual([200, 404]);

    const restored = await getAdapter().get<{ stock: number }>("SELECT stock FROM products WHERE id = ?", [product.id]);
    expect(restored!.stock).toBe(10);
  });

  it("avoids IEEE-754 floating-point drift on sale totals", async () => {
    const product = await seedTestProduct(getAdapter(), { sku: "FLOAT-1", price: 0.5, sell_price: 1.15, stock: 10 });
    const res = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${seller1Token}`)
      .send({ items: [{ product_id: product.id, quantity: 3 }] });
    expect(res.status).toBe(201);
    expect(res.body.sale.items[0].subtotal).toBe(3.45);
    expect(res.body.sale.total).toBe(3.45);
  });

  it("serves >100 products on GET /api/products/all and strips purchase price for sellers", async () => {
    const db = getAdapter();
    for (let i = 1; i <= 105; i++) {
      await db.run(
        "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, 'Bulk', 5, 10, 10, 2, 'active')",
        [`Bulk Product ${i}`, `BULK-${String(i).padStart(3, "0")}`]
      );
    }

    const sellerAll = await request(app)
      .get("/api/products/all")
      .set("Authorization", `Bearer ${seller1Token}`);
    expect(sellerAll.status).toBe(200);
    expect(sellerAll.body.products.length).toBeGreaterThanOrEqual(105);
    expect(sellerAll.body.products[0]).not.toHaveProperty("price");

    const adminAll = await request(app)
      .get("/api/products/all")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminAll.status).toBe(200);
    expect(adminAll.body.products[0]).toHaveProperty("price");
  });
});

describe("E2E Corner Cases — Authorization, Profit & Discounts", () => {
  it("scopes dashboard summary for sellers and hides admin-only fields", async () => {
    const p = await seedTestProduct(getAdapter(), { sku: "DASH-1", price: 80, sell_price: 100, stock: 20 });

    await request(app).put("/api/profit/target").set("Authorization", `Bearer ${adminToken}`).send({ target_amount: 5000, period_days: 30 });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${adminToken}`).send({ items: [{ product_id: p.id, quantity: 1 }] });
    await request(app).post("/api/sales").set("Authorization", `Bearer ${seller1Token}`).send({ items: [{ product_id: p.id, quantity: 1 }] });

    const sellerDash = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${seller1Token}`);
    expect(sellerDash.status).toBe(200);
    expect(sellerDash.body.targetAmount).toBe(0);
    expect(sellerDash.body.targetPercentage).toBe(0);
    expect(sellerDash.body.totalUsers).toBe(0);
    expect(sellerDash.body.profitThisMonth).toBeNull();
    expect(sellerDash.body.recentSales.every((s: { seller_name: string }) => s.seller_name === "Seller One")).toBe(true);

    const adminDash = await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${adminToken}`);
    expect(adminDash.status).toBe(200);
    expect(adminDash.body.targetAmount).toBe(5000);
    expect(adminDash.body.totalUsers).toBe(3);
    expect(adminDash.body.profitThisMonth).toBeLessThan(adminDash.body.revenueThisMonth);
  });

  it("profit check compares net profit (not revenue) against target_amount", async () => {
    // Previous test set target_amount = 5000. Lower it to 1000 so revenue > target? Wait: check actual profit < revenue.
    const check = await request(app).get("/api/profit/check").set("Authorization", `Bearer ${adminToken}`);
    expect(check.status).toBe(200);
    expect(check.body.profit).toBeDefined();
    expect(check.body.revenue).toBeGreaterThan(check.body.profit);
    expect(check.body.gap).toBe(check.body.target_amount - check.body.profit);
  });

  it("prevents sellers from marking admin-only notifications as read", async () => {
    const adminNotif = await profitService(getAdapter()).createNotification("profit_behind", "Admin secret", { gap: 100 }, "admin");
    const allNotif = await profitService(getAdapter()).createNotification("low_stock", "Public low stock", { count: 1 }, "all");

    const singleAttempt = await request(app)
      .patch(`/api/notifications/${adminNotif.id}/read`)
      .set("Authorization", `Bearer ${seller1Token}`);
    expect(singleAttempt.status).toBe(404);

    const readAllAttempt = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${seller1Token}`);
    expect(readAllAttempt.status).toBe(200);

    const adminRow = await getAdapter().get<{ read: number }>("SELECT read FROM notifications WHERE id = ?", [adminNotif.id]);
    const allRow = await getAdapter().get<{ read: number }>("SELECT read FROM notifications WHERE id = ?", [allNotif.id]);
    expect(adminRow!.read).toBe(0);
    expect(allRow!.read).toBe(1);
  });

  it("blocks lowering sell_price below active discount and deleting product with discount history", async () => {
    const p = await seedTestProduct(getAdapter(), { sku: "DISC-GUARD-1", price: 5, sell_price: 20, stock: 10 });
    const today = todayDateString();

    const d = await request(app)
      .post(`/api/products/${p.id}/discounts`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ discounted_price: 15, start_date: today, end_date: today });
    expect(d.status).toBe(201);

    const lower = await request(app)
      .put(`/api/products/${p.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sell_price: 14 });
    expect(lower.status).toBe(400);
    expect(lower.body.code).toBe("SELL_PRICE_BELOW_DISCOUNT");

    const del = await request(app)
      .delete(`/api/products/${p.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe("PRODUCT_HAS_DISCOUNTS");
  });

  it("rejects malformed date/id query params with 400 instead of 500", async () => {
    const badDate = await request(app)
      .get("/api/sales?date_from=not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(badDate.status).toBe(400);

    const badProdId = await request(app)
      .get("/api/discounts?product_id=1.5")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(badProdId.status).toBe(400);
  });
});

describe("E2E Corner Cases — Excel Import/Export & Socket Confidentiality", () => {
  it("rejects negative stock/threshold on Excel import and unwraps formula cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Products");
    ws.addRow(["Name", "SKU", "Category", "Price", "Sell Price", "Stock", "Low Stock Threshold", "Status"]);
    ws.addRow(["Neg Stock", "NEG-1", "Test", 5, 10, -5, 2, "active"]);
    ws.addRow(["Neg Thresh", "NEG-2", "Test", 5, 10, 5, -1, "active"]);
    const formulaRow = ws.addRow(["Formula Prod", "FORM-1", "Test", { formula: "5+5", result: 10 }, 20, 5, 2, "active"]);
    expect(formulaRow).toBeDefined();

    const buf = Buffer.from(await wb.xlsx.writeBuffer()).toString("base64");
    const res = await request(app)
      .post("/api/products/import")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ file: buf });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    expect(res.body.errors.map((e: { code: string }) => e.code)).toEqual(["INVALID_STOCK", "INVALID_THRESHOLD"]);

    const imported = await getAdapter().get<{ price: number }>("SELECT price FROM products WHERE sku = 'FORM-1'");
    expect(imported!.price).toBe(10);
  });

  it("sanitizes formula-injection strings in Excel exports", async () => {
    await seedTestProduct(getAdapter(), { sku: "INJ-1", name: '=HYPERLINK("http://evil")', sell_price: 10, stock: 5 });

    const res = await request(app)
      .get("/api/products/export?search=INJ-1")
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse((resStream, cb) => {
        const chunks: Buffer[] = [];
        resStream.on("data", (c: Buffer) => chunks.push(c));
        resStream.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet(1)!;
    const nameCell = ws.getRow(2).getCell(2).value;
    expect(String(nameCell)).toBe(`'=HYPERLINK("http://evil")`);
  });

  it("exports multiple sales via batched items query and sanitizes formula notes", async () => {
    const p = await seedTestProduct(getAdapter(), { sku: "EXP-SALE-1", price: 4, sell_price: 10, stock: 20 });
    await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ items: [{ product_id: p.id, quantity: 2 }], notes: "+CMD|' /C calc'!A0" });

    const res = await request(app)
      .get(`/api/sales/export?product_id=${p.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse((resStream, cb) => {
        const chunks: Buffer[] = [];
        resStream.on("data", (c: Buffer) => chunks.push(c));
        resStream.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.getWorksheet(1)!;
    // Admin sales export has notes in column 15
    const notesCell = ws.getRow(2).getCell(15).value;
    expect(String(notesCell)).toBe(`'+CMD|' /C calc'!A0`);
  });

  it("enforces 1mb JSON limit on regular routes while allowing >1mb on upload routes", async () => {
    const oversized = "x".repeat(1_200_000);
    const rejected = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: oversized, sku: "BIG-1", price: 1, sell_price: 2, stock: 1 });
    expect(rejected.status).toBe(413);

    // /api/backup/restore still accepts >1mb payloads (fails later at SQLite validation with 400, not 413)
    const allowedUpload = await request(app)
      .post("/api/backup/restore")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ file: oversized });
    expect(allowedUpload.status).toBe(400);
  });

  it("serves full user projections on GET /api/users/all for admin and blocks sellers", async () => {
    const adminRes = await request(app)
      .get("/api/users/all")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.users.length).toBeGreaterThanOrEqual(3);
    expect(adminRes.body.users[0]).toHaveProperty("role");
    expect(adminRes.body.users[0]).toHaveProperty("active");
    expect(adminRes.body.users[0]).not.toHaveProperty("password_hash");

    const sellerRes = await request(app)
      .get("/api/users/all")
      .set("Authorization", `Bearer ${seller1Token}`);
    expect(sellerRes.status).toBe(403);
  });

  it("strips purchase price and blocks admin notifications on seller WebSockets, and disconnects deactivated users", async () => {
    const adminSocket: ClientSocket = ioClient(serverUrl, { auth: { token: adminToken }, transports: ["websocket"] });
    const sellerSocket: ClientSocket = ioClient(serverUrl, { auth: { token: seller2Token }, transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((r) => adminSocket.on("connect", () => r())),
      new Promise<void>((r) => sellerSocket.on("connect", () => r())),
    ]);

    const adminProductEvents: any[] = [];
    const sellerProductEvents: any[] = [];
    const adminNotifEvents: any[] = [];
    const sellerNotifEvents: any[] = [];

    adminSocket.on("product:updated", (p) => adminProductEvents.push(p));
    sellerSocket.on("product:updated", (p) => sellerProductEvents.push(p));
    adminSocket.on("notification:new", (n) => adminNotifEvents.push(n));
    sellerSocket.on("notification:new", (n) => sellerNotifEvents.push(n));

    const prod = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Socket Test", sku: "SOCK-1", price: 42, sell_price: 99, stock: 5 });
    expect(prod.status).toBe(201);

    await profitService(getAdapter()).createNotification("profit_behind", "Secret profit", { gap: 50 }, "admin");

    await new Promise((r) => setTimeout(r, 150));

    expect(adminProductEvents.some((p) => p.sku === "SOCK-1" && p.price === 42)).toBe(true);
    expect(sellerProductEvents.some((p) => p.sku === "SOCK-1" && p.price === undefined)).toBe(true);
    expect(adminNotifEvents.some((n) => n.type === "profit_behind")).toBe(true);
    expect(sellerNotifEvents.some((n) => n.type === "profit_behind")).toBe(false);

    // Deactivating seller2 must immediately disconnect their active socket
    const disconnected = new Promise<void>((r) => sellerSocket.on("disconnect", () => r()));
    const deact = await request(app)
      .patch(`/api/users/${seller2Id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deact.status).toBe(200);
    await disconnected;

    adminSocket.disconnect();
    sellerSocket.disconnect();
  });
});

describe("E2E Corner Cases — Backup & Restore Safeguards", () => {
  it("does not release an active write lock when a concurrent restore is rejected with 409", async () => {
    const exp = await request(app)
      .get("/api/backup/export")
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse((resStream, cb) => {
        const chunks: Buffer[] = [];
        resStream.on("data", (c: Buffer) => chunks.push(c));
        resStream.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(exp.status).toBe(200);
    const validBase64 = (exp.body as Buffer).toString("base64");

    // Simulate an in-flight restore holding the write lock
    expect(acquireWriteLock()).toBe(true);
    try {
      const { backupService } = await import("../../src/services/backupService.js");
      await expect(backupService(getAdapter(), tmpDir).restoreBackup(validBase64)).rejects.toThrow("already in progress");
      // The lock MUST still be held!
      expect(isWriteLocked()).toBe(true);
    } finally {
      releaseWriteLock();
    }
  });

  it("rejects SQLite backup missing required columns", async () => {
    const badPath = path.join(tmpDir, "missing-col.sqlite");
    const badDb = new Database(badPath);
    badDb.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY);
      CREATE TABLE products (id INTEGER PRIMARY KEY);
      CREATE TABLE sales (id INTEGER PRIMARY KEY);
      CREATE TABLE sale_items (id INTEGER PRIMARY KEY);
      CREATE TABLE product_discounts (id INTEGER PRIMARY KEY);
      CREATE TABLE profit_targets (id INTEGER PRIMARY KEY);
      CREATE TABLE notifications (id INTEGER PRIMARY KEY);
    `);
    badDb.close();

    const base64 = fs.readFileSync(badPath).toString("base64");
    const res = await request(app)
      .post("/api/backup/restore")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ file: base64 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_DB_SCHEMA");
  });

  it("invalidates pre-restore JWTs after a successful backup restore", async () => {
    const exp = await request(app)
      .get("/api/backup/export")
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse((resStream, cb) => {
        const chunks: Buffer[] = [];
        resStream.on("data", (c: Buffer) => chunks.push(c));
        resStream.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(exp.status).toBe(200);
    const base64 = (exp.body as Buffer).toString("base64");

    const restore = await request(app)
      .post("/api/backup/restore")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ file: base64 });
    expect(restore.status).toBe(200);

    // Pre-restore JWT must now be rejected with 401
    const staleMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(staleMe.status).toBe(401);

    // Fresh login against restored DB succeeds
    const freshLogin = await authService(getAdapter()).login("admin", "password123");
    expect(freshLogin.token).toBeTruthy();
  });
});
