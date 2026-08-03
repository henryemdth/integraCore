import type Database from "better-sqlite3";
import type { DatabaseAdapter } from "./adapter.js";

// ─── SQLite DDL ─────────────────────────────────────────────────────────────

const sqliteMigrations: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    sell_price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    discount_id INTEGER REFERENCES product_discounts(id),
    original_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );`,

  `CREATE TABLE IF NOT EXISTS profit_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_amount REAL NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'monthly',
    period_days INTEGER NOT NULL DEFAULT 15,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  `CREATE TABLE IF NOT EXISTS product_discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    discounted_price REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    reason TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_product_discounts_product_id ON product_discounts(product_id);`,
];

// ─── Column Migrations (additive only, run on every startup) ────────────────

const columnMigrations: { table: string; column: string; definition: string }[] = [
  { table: "profit_targets", column: "period_days", definition: "INTEGER NOT NULL DEFAULT 15" },
  { table: "products", column: "sell_price", definition: "REAL NOT NULL DEFAULT 0" },
  { table: "products", column: "status", definition: "TEXT NOT NULL DEFAULT 'active'" },
  { table: "product_discounts", column: "status", definition: "TEXT NOT NULL DEFAULT 'active'" },
  { table: "sale_items", column: "discount_id", definition: "INTEGER" },
  { table: "sale_items", column: "original_price", definition: "REAL NOT NULL DEFAULT 0" },
];

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Added column ${table}.${column}`);
  }
}

export function runMigrations(db: Database.Database): void {
  // Each CREATE TABLE / INDEX is isolated — failure won't cascade
  for (const sql of sqliteMigrations) {
    try {
      db.exec(sql);
    } catch (err) {
      console.error("[db] Migration failed (isolated, continuing):", (err as Error).message);
    }
  }

  // Each column addition is isolated
  for (const { table, column, definition } of columnMigrations) {
    try {
      addColumnIfMissing(db, table, column, definition);
    } catch (err) {
      console.error(`[db] Column migration failed for ${table}.${column} (isolated, continuing):`, (err as Error).message);
    }
  }

  // Data backfill: normalize legacy discount ranges (YYYY-MM-DD) to full-day
  // wall-clock timestamps. Guarded so it is idempotent across restarts and
  // also heals old-format backups restored into a fresh install.
  try {
    const backfilled = db
      .prepare(
        `UPDATE product_discounts
         SET start_date = start_date || ' 00:00:00.000',
             end_date = end_date || ' 23:59:59.999'
         WHERE start_date NOT LIKE '% %' OR end_date NOT LIKE '% %'`
      )
      .run();
    if (backfilled.changes > 0) {
      console.log(`[db] Normalized ${backfilled.changes} discount date range(s) to full-day timestamps`);
    }
  } catch (err) {
    console.error("[db] Discount date backfill failed (isolated, continuing):", (err as Error).message);
  }

  console.log("[db] Migrations completed successfully");
}

// ─── PostgreSQL DDL ─────────────────────────────────────────────────────────

const postgresColumnMigrations: string[] = [
  `ALTER TABLE profit_targets ADD COLUMN IF NOT EXISTS period_days INTEGER NOT NULL DEFAULT 15`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS sell_price NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE product_discounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS discount_id INTEGER REFERENCES product_discounts(id)`,
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS original_price NUMERIC NOT NULL DEFAULT 0`,
];

const postgresMigrations: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT '',
    price NUMERIC NOT NULL DEFAULT 0,
    sell_price NUMERIC NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total NUMERIC NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,
    discount_id INTEGER REFERENCES product_discounts(id),
    original_price NUMERIC NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS profit_targets (
    id SERIAL PRIMARY KEY,
    target_amount NUMERIC NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'monthly',
    period_days INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS product_discounts (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    discounted_price NUMERIC NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    reason TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  );`,

  // Data migration for pre-existing DATE columns: convert the end date to the
  // last instant of the day (guarded/idempotent), then widen to TIMESTAMP.
  `UPDATE product_discounts SET end_date = end_date + time '23:59:59.999' WHERE end_date::text NOT LIKE '% %'`,
  `ALTER TABLE product_discounts ALTER COLUMN start_date TYPE TIMESTAMP`,
  `ALTER TABLE product_discounts ALTER COLUMN end_date TYPE TIMESTAMP`,

  `CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_product_discounts_product_id ON product_discounts(product_id);`,
];

export async function runPostgresMigrations(adapter: DatabaseAdapter): Promise<void> {
  for (const sql of postgresMigrations) {
    try {
      await adapter.exec(sql);
    } catch (err) {
      console.error("[db] PostgreSQL DDL failed (isolated, continuing):", (err as Error).message);
    }
  }
  for (const sql of postgresColumnMigrations) {
    try {
      await adapter.exec(sql);
    } catch (err) {
      console.error("[db] PostgreSQL column migration failed (isolated, continuing):", (err as Error).message);
    }
  }
  console.log("[db] PostgreSQL migrations completed successfully");
}
