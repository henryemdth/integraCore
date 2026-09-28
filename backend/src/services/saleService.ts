import type { DatabaseAdapter } from "../db/adapter.js";
import ExcelJS from "exceljs";
import { AppError } from "../utils/appError.js";
import { findActiveDiscounts } from "./discountLookup.js";
import { reloadAndEmitProduct } from "./productService.js";
import { endOfDay, PRODUCT_STATUS } from "@integracore/shared";

function getSaleItems(db: DatabaseAdapter, saleId: number) {
  return db.all(
    `SELECT si.*, p.name as product_name, p.sku as product_sku, p.category as product_category
     FROM sale_items si JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = ?`,
    [saleId]
  );
}

async function buildSaleDetail(db: DatabaseAdapter, saleId: number) {
  const sale = await db.get(
    `SELECT s.*, u.full_name as seller_name
     FROM sales s JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`,
    [saleId]
  ) as any;

  if (!sale) return null;

  const items = await getSaleItems(db, saleId);

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
    // Inclusive last-instant of the day (shared convention) so a sale at
    // 23:59:59.500 still lands inside its own day's filter.
    params.push(endOfDay(filters.dateTo));
  }
  if (filters.productId) {
    conditions.push("s.id IN (SELECT sale_id FROM sale_items WHERE product_id = ?)");
    params.push(filters.productId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export function saleService(db: DatabaseAdapter) {
  async function create(userId: number, items: { product_id: number; quantity: number }[], notes?: string) {
    const saleId = await db.transaction(async (tx) => {
      const productIds = items.map((i) => i.product_id);
      const placeholders = productIds.map(() => "?").join(",");
      const products = await tx.all(
        `SELECT id, name, sell_price, stock, status FROM products WHERE id IN (${placeholders})`,
        productIds
      ) as any[];

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of items) {
        if (!productMap.has(item.product_id)) {
          throw new AppError(400, `Product not found: ${item.product_id}`, "PRODUCT_NOT_FOUND", { id: item.product_id });
        }
      }
      for (const item of items) {
        const product = productMap.get(item.product_id)!;
        if (product.status === PRODUCT_STATUS.discontinued) {
          throw new AppError(400, `Cannot sell discontinued product: "${product.name}"`, "PRODUCT_DISCONTINUED", { name: product.name });
        }
        if (product.stock < item.quantity) {
          throw new AppError(400,
            `Insufficient stock for "${product.name}": available ${product.stock}, requested ${item.quantity}`,
            "INSUFFICIENT_STOCK",
            { name: product.name, available: product.stock, requested: item.quantity }
          );
        }
      }

      const productIdsList = items.map((i) => i.product_id);
      const discountMap = await findActiveDiscounts(tx, productIdsList);

      let total = 0;
      const saleItems = items.map((item) => {
        const product = productMap.get(item.product_id)!;
        const discount = discountMap.get(item.product_id);
        const effectivePrice = discount ? discount.discounted_price : product.sell_price;
        const subtotal = effectivePrice * item.quantity;
        total += subtotal;
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: effectivePrice,
          subtotal,
          discount_id: discount ? discount.id : null,
          original_price: product.sell_price,
        };
      });

      const saleResult = await tx.run(
        "INSERT INTO sales (user_id, total, notes) VALUES (?, ?, ?)",
        [userId, total, notes || ""]
      );

      const insertedSaleId = saleResult.insertId;
      for (const item of saleItems) {
        await tx.run(
          "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal, discount_id, original_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [insertedSaleId, item.product_id, item.quantity, item.unit_price, item.subtotal, item.discount_id, item.original_price]
        );
      }

      for (const item of saleItems) {
        await tx.run(
          "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }

      return insertedSaleId;
    });

    const sale = await buildSaleDetail(db, saleId);
    if (!sale) throw new AppError(500, "Sale disappeared after creation", "SALE_NOT_FOUND");

    const emittedProductIds = new Set<number>(sale.items.map((item: any) => item.product_id));
    for (const productId of emittedProductIds) {
      await reloadAndEmitProduct(db, productId);
    }

    return { sale };
  }

  async function list(params: {
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

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM sales s ${where}`,
      filterParams
    );
    const total = countRow!.count;
    const totalPages = Math.ceil(total / limit);

    const sales = await db.all(
      `SELECT s.id, s.user_id, u.full_name as seller_name, s.total, s.notes, s.created_at
       FROM sales s JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, limit, offset]
    );

    const salesWithItems = await Promise.all(
      sales.map(async (sale: any) => {
        const items = await getSaleItems(db, sale.id);
        return { ...sale, items };
      })
    );

    return { sales: salesWithItems, total, page, totalPages };
  }

  async function getById(id: number, requesterId: number, isAdmin: boolean) {
    const sale = await buildSaleDetail(db, id);
    if (!sale) throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");

    if (!isAdmin && sale.user_id !== requesterId) {
      throw new AppError(403, "Insufficient permissions", "INSUFFICIENT_PERMISSIONS");
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

    const sales = await db.all(
      `SELECT s.id, s.created_at, u.full_name as seller_name, s.total, s.notes
       FROM sales s JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC`,
      params
    ) as any[];

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
      { header: "Unit Price (Normal)", key: "original_price", width: 18 },
      { header: "Discount Applied?", key: "discount_applied", width: 16 },
      { header: "Savings", key: "savings", width: 10 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Notes", key: "notes", width: 25 },
    ];
    sheet.getRow(1).font = { bold: true };

    let totalSales = 0;
    let totalSavings = 0;
    let countWithDiscount = 0;
    let countWithoutDiscount = 0;

    for (const sale of sales) {
      const items = await getSaleItems(db, sale.id) as any[];

      totalSales++;
      for (const item of items) {
        const hasDiscount = item.discount_id != null;
        const savings = hasDiscount ? (item.original_price - item.unit_price) * item.quantity : 0;
        if (hasDiscount) { countWithDiscount++; } else { countWithoutDiscount++; }
        totalSavings += savings;

        sheet.addRow({
          id: sale.id, created_at: sale.created_at, seller_name: sale.seller_name,
          product_name: item.product_name, product_sku: item.product_sku,
          quantity: item.quantity, unit_price: item.unit_price,
          original_price: item.original_price,
          discount_applied: hasDiscount ? "Yes" : "No",
          savings: savings,
          subtotal: item.subtotal,
          total: sale.total, notes: sale.notes,
        });
      }
    }

    sheet.addRow({});
    const summaryRow = sheet.addRow({
      id: "TOTAL",
      unit_price: "",
      original_price: "",
      discount_applied: "",
      savings: totalSavings,
      subtotal: "",
    });
    summaryRow.getCell(1).font = { bold: true };
    summaryRow.getCell(2).value = `Total Sales: ${totalSales}`;
    summaryRow.getCell(3).value = `With Discount: ${countWithDiscount}`;
    summaryRow.getCell(4).value = `Without Discount: ${countWithoutDiscount}`;
    summaryRow.getCell(5).value = `Total Savings: ${totalSavings}`;

    return workbook;
  }

  async function remove(id: number) {
    const sale = await db.get("SELECT * FROM sales WHERE id = ?", [id]) as any;
    if (!sale) throw new AppError(404, "Sale not found", "SALE_NOT_FOUND");

    const items = await db.all("SELECT * FROM sale_items WHERE sale_id = ?", [id]) as any[];

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx.run(
          "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?",
          [item.quantity, item.product_id]
        );
      }
      await tx.run("DELETE FROM sale_items WHERE sale_id = ?", [id]);
      await tx.run("DELETE FROM sales WHERE id = ?", [id]);
    });

    for (const productId of new Set(items.map((item) => item.product_id))) {
      await reloadAndEmitProduct(db, productId);
    }

    return { success: true };
  }

  return { create, list, getById, exportToExcel, remove };
}
