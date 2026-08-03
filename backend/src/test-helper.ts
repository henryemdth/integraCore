import Database from "better-sqlite3";
import { SqliteAdapter } from "./db/sqlite.js";
import { runMigrations } from "./db/schema.js";
import bcrypt from "bcryptjs";
import type { DatabaseAdapter } from "./db/adapter.js";

export function createTestDb(): { db: SqliteAdapter; raw: Database.Database } {
  const raw = new Database(":memory:");
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  runMigrations(raw);
  const db = new SqliteAdapter(raw);
  return { db, raw };
}

export async function seedTestUser(db: DatabaseAdapter, overrides?: Partial<{ username: string; password: string; full_name: string; role: string; active: number }>) {
  const opts = {
    username: "admin",
    password: "password123",
    full_name: "Admin User",
    role: "admin",
    active: 1,
    ...overrides,
  };
  const hash = bcrypt.hashSync(opts.password, 10);
  const result = await db.run(
    "INSERT INTO users (username, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?)",
    [opts.username, hash, opts.full_name, opts.role, opts.active]
  );
  const user = await db.get<{ id: number; username: string; role: string; full_name: string; active: number }>(
    "SELECT id, username, role, full_name, active FROM users WHERE id = ?",
    [result.insertId]
  );
  return user!;
}

export async function seedTestProduct(db: DatabaseAdapter, overrides?: Partial<{ name: string; sku: string; category: string; price: number; sell_price: number; stock: number; low_stock_threshold: number; status: string }>) {
  const opts = {
    name: "Test Product",
    sku: "TST-001",
    category: "Test",
    price: 10,
    sell_price: 15,
    stock: 50,
    low_stock_threshold: 5,
    status: "active",
    ...overrides,
  };
  const result = await db.run(
    "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [opts.name, opts.sku, opts.category, opts.price, opts.sell_price, opts.stock, opts.low_stock_threshold, opts.status]
  );
  const product = await db.get<{ id: number; name: string; sku: string; sell_price: number; stock: number; status: string }>(
    "SELECT id, name, sku, sell_price, stock, status FROM products WHERE id = ?",
    [result.insertId]
  );
  return product!;
}

export async function seedTestSale(db: DatabaseAdapter, userId: number, productId: number, quantity: number = 2) {
  const product = await db.get<{ sell_price: number; stock: number }>("SELECT sell_price, stock FROM products WHERE id = ?", [productId]);
  if (!product) throw new Error("Product not found");

  const unitPrice = product.sell_price;
  const subtotal = unitPrice * quantity;

  const result = await db.run(
    "INSERT INTO sales (user_id, total, notes) VALUES (?, ?, ?)",
    [userId, subtotal, ""]
  );
  const saleId = result.insertId;

  await db.run(
    "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal, discount_id, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [saleId, productId, quantity, unitPrice, subtotal, null, product.sell_price]
  );

  await db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [quantity, productId]);
  return saleId;
}



