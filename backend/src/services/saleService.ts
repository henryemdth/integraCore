import type Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { AppError } from "./authService.js";
import { emitProductUpdated } from "../socket/index.js";

function buildSaleDetail(db: Database.Database, saleId: number) {
  const sale = db.prepare(
    `SELECT s.*, u.full_name as seller_name
     FROM sales s JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`
  ).get(saleId) as any;

  if (!sale) return null;

  const items = db.prepare(
    `SELECT si.*, p.name as product_name, p.sku as product_sku
     FROM sale_items si JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = ?`
  ).all(saleId);

  return { ...sale, items };
}

function buildFilterQuery(filters: {
  userId?: number;
  isAdmin: boolean;
  requesterId: number;
  dateFrom?: string;
  dateTo?: string;
  productId?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (!filters.isAdmin) {
    conditions.push("s.user_id = ?");
    params.push(filters.requesterId);
  } else if (filters.userId) {
    conditions.push("s.user_id = ?");
    params.push(filters.userId);
  }

  if (filters.dateFrom) {
    conditions.push("s.created_at >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push("s.created_at <= ?");
    params.push(filters.dateTo + " 23:59:59");
  }
  if (filters.productId) {
    conditions.push("s.id IN (SELECT sale_id FROM sale_items WHERE product_id = ?)");
    params.push(filters.productId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function saleService(db: Database.Database) {
  function create(userId: number, items: { product_id: number; quantity: number }[], notes?: string) {
    const createSale = db.transaction(() => {
      const productIds = items.map((i) => i.product_id);
      const placeholders = productIds.map(() => "?").join(",");
      const products = db.prepare(
        `SELECT id, name, price, stock FROM products WHERE id IN (${placeholders})`
      ).all(...productIds) as any[];

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of items) {
        if (!productMap.has(item.product_id)) {
          throw new AppError(400, `Product not found: ${item.product_id}`);
        }
      }
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        if (product.stock < item.quantity) {
          throw new AppError(400,
            `Insufficient stock for "${product.name}": available ${product.stock}, requested ${item.quantity}`
          );
        }
      }

      let total = 0;
      const saleItems = items.map((item) => {
        const product = productMap.get(item.product_id)!;
        const subtotal = product.price * item.quantity;
        total += subtotal;
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: product.price,
          subtotal,
        };
      });

      const saleResult = db.prepare(
        "INSERT INTO sales (user_id, total, notes) VALUES (?, ?, ?)"
      ).run(userId, total, notes || "");

      const saleId = Number(saleResult.lastInsertRowid);
      const insertItem = db.prepare(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)"
      );
      for (const item of saleItems) {
        insertItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.subtotal);
      }

      const updateStock = db.prepare(
        "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
      );
      for (const item of saleItems) {
        updateStock.run(item.quantity, item.product_id);
      }

      return saleId;
    });

    const saleId = createSale();
    const sale = buildSaleDetail(db, saleId);

    for (const item of sale!.items) {
      const product = db.prepare("SELECT id, name, sku, price, stock FROM products WHERE id = ?").get(item.product_id) as any;
      if (product) {
        emitProductUpdated({ id: product.id, name: product.name, sku: product.sku, price: product.price, stock: product.stock });
      }
    }

    return { sale };
  }

  function list(params: {
    page: number;
    limit: number;
    isAdmin: boolean;
    requesterId: number;
    userId?: number;
    dateFrom?: string;
    dateTo?: string;
    productId?: number;
  }) {
    const { page, limit, isAdmin, requesterId, userId, dateFrom, dateTo, productId } = params;
    const offset = (page - 1) * limit;

    const { where, params: filterParams } = buildFilterQuery({
      userId, isAdmin, requesterId, dateFrom, dateTo, productId,
    });

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM sales s ${where}`)
      .get(...(filterParams as any[])) as { count: number };
    const total = countRow.count;
    const totalPages = Math.ceil(total / limit);

    const sales = db.prepare(
      `SELECT s.id, s.user_id, u.full_name as seller_name, s.total, s.notes, s.created_at
       FROM sales s JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...filterParams, limit, offset);

    const salesWithItems = sales.map((sale: any) => {
      const items = db.prepare(
        `SELECT si.*, p.name as product_name, p.sku as product_sku
         FROM sale_items si JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = ?`
      ).all(sale.id);
      return { ...sale, items };
    });

    return { sales: salesWithItems, total, page, totalPages };
  }

  function getById(id: number, requesterId: number, isAdmin: boolean) {
    const sale = buildSaleDetail(db, id);
    if (!sale) throw new AppError(404, "Sale not found");

    if (!isAdmin && sale.user_id !== requesterId) {
      throw new AppError(403, "Insufficient permissions");
    }

    return { sale };
  }

  async function exportToExcel(filters: {
    isAdmin: boolean;
    requesterId: number;
    userId?: number;
    dateFrom?: string;
    dateTo?: string;
    productId?: number;
  }) {
    const { where, params } = buildFilterQuery({
      isAdmin: filters.isAdmin,
      requesterId: filters.requesterId,
      userId: filters.userId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      productId: filters.productId,
    });

    const sales = db.prepare(
      `SELECT s.id, s.created_at, u.full_name as seller_name, s.total, s.notes
       FROM sales s JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC`
    ).all(...params) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales");
    sheet.columns = [
      { header: "Sale ID", key: "id", width: 10 },
      { header: "Date", key: "created_at", width: 20 },
      { header: "Seller", key: "seller_name", width: 20 },
      { header: "Product", key: "product_name", width: 30 },
      { header: "SKU", key: "product_sku", width: 15 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Price", key: "unit_price", width: 12 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Notes", key: "notes", width: 25 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const sale of sales) {
      const items = db.prepare(
        `SELECT si.*, p.name as product_name, p.sku as product_sku
         FROM sale_items si JOIN products p ON si.product_id = p.id
         WHERE si.sale_id = ?`
      ).all(sale.id) as any[];

      for (const item of items) {
        sheet.addRow({
          id: sale.id, created_at: sale.created_at, seller_name: sale.seller_name,
          product_name: item.product_name, product_sku: item.product_sku,
          quantity: item.quantity, unit_price: item.unit_price, subtotal: item.subtotal,
          total: sale.total, notes: sale.notes,
        });
      }
    }

    return workbook;
  }

  function remove(id: number) {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
    if (!sale) throw new AppError(404, "Sale not found");

    const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) as any[];

    const deleteSale = db.transaction(() => {
      const updateStock = db.prepare(
        "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
      );
      for (const item of items) {
        updateStock.run(item.quantity, item.product_id);
      }
      db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);
      db.prepare("DELETE FROM sales WHERE id = ?").run(id);
    });

    deleteSale();

    for (const item of items) {
      const product = db.prepare("SELECT id, name, sku, price, stock FROM products WHERE id = ?").get(item.product_id) as any;
      if (product) {
        emitProductUpdated({ id: product.id, name: product.name, sku: product.sku, price: product.price, stock: product.stock });
      }
    }

    return { success: true };
  }

  return { create, list, getById, exportToExcel, remove };
}
