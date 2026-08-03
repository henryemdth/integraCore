import type { DatabaseAdapter } from "../db/adapter.js";
import ExcelJS from "exceljs";
import { AppError } from "./authService.js";
import { emitProductUpdated } from "../socket/index.js";
import { startOfDay, endOfDay, todayDateString, nowString, nextDayDateString } from "@integracore/shared";

export function discountService(db: DatabaseAdapter) {
  async function list(productId: number) {
    return await db.all(
      `SELECT pd.*, p.name as product_name, p.sku as product_sku
       FROM product_discounts pd
       JOIN products p ON pd.product_id = p.id
       WHERE pd.product_id = ?
       ORDER BY pd.start_date DESC`,
      [productId]
    );
  }

  async function getActive(productId: number) {
    const now = nowString();
    return await db.get(
      `SELECT * FROM product_discounts
       WHERE product_id = ? AND status = 'active' AND start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC LIMIT 1`,
      [productId, now, now]
    );
  }

  async function create(productId: number, data: { discounted_price: number; start_date: string; end_date: string; reason?: string }) {
    const product = await db.get("SELECT id, status, sell_price FROM products WHERE id = ?", [productId]) as any;
    if (!product) throw new AppError(404, "Product not found");
    if (product.status === "discontinued") throw new AppError(400, "Cannot create discounts for discontinued products");
    if (data.discounted_price >= product.sell_price) throw new AppError(400, "Discounted price must be less than sell price");

    const start = startOfDay(data.start_date);
    const end = endOfDay(data.end_date);

    const overlap = await db.get(
      `SELECT COUNT(*) as count FROM product_discounts pd
       WHERE pd.product_id = ? AND pd.start_date <= ? AND pd.end_date >= ?
         AND (pd.status = 'active'
           OR (pd.status = 'cancelled' AND EXISTS (SELECT 1 FROM sale_items WHERE discount_id = pd.id)))`,
      [productId, end, start]
    ) as any;
    if (overlap.count > 0) throw new AppError(409, "Discount date range overlaps with an existing active discount for this product");

    const result = await db.run(
      `INSERT INTO product_discounts (product_id, discounted_price, start_date, end_date, status, reason)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [productId, data.discounted_price, start, end, data.reason || ""]
    );

    const discount = await db.get("SELECT * FROM product_discounts WHERE id = ?", [result.insertId]) as any;
    const updated = await db.get("SELECT id, name, sku, price, sell_price, stock, status FROM products WHERE id = ?", [productId]) as any;
    const now = nowString();
    const isActive = start <= now && now <= end;
    emitProductUpdated({
      ...updated,
      discounted_price: isActive ? discount.discounted_price : null,
      discount_end_date: isActive ? discount.end_date : null,
    });
    return discount;
  }

  async function cancel(id: number) {
    const discount = await db.get("SELECT * FROM product_discounts WHERE id = ?", [id]) as any;
    if (!discount) throw new AppError(404, "Discount not found");
    if (discount.status === "cancelled") throw new AppError(400, "Discount is already cancelled");

    await db.run("UPDATE product_discounts SET status = 'cancelled' WHERE id = ?", [id]);

    const product = await db.get("SELECT id, name, sku, price, sell_price, stock, status FROM products WHERE id = ?", [discount.product_id]) as any;
    const activeDiscount = await getActive(discount.product_id);
    emitProductUpdated({ ...product, discounted_price: activeDiscount?.discounted_price ?? null, discount_end_date: activeDiscount?.end_date ?? null });
    return { success: true, cancelled: true };
  }

  async function remove(id: number) {
    const discount = await db.get("SELECT * FROM product_discounts WHERE id = ?", [id]) as any;
    if (!discount) throw new AppError(404, "Discount not found");

    const salesCount = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM sale_items WHERE discount_id = ?",
      [id]
    );
    if (salesCount!.count > 0) {
      throw new AppError(409, "This discount can't be deleted because it already has sales. Cancel it instead to stop it from applying going forward.");
    }

    await db.run("DELETE FROM product_discounts WHERE id = ?", [id]);

    const product = await db.get("SELECT id, name, sku, price, sell_price, stock, status FROM products WHERE id = ?", [discount.product_id]) as any;
    const activeDiscount = await getActive(discount.product_id);
    emitProductUpdated({ ...product, discounted_price: activeDiscount?.discounted_price ?? null, discount_end_date: activeDiscount?.end_date ?? null });
    return { success: true };
  }

  async function listAll() {
    return await db.all(
      `SELECT pd.*, p.name as product_name, p.sku as product_sku, p.sell_price as normal_price,
              COALESCE(si_agg.units_sold, 0) as units_sold
       FROM product_discounts pd
       JOIN products p ON pd.product_id = p.id
       LEFT JOIN (
         SELECT discount_id, SUM(quantity) as units_sold
         FROM sale_items
         WHERE discount_id IS NOT NULL
         GROUP BY discount_id
       ) si_agg ON si_agg.discount_id = pd.id
       ORDER BY pd.start_date DESC`
    );
  }

  async function exportHistory() {
    const discounts = await db.all(
      `SELECT pd.*, p.name as product_name, p.sku as product_sku, p.sell_price as normal_price,
              COALESCE(si_agg.units_sold, 0) as units_sold
       FROM product_discounts pd
       JOIN products p ON pd.product_id = p.id
       LEFT JOIN (
         SELECT discount_id, SUM(quantity) as units_sold
         FROM sale_items
         WHERE discount_id IS NOT NULL
         GROUP BY discount_id
       ) si_agg ON si_agg.discount_id = pd.id
       ORDER BY pd.start_date DESC`
    ) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Discount History");
      sheet.columns = [
        { header: "Product", key: "product_name", width: 30 },
        { header: "SKU", key: "product_sku", width: 15 },
        { header: "Normal Price", key: "normal_price", width: 14 },
        { header: "Discounted Price", key: "discounted_price", width: 18 },
        { header: "% Discount", key: "pct_discount", width: 12 },
        { header: "Start Date", key: "start_date", width: 14 },
        { header: "End Date", key: "end_date", width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Units Sold", key: "units_sold", width: 12 },
        { header: "Worked?", key: "worked", width: 10 },
        { header: "Reason", key: "reason", width: 25 },
      ];
    sheet.getRow(1).font = { bold: true };

    for (const d of discounts) {
      const pct = d.normal_price > 0 ? Math.round((1 - d.discounted_price / d.normal_price) * 100) : 0;
      const unitsSold = d.units_sold ?? 0;

      sheet.addRow({
        product_name: d.product_name,
        product_sku: d.product_sku,
        normal_price: d.normal_price,
        discounted_price: d.discounted_price,
        pct_discount: `${pct}%`,
        start_date: (d.start_date || "").slice(0, 10),
        end_date: (d.end_date || "").slice(0, 10),
        status: d.status === "cancelled" ? "Cancelled" : "Active",
        units_sold: unitsSold,
        worked: unitsSold > 0 ? "Yes" : "No",
        reason: d.reason || "",
      });
    }

    return workbook;
  }

  async function checkDateTriggers() {
    const today = todayDateString();
    const dayStart = startOfDay(today);
    const nextDayStart = startOfDay(nextDayDateString(today));

    const todayStarters = await db.all(
      `SELECT pd.*, p.name as product_name
       FROM product_discounts pd
       JOIN products p ON pd.product_id = p.id
       WHERE pd.status = 'active' AND pd.start_date >= ? AND pd.start_date < ?`,
      [dayStart, nextDayStart]
    ) as any[];

    for (const d of todayStarters) {
      const product = await db.get(
        "SELECT id, name, sku, price, sell_price, stock, status FROM products WHERE id = ?",
        [d.product_id]
      ) as any;
      if (product) {
        emitProductUpdated({ ...product, discounted_price: d.discounted_price, discount_end_date: d.end_date });
      }
    }

    const todayEnders = await db.all(
      `SELECT pd.*, p.name as product_name
       FROM product_discounts pd
       JOIN products p ON pd.product_id = p.id
       WHERE pd.status = 'active' AND pd.end_date >= ? AND pd.end_date < ?`,
      [dayStart, nextDayStart]
    ) as any[];

    for (const d of todayEnders) {
      const product = await db.get(
        "SELECT id, name, sku, price, sell_price, stock, status FROM products WHERE id = ?",
        [d.product_id]
      ) as any;
      if (product) {
        emitProductUpdated({ ...product, discounted_price: null, discount_end_date: null });
      }
    }

    return { activated: todayStarters.length, expired: todayEnders.length };
  }

  return { list, getActive, create, cancel, remove, listAll, exportHistory, checkDateTriggers };
}
