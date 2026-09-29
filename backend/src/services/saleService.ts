import type { DatabaseAdapter } from "../db/adapter.js";
import ExcelJS from "exceljs";
import { AppError } from "../utils/appError.js";
import { findActiveDiscounts } from "./discountLookup.js";
import { reloadAndEmitProduct } from "./productService.js";
import { endOfDay, PRODUCT_STATUS, reportLabels, type ReportLanguage } from "@integracore/shared";

// Cost fields are opt-in: the default shape (list/detail/create responses,
// visible to sellers) never carries margin data — only the admin-only export
// and stats queries request it. Explicit column list on purpose.
function getSaleItems(db: DatabaseAdapter, saleId: number, opts?: { includeCost?: boolean }) {
  // effective_cost: the cost frozen at sale time, falling back to the
  // product's current purchase price for items sold before tracking existed.
  const costColumns = opts?.includeCost
    ? ", COALESCE(si.cost_price, p.price, 0) AS effective_cost"
    : "";
  return db.all(
    `SELECT si.id, si.sale_id, si.product_id, si.quantity, si.unit_price, si.subtotal,
            si.discount_id, si.original_price,
            p.name as product_name, p.sku as product_sku, p.category as product_category${costColumns}
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
        `SELECT id, name, sell_price, price, stock, status FROM products WHERE id IN (${placeholders})`,
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
          // Frozen like original_price so later cost changes never rewrite
          // the profit of a sale already made. Cost source is the product's
          // purchase price (products.price — the field the UI already fills).
          cost_price: Number(product.price ?? 0),
        };
      });

      const saleResult = await tx.run(
        "INSERT INTO sales (user_id, total, notes) VALUES (?, ?, ?)",
        [userId, total, notes || ""]
      );

      const insertedSaleId = saleResult.insertId;
      for (const item of saleItems) {
        await tx.run(
          "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal, discount_id, original_price, cost_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [insertedSaleId, item.product_id, item.quantity, item.unit_price, item.subtotal, item.discount_id, item.original_price, item.cost_price]
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
  }, lang: ReportLanguage) {
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

    const L = reportLabels[lang];
    // Cost/profit columns are admin-only: sellers export their own sales
    // without ever seeing margin data.
    const isAdmin = filters.isAdmin;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(L.sheetSales);
    sheet.columns = [
      { header: L.saleId, key: "id", width: 10 },
      { header: L.date, key: "created_at", width: 20 },
      { header: L.seller, key: "seller_name", width: 20 },
      { header: L.product, key: "product_name", width: 30 },
      { header: L.sku, key: "product_sku", width: 15 },
      { header: L.quantity, key: "quantity", width: 10 },
      { header: L.unitPrice, key: "unit_price", width: 12 },
      { header: L.unitPriceNormal, key: "original_price", width: 18 },
      ...(isAdmin ? [{ header: L.unitCost, key: "unit_cost", width: 12 }] : []),
      { header: L.discountApplied, key: "discount_applied", width: 16 },
      { header: L.savings, key: "savings", width: 10 },
      { header: L.subtotal, key: "subtotal", width: 12 },
      ...(isAdmin ? [{ header: L.profit, key: "profit", width: 12 }] : []),
      { header: L.total, key: "total", width: 12 },
      { header: L.notes, key: "notes", width: 25 },
    ];
    sheet.getRow(1).font = { bold: true };

    let totalSales = 0;
    let totalSavings = 0;
    let countWithDiscount = 0;
    let countWithoutDiscount = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    for (const sale of sales) {
      const items = await getSaleItems(db, sale.id, { includeCost: isAdmin }) as any[];

      totalSales++;
      for (const item of items) {
        const hasDiscount = item.discount_id != null;
        const savings = hasDiscount ? (item.original_price - item.unit_price) * item.quantity : 0;
        const profit = isAdmin ? (item.unit_price - item.effective_cost) * item.quantity : 0;
        if (hasDiscount) { countWithDiscount++; } else { countWithoutDiscount++; }
        totalSavings += savings;
        totalRevenue += item.subtotal;
        if (isAdmin) { totalCost += item.effective_cost * item.quantity; }

        sheet.addRow({
          id: sale.id, created_at: sale.created_at, seller_name: sale.seller_name,
          product_name: item.product_name, product_sku: item.product_sku,
          quantity: item.quantity, unit_price: item.unit_price,
          original_price: item.original_price,
          ...(isAdmin ? { unit_cost: item.effective_cost } : {}),
          discount_applied: hasDiscount ? L.yes : L.no,
          savings: savings,
          subtotal: item.subtotal,
          ...(isAdmin ? { profit } : {}),
          total: sale.total, notes: sale.notes,
        });
      }
    }

    // Summary as a label/value block: labels stacked in the first column,
    // values in the next, so every total reads as its own row.
    sheet.addRow({});
    const summaryEntries: Array<[string, string | number]> = [
      [L.totalSales, totalSales],
      [L.totalRevenue, totalRevenue],
      ...(isAdmin
        ? ([[L.totalCost, totalCost], [L.totalProfit, totalRevenue - totalCost]] as Array<[string, string | number]>)
        : []),
      [L.totalSavings, totalSavings],
      [L.withDiscount, countWithDiscount],
      [L.withoutDiscount, countWithoutDiscount],
    ];
    for (const [label, value] of summaryEntries) {
      const row = sheet.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    }

    return workbook;
  }

  async function stats(filters: {
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

    // Same filtered set as list/export. COALESCE falls back to the product's
    // current purchase price for items sold before cost tracking existed.
    // Every aggregate goes through Number(): PostgreSQL returns SUM/COUNT of
    // NUMERIC as strings and the row normalizer doesn't coerce aggregates.
    const row = await db.get(
      `SELECT COUNT(DISTINCT s.id) AS total_sales,
              COALESCE(SUM(si.subtotal), 0) AS total_revenue,
              COALESCE(SUM(COALESCE(si.cost_price, p.price, 0) * si.quantity), 0) AS total_cost,
              COALESCE(SUM((si.unit_price - COALESCE(si.cost_price, p.price, 0)) * si.quantity), 0) AS total_profit,
              COALESCE(SUM(CASE WHEN si.discount_id IS NOT NULL THEN (si.original_price - si.unit_price) * si.quantity ELSE 0 END), 0) AS total_savings
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       ${where}`,
      params
    ) as any;

    const totalSales = Number(row.total_sales);
    const totalRevenue = Number(row.total_revenue);
    const totalSavings = Number(row.total_savings);

    const base = {
      total_sales: totalSales,
      total_revenue: totalRevenue,
      total_savings: totalSavings,
      avg_sale_value: totalSales > 0 ? totalRevenue / totalSales : 0,
    };

    if (!filters.isAdmin) {
      return { ...base, total_cost: null, total_profit: null };
    }

    return {
      ...base,
      total_cost: Number(row.total_cost),
      total_profit: Number(row.total_profit),
    };
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

  return { create, list, getById, exportToExcel, stats, remove };
}
