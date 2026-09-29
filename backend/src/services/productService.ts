import type { DatabaseAdapter } from "../db/adapter.js";
import ExcelJS from "exceljs";
import { AppError } from "../utils/appError.js";
import { emitProductUpdated } from "../socket/index.js";
import { findActiveDiscount, findActiveDiscounts } from "./discountLookup.js";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  PRODUCT_STATUS,
  reportLabels,
  buildImportColumnAliases,
  importTemplateHeaders,
  normalizeHeaderToken,
  resolveImportStatus,
  type ImportProductField,
  type ReportLanguage,
} from "@integracore/shared";

// Re-reads the product (with its effective discount) after a mutation and
// pushes it to every connected client. Shared by the product, sale, and
// discount flows so every realtime payload has the same shape — only the
// fields every client may see, so realtime push never carries more than
// the declared price/stock/discount contract.
export async function reloadAndEmitProduct(db: DatabaseAdapter, id: number) {
  const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
  if (!product) return null;
  const discount = await findActiveDiscount(db, id);
  emitProductUpdated({
    id: product.id,
    name: product.name,
    sku: product.sku,
    price: product.price,
    sell_price: product.sell_price,
    stock: product.stock,
    status: product.status,
    discounted_price: discount?.discounted_price ?? null,
    discount_end_date: discount?.end_date ?? null,
  });
  return {
    ...product,
    discounted_price: discount?.discounted_price ?? null,
    discount_end_date: discount?.end_date ?? null,
  };
}

