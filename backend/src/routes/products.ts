import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

// List products with pagination, search, category filter, sort
router.get("/", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || "";
  const category = (req.query.category as string) || "";
  const sort = (req.query.sort as string) || "created_at";
  const order = (req.query.order as string)?.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const validSorts = ["name", "sku", "price", "stock", "created_at"];
  const sortColumn = validSorts.includes(sort) ? sort : "created_at";

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push("(name LIKE ? OR sku LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM products ${where}`).get(...params) as { count: number };
  const total = countRow.count;
  const totalPages = Math.ceil(total / limit);

  const products = db.prepare(
    `SELECT * FROM products ${where} ORDER BY ${sortColumn} ${order} LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  res.json({ products, total, page, totalPages });
});

// Get low stock products
router.get("/low-stock", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const db = getDb();
  const products = db.prepare(
    "SELECT * FROM products WHERE stock <= low_stock_threshold ORDER BY stock ASC"
  ).all();
  res.json({ products });
});

// Export products to Excel
router.get("/export", authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const search = (req.query.search as string) || "";
  const category = (req.query.category as string) || "";

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push("(name LIKE ? OR sku LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const products = db.prepare(`SELECT * FROM products ${where} ORDER BY name ASC`).all(...params) as any[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");

  sheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Name", key: "name", width: 30 },
    { header: "SKU", key: "sku", width: 15 },
    { header: "Category", key: "category", width: 20 },
    { header: "Price", key: "price", width: 12 },
    { header: "Stock", key: "stock", width: 10 },
    { header: "Low Stock Threshold", key: "low_stock_threshold", width: 20 },
    { header: "Created At", key: "created_at", width: 20 },
    { header: "Updated At", key: "updated_at", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true };

  for (const p of products) {
    sheet.addRow(p);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=products.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

// Import products from Excel
router.post("/import", authenticate, requireRole("admin"), async (req: Request, res: Response) => {
  const { file } = req.body as { file?: string };

  if (!file) {
    res.status(400).json({ error: "No file provided. Send base64-encoded .xlsx in 'file' field." });
    return;
  }

  try {
    const buffer = Buffer.from(file, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet(1);

    if (!sheet) {
      res.status(400).json({ error: "No worksheet found in Excel file" });
      return;
    }

    const db = getDb();
    const errors: { row: number; sku: string; error: string }[] = [];
    let imported = 0;

    const insertStmt = db.prepare(
      "INSERT INTO products (name, sku, category, price, stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const checkSku = db.prepare("SELECT id FROM products WHERE sku = ?");
    const seenSkus = new Set<string>();

    // Skip header row (row 1)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const name = String(row.getCell(1).value || "").trim();
      const sku = String(row.getCell(2).value || "").trim();
      const category = String(row.getCell(3).value || "").trim();
      const price = parseFloat(String(row.getCell(4).value || "0"));
      const stock = parseInt(String(row.getCell(5).value || "0"), 10);
      const lowStockThreshold = parseInt(String(row.getCell(6).value || "5"), 10);

      if (!name) {
        errors.push({ row: rowNumber, sku: sku || "N/A", error: "Missing required field: name" });
        return;
      }

      if (!sku) {
        errors.push({ row: rowNumber, sku: "N/A", error: "Missing required field: sku" });
        return;
      }

      if (isNaN(price) || price < 0) {
        errors.push({ row: rowNumber, sku, error: "Invalid price" });
        return;
      }

      if (seenSkus.has(sku)) {
        errors.push({ row: rowNumber, sku, error: "Duplicate SKU in file" });
        return;
      }

      const existing = checkSku.get(sku);
      if (existing) {
        errors.push({ row: rowNumber, sku, error: "SKU already exists in database" });
        return;
      }

      seenSkus.add(sku);

      insertStmt.run(
        name,
        sku,
        category,
        price,
        isNaN(stock) ? 0 : stock,
        isNaN(lowStockThreshold) ? 5 : lowStockThreshold
      );
      imported++;
    });

    res.json({ imported, errors });
  } catch (err: any) {
    res.status(400).json({ error: `Failed to parse Excel file: ${err.message}` });
  }
});

// Create product
router.post("/", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { name, sku, category, price, stock, low_stock_threshold } = req.body;

  if (!name || !sku) {
    res.status(400).json({ error: "Name and SKU are required" });
    return;
  }

  if (price === undefined || price === null || price < 0) {
    res.status(400).json({ error: "Price must be >= 0" });
    return;
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE sku = ?").get(sku);
  if (existing) {
    res.status(409).json({ error: "SKU already exists" });
    return;
  }

  const result = db.prepare(
    "INSERT INTO products (name, sku, category, price, stock, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    name,
    sku,
    category || "",
    price,
    stock || 0,
    low_stock_threshold || 5
  );

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ product });
});

// Update product
router.put("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const { name, sku, category, price, stock, low_stock_threshold } = req.body;

  if (sku && sku !== existing.sku) {
    const skuExists = db.prepare("SELECT id FROM products WHERE sku = ? AND id != ?").get(sku, id);
    if (skuExists) {
      res.status(409).json({ error: "SKU already exists" });
      return;
    }
  }

  if (price !== undefined && price < 0) {
    res.status(400).json({ error: "Price must be >= 0" });
    return;
  }

  if (stock !== undefined && stock < 0) {
    res.status(400).json({ error: "Stock must be >= 0" });
    return;
  }

  db.prepare(
    `UPDATE products SET
      name = COALESCE(?, name),
      sku = COALESCE(?, sku),
      category = COALESCE(?, category),
      price = COALESCE(?, price),
      stock = COALESCE(?, stock),
      low_stock_threshold = COALESCE(?, low_stock_threshold),
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(
    name ?? null,
    sku ?? null,
    category ?? null,
    price ?? null,
    stock ?? null,
    low_stock_threshold ?? null,
    id
  );

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json({ product });
});

// Delete product
router.delete("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const hasSales = db.prepare("SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?").get(id) as { count: number };
  if (hasSales.count > 0) {
    res.status(409).json({ error: "Cannot delete product with existing sales" });
    return;
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  res.json({ success: true });
});

// Stock in
router.post("/:id/stock-in", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, notes } = req.body;

  if (!quantity || quantity <= 0) {
    res.status(400).json({ error: "Quantity must be > 0" });
    return;
  }

  const db = getDb();
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  db.prepare(
    "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
  ).run(quantity, id);

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json({ product: updated });
});

// Stock out
router.post("/:id/stock-out", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, notes } = req.body;

  if (!quantity || quantity <= 0) {
    res.status(400).json({ error: "Quantity must be > 0" });
    return;
  }

  const db = getDb();
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as any;
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (product.stock < quantity) {
    res.status(400).json({
      error: `Insufficient stock: available ${product.stock}, requested ${quantity}`,
    });
    return;
  }

  db.prepare(
    "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
  ).run(quantity, id);

  const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  res.json({ product: updated });
});

export default router;
