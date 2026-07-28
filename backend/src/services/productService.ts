import type { DatabaseAdapter } from "../db/adapter.js";
import ExcelJS from "exceljs";
import { AppError } from "./authService.js";
import { emitProductUpdated } from "../socket/index.js";

export function productService(db: DatabaseAdapter) {
  async function list(params: {
    page: number;
    limit: number;
    search: string;
    category: string;
    status: string;
    sort: string;
    order: "ASC" | "DESC";
  }) {
    const { page, limit, search, category, status, sort, order } = params;
    const offset = (page - 1) * limit;

    const validSorts = ["name", "sku", "price", "sell_price", "stock", "created_at"];
    const sortColumn = validSorts.includes(sort) ? sort : "created_at";

    const conditions: string[] = [];
    const sqlParams: any[] = [];

    if (search) {
      conditions.push("(name LIKE ? OR sku LIKE ?)");
      sqlParams.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      conditions.push("category = ?");
      sqlParams.push(category);
    }
    if (status && status !== "all") {
      conditions.push("status = ?");
      sqlParams.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM products ${where}`,
      sqlParams
    );
    const total = countRow!.count;
    const totalPages = Math.ceil(total / limit);

    const products = await db.all(
      `SELECT * FROM products ${where} ORDER BY ${sortColumn} ${order} LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    );

    return { products, total, page, totalPages };
  }

  async function listLowStock() {
    return await db.all(
      "SELECT * FROM products WHERE stock <= low_stock_threshold AND status = 'active' ORDER BY stock ASC"
    );
  }

  async function getCategories() {
    const products = await db.all<{ category: string }>("SELECT category FROM products WHERE category != ''");
    return [...new Set(products.map((p) => p.category))].sort();
  }

  async function exportToExcel(search: string, category: string, status: string) {
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
    if (status && status !== "all") {
      conditions.push("status = ?");
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const products = await db.all(`SELECT * FROM products ${where} ORDER BY name ASC`) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Products");
    sheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Name", key: "name", width: 30 },
      { header: "SKU", key: "sku", width: 15 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 12 },
      { header: "Sell Price", key: "sell_price", width: 12 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Low Stock Threshold", key: "low_stock_threshold", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const p of products) sheet.addRow(p);

    return workbook;
  }

  async function importFromExcel(base64File: string) {
    const buffer = Buffer.from(base64File, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet(1);

    if (!sheet) throw new AppError(400, "No worksheet found in Excel file");

    const errors: { row: number; sku: string; error: string }[] = [];
    let imported = 0;
    const seenSkus = new Set<string>();

    const rowCount = sheet.rowCount;
    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const values = row.values as any[];
      if (!row || !values || values.length === 0 || values.every((v: any) => v === null || v === undefined)) continue;

      const name = String(row.getCell(1).value || "").trim();
      const sku = String(row.getCell(2).value || "").trim();
      const category = String(row.getCell(3).value || "").trim();
      const price = parseFloat(String(row.getCell(4).value || "0"));
      const sellPrice = parseFloat(String(row.getCell(5).value || "0"));
      const stock = parseInt(String(row.getCell(6).value || "0"), 10);
      const lowStockThreshold = parseInt(String(row.getCell(7).value || "5"), 10);
      const status = String(row.getCell(8).value || "active").trim().toLowerCase();

      if (!name) { errors.push({ row: rowNumber, sku: sku || "N/A", error: "Missing required field: name" }); continue; }
      if (!sku) { errors.push({ row: rowNumber, sku: "N/A", error: "Missing required field: sku" }); continue; }
      if (isNaN(price) || price < 0) { errors.push({ row: rowNumber, sku, error: "Invalid price" }); continue; }
      if (isNaN(sellPrice) || sellPrice < 0) { errors.push({ row: rowNumber, sku, error: "Invalid sell price" }); continue; }
      if (seenSkus.has(sku)) { errors.push({ row: rowNumber, sku, error: "Duplicate SKU in file" }); continue; }
      if (status !== "active" && status !== "discontinued") { errors.push({ row: rowNumber, sku, error: "Invalid status (must be 'active' or 'discontinued')" }); continue; }

      const existing = await db.get("SELECT id FROM products WHERE sku = ?", [sku]);
      if (existing) { errors.push({ row: rowNumber, sku, error: "SKU already exists in database" }); continue; }

      seenSkus.add(sku);
      await db.run(
        "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [name, sku, category, price, sellPrice, isNaN(stock) ? 0 : stock, isNaN(lowStockThreshold) ? 5 : lowStockThreshold, status]
      );
      imported++;
    }

    return { imported, errors };
  }

  async function create(data: { name: string; sku: string; category: string; price: number; sell_price: number; stock: number; low_stock_threshold: number; status?: string }) {
    const existing = await db.get("SELECT id FROM products WHERE sku = ?", [data.sku]);
    if (existing) throw new AppError(409, "SKU already exists");

    const status = data.status || "active";

    const result = await db.run(
      "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [data.name, data.sku, data.category, data.price, data.sell_price, data.stock, data.low_stock_threshold, status]
    );

    const product = await db.get("SELECT * FROM products WHERE id = ?", [result.insertId]) as any;
    emitProductUpdated({ id: product.id, name: product.name, sku: product.sku, price: product.price, sell_price: product.sell_price, stock: product.stock, status: product.status });
    return product;
  }

  async function update(id: number, data: { name?: string; sku?: string; category?: string; price?: number; sell_price?: number; stock?: number; low_stock_threshold?: number; status?: string }) {
    const existing = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "Product not found");

    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await db.get("SELECT id FROM products WHERE sku = ? AND id != ?", [data.sku, id]);
      if (skuExists) throw new AppError(409, "SKU already exists");
    }

    await db.run(
      `UPDATE products SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        sell_price = COALESCE(?, sell_price),
        stock = COALESCE(?, stock),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        status = COALESCE(?, status),
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        data.name ?? null, data.sku ?? null, data.category ?? null,
        data.price ?? null, data.sell_price ?? null, data.stock ?? null, data.low_stock_threshold ?? null, data.status ?? null, id
      ]
    );

    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    emitProductUpdated({ id: product.id, name: product.name, sku: product.sku, price: product.price, sell_price: product.sell_price, stock: product.stock, status: product.status });
    return product;
  }

  async function remove(id: number) {
    const existing = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "Product not found");

    const hasSales = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?", [id]);
    if (hasSales!.count > 0) throw new AppError(409, "Cannot delete product with existing sales");

    await db.run("DELETE FROM products WHERE id = ?", [id]);
    return { success: true };
  }

  async function stockIn(id: number, quantity: number) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!product) throw new AppError(404, "Product not found");

    await db.run(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?",
      [quantity, id]
    );

    const updated = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    emitProductUpdated({ id: updated.id, name: updated.name, sku: updated.sku, price: updated.price, sell_price: updated.sell_price, stock: updated.stock, status: updated.status });
    return updated;
  }

  async function stockOut(id: number, quantity: number) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!product) throw new AppError(404, "Product not found");

    if (product.stock < quantity) {
      throw new AppError(400, `Insufficient stock: available ${product.stock}, requested ${quantity}`);
    }

    await db.run(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?",
      [quantity, id]
    );

    const updated = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    emitProductUpdated({ id: updated.id, name: updated.name, sku: updated.sku, price: updated.price, sell_price: updated.sell_price, stock: updated.stock, status: updated.status });
    return updated;
  }

  return { list, listLowStock, getCategories, exportToExcel, importFromExcel, create, update, remove, stockIn, stockOut };
}