export function productService(db: DatabaseAdapter) {
  function buildProductFilter(search: string, category: string, status: string) {
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
    return { where, params };
  }

  // Attaches the effective discount (active + covering today) to each product.
  async function attachActiveDiscountInfo(products: any[]): Promise<void> {
    const discountMap = await findActiveDiscounts(db, products.map((p) => p.id));
    for (const p of products) {
      const d = discountMap.get(p.id);
      p.discounted_price = d ? d.discounted_price : null;
      p.discount_end_date = d ? d.end_date : null;
    }
  }

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

    const { where, params: sqlParams } = buildProductFilter(search, category, status);

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM products ${where}`,
      sqlParams
    );
    const total = countRow!.count;
    const totalPages = Math.ceil(total / limit);

    const products = await db.all(
      `SELECT * FROM products ${where} ORDER BY ${sortColumn} ${order} LIMIT ? OFFSET ?`,
      [...sqlParams, limit, offset]
    ) as any[];

    await attachActiveDiscountInfo(products);

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

  async function getById(id: number) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");
    return product;
  }

  async function exportToExcel(search: string, category: string, status: string, lang: ReportLanguage) {
    const { where, params } = buildProductFilter(search, category, status);
    const products = await db.all(`SELECT * FROM products ${where} ORDER BY name ASC`, params) as any[];
    await attachActiveDiscountInfo(products);

    const L = reportLabels[lang];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(L.sheetProducts);
    sheet.columns = [
      { header: L.id, key: "id", width: 8 },
      { header: L.name, key: "name", width: 30 },
      { header: L.sku, key: "sku", width: 15 },
      { header: L.category, key: "category", width: 20 },
      { header: L.purchasePrice, key: "price", width: 14 },
      { header: L.sellPrice, key: "sell_price", width: 12 },
      { header: L.effectivePrice, key: "effective_price", width: 18 },
      { header: L.hasDiscount, key: "has_discount", width: 14 },
      { header: L.discountEndDate, key: "discount_end_date", width: 18 },
      { header: L.stock, key: "stock", width: 10 },
      { header: L.lowStockThreshold, key: "low_stock_threshold", width: 20 },
      { header: L.status, key: "status", width: 15 },
      { header: L.createdAt, key: "created_at", width: 20 },
      { header: L.updatedAt, key: "updated_at", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const p of products) {
      sheet.addRow({
        ...p,
        effective_price: p.discounted_price ?? p.sell_price,
        has_discount: p.discounted_price ? L.yes : L.no,
        discount_end_date: p.discounted_price ? (p.discount_end_date || "").slice(0, 10) : "",
        status: p.status === PRODUCT_STATUS.discontinued ? L.discontinued : L.active,
      });
    }

    return workbook;
  }

  async function importFromExcel(base64File: string) {
    const buffer = Buffer.from(base64File, "base64");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet(1);

    if (!sheet) throw new AppError(400, "No worksheet found in Excel file", "NO_WORKSHEET");

    const errors: { row: number; sku: string; error: string; code?: string }[] = [];
    let imported = 0;
    const seenSkus = new Set<string>();

    // Column detection: headers are matched against the vocabulary of every
    // supported language (the same labels the exports emit), so a file's
    // language never has to match the importer's UI language. Header mode
    // engages only when both required identifier columns (name + sku) are
    // found — anything else falls back to the legacy positional template so
    // partially-labeled files are never misread column-by-column.
    const aliases = buildImportColumnAliases();
    const positional: ImportProductField[] = ["name", "sku", "category", "price", "sellPrice", "stock", "lowStockThreshold", "status"];
    const headerRow = sheet.getRow(1);
    const columnMap = new Map<number, ImportProductField>();
    const assigned = new Set<ImportProductField>();
    headerRow.eachCell({ includeEmpty: false }, (cellValue, colNumber) => {
      const token = normalizeHeaderToken(String(cellValue.value ?? ""));
      if (!token) return;
      for (const field of Object.keys(aliases) as ImportProductField[]) {
        if (!assigned.has(field) && aliases[field].includes(token)) {
          columnMap.set(colNumber, field);
          assigned.add(field);
          return;
        }
      }
    });
    const headerMode = assigned.has("name") && assigned.has("sku");
    const colFor = new Map<ImportProductField, number>();
    if (headerMode) {
      for (const [col, field] of columnMap) colFor.set(field, col);
    } else {
      positional.forEach((field, i) => colFor.set(field, i + 1));
    }

    // Excel-native numbers pass through; text with a single comma decimal
    // ("12,5") is converted. Ambiguous formats ("1.234,56") are deliberately
    // left to parseFloat's existing behavior rather than guessed.
    const parseCellNumber = (value: unknown): number => {
      const raw = String(value ?? "").trim();
      return parseFloat((/^(-?\d+),(\d+)$/.test(raw) ? raw.replace(",", ".") : raw) || "0");
    };

    // Atomic: a mid-file failure (db error, crash) rolls back the whole batch
    // instead of leaving a partial import behind.
    await db.transaction(async (tx) => {
      const rowCount = sheet.rowCount;
      for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const values = row.values as any[];
        if (!row || !values || values.length === 0 || values.every((v: any) => v === null || v === undefined)) continue;

        // Header mode may legitimately omit optional columns (e.g. no Sell
        // Price header): they read as empty, same tolerance as an empty cell.
        const cell = (field: ImportProductField): unknown => {
          const col = colFor.get(field);
          return col === undefined ? undefined : row.getCell(col).value;
        };
        const name = String(cell("name") ?? "").trim();
        const sku = String(cell("sku") ?? "").trim();
        const category = String(cell("category") ?? "").trim();
        const price = parseCellNumber(cell("price"));
        const sellPrice = parseCellNumber(cell("sellPrice"));
        const stock = parseInt(String(cell("stock") ?? "0"), 10);
        const lowStockThreshold = parseInt(String(cell("lowStockThreshold") ?? String(DEFAULT_LOW_STOCK_THRESHOLD)), 10);
        const statusRaw = String(cell("status") ?? "").trim();
        const status = statusRaw ? resolveImportStatus(statusRaw) : PRODUCT_STATUS.active;

        if (!name) { errors.push({ row: rowNumber, sku: sku || "N/A", error: "Missing required field: name", code: "MISSING_NAME" }); continue; }
        if (!sku) { errors.push({ row: rowNumber, sku: "N/A", error: "Missing required field: sku", code: "MISSING_SKU" }); continue; }
        if (isNaN(price) || price < 0) { errors.push({ row: rowNumber, sku, error: "Invalid price", code: "INVALID_PRICE" }); continue; }
        if (isNaN(sellPrice) || sellPrice < 0) { errors.push({ row: rowNumber, sku, error: "Invalid sell price", code: "INVALID_SELL_PRICE" }); continue; }
        if (seenSkus.has(sku)) { errors.push({ row: rowNumber, sku, error: "Duplicate SKU in file", code: "DUPLICATE_SKU_FILE" }); continue; }
        if (!status) { errors.push({ row: rowNumber, sku, error: "Invalid status (must be 'active' or 'discontinued')", code: "INVALID_STATUS" }); continue; }

        const existing = await tx.get("SELECT id FROM products WHERE sku = ?", [sku]);
        if (existing) { errors.push({ row: rowNumber, sku, error: "SKU already exists in database", code: "SKU_EXISTS_DB" }); continue; }

        seenSkus.add(sku);
        await tx.run(
          "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [name, sku, category, price, sellPrice, isNaN(stock) ? 0 : stock, isNaN(lowStockThreshold) ? DEFAULT_LOW_STOCK_THRESHOLD : lowStockThreshold, status]
        );
        imported++;
      }
    });

    return { imported, errors };
  }

  // Header-only template (no sample data row that could be imported by
  // accident) with column names in the requested language.
  async function buildImportTemplate(lang: ReportLanguage) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(reportLabels[lang].sheetProducts);
    sheet.columns = importTemplateHeaders(lang).map((t) => ({ header: t.header, key: t.field, width: 22 }));
    sheet.getRow(1).font = { bold: true };
    return workbook;
  }

  async function create(data: { name: string; sku: string; category: string; price: number; sell_price: number; stock: number; low_stock_threshold: number; status?: string }) {
    const existing = await db.get("SELECT id FROM products WHERE sku = ?", [data.sku]);
    if (existing) throw new AppError(409, "SKU already exists", "SKU_EXISTS");

    const status = data.status || PRODUCT_STATUS.active;

    const result = await db.run(
      "INSERT INTO products (name, sku, category, price, sell_price, stock, low_stock_threshold, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [data.name, data.sku, data.category, data.price, data.sell_price, data.stock, data.low_stock_threshold, status]
    );

    return await reloadAndEmitProduct(db, result.insertId);
  }

  async function update(id: number, data: { name?: string; sku?: string; category?: string; price?: number; sell_price?: number; stock?: number; low_stock_threshold?: number; status?: string }) {
    const existing = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await db.get("SELECT id FROM products WHERE sku = ? AND id != ?", [data.sku, id]);
      if (skuExists) throw new AppError(409, "SKU already exists", "SKU_EXISTS");
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

    return await reloadAndEmitProduct(db, id);
  }

  async function remove(id: number) {
    const existing = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!existing) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

    const hasSales = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?", [id]);
    if (hasSales!.count > 0) throw new AppError(409, "Cannot delete product with existing sales", "PRODUCT_HAS_SALES");

    await db.run("DELETE FROM products WHERE id = ?", [id]);
    return { success: true };
  }

  async function stockIn(id: number, quantity: number) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

    await db.run(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?",
      [quantity, id]
    );

    return await reloadAndEmitProduct(db, id);
  }

  async function stockOut(id: number, quantity: number) {
    const product = await db.get("SELECT * FROM products WHERE id = ?", [id]) as any;
    if (!product) throw new AppError(404, "Product not found", "PRODUCT_NOT_FOUND");

    if (product.stock < quantity) {
      throw new AppError(400, `Insufficient stock for "${product.name}": available ${product.stock}, requested ${quantity}`, "INSUFFICIENT_STOCK", { name: product.name, available: product.stock, requested: quantity });
    }

    await db.run(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?",
      [quantity, id]
    );

    return await reloadAndEmitProduct(db, id);
  }

  return { list, listLowStock, getCategories, getById, exportToExcel, importFromExcel, buildImportTemplate, create, update, remove, stockIn, stockOut };
}
