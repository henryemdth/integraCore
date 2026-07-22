import { Router, Request, Response } from "express";
import ExcelJS from "exceljs";
import { getDb } from "../db/index.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

function buildSaleDetail(db: any, saleId: number) {
  const sale = db.prepare(
    `SELECT s.*, u.full_name as seller_name
     FROM sales s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = ?`
  ).get(saleId) as any;

  if (!sale) return null;

  const items = db.prepare(
    `SELECT si.*, p.name as product_name, p.sku as product_sku
     FROM sale_items si
     JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = ?`
  ).all(saleId);

  return { ...sale, items };
}

function buildFilterQuery(req: Request, isAdmin: boolean) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (!isAdmin) {
    conditions.push("s.user_id = ?");
    params.push(req.user!.id);
  } else {
    const userId = parseInt(req.query.user_id as string);
    if (!isNaN(userId)) {
      conditions.push("s.user_id = ?");
      params.push(userId);
    }
  }

  const dateFrom = req.query.date_from as string;
  if (dateFrom) {
    conditions.push("s.created_at >= ?");
    params.push(dateFrom);
  }

  const dateTo = req.query.date_to as string;
  if (dateTo) {
    conditions.push("s.created_at <= ?");
    params.push(dateTo + " 23:59:59");
  }

  const productId = parseInt(req.query.product_id as string);
  if (!isNaN(productId)) {
    conditions.push("s.id IN (SELECT sale_id FROM sale_items WHERE product_id = ?)");
    params.push(productId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

// Create sale
router.post("/", authenticate, (req: Request, res: Response) => {
  const { items, notes } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "At least one item is required" });
    return;
  }

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) {
      res.status(400).json({ error: "Each item must have product_id and quantity >= 1" });
      return;
    }
  }

  const db = getDb();

  const createSale = db.transaction(() => {
    // Validate products and stock
    const productIds = items.map((i: any) => i.product_id);
    const placeholders = productIds.map(() => "?").join(",");
    const products = db.prepare(
      `SELECT id, name, price, stock FROM products WHERE id IN (${placeholders})`
    ).all(...productIds) as any[];

    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Check all products exist
    for (const item of items) {
      if (!productMap.has(item.product_id)) {
        throw new Error(`Product not found: ${item.product_id}`);
      }
    }

    // Check stock for each item
    for (const item of items) {
      const product = productMap.get(item.product_id)!;
      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}": available ${product.stock}, requested ${item.quantity}`
        );
      }
    }

    // Calculate total
    let total = 0;
    const saleItems = items.map((item: any) => {
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

    // Insert sale
    const saleResult = db.prepare(
      "INSERT INTO sales (user_id, total, notes) VALUES (?, ?, ?)"
    ).run(req.user!.id, total, notes || "");

    const saleId = saleResult.lastInsertRowid;

    // Insert sale items
    const insertItem = db.prepare(
      "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)"
    );
    for (const item of saleItems) {
      insertItem.run(saleId, item.product_id, item.quantity, item.unit_price, item.subtotal);
    }

    // Decrement stock
    const updateStock = db.prepare(
      "UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?"
    );
    for (const item of saleItems) {
      updateStock.run(item.quantity, item.product_id);
    }

    return Number(saleId);
  });

  try {
    const saleId = createSale();
    const sale = buildSaleDetail(db, saleId);
    res.status(201).json({ sale });
  } catch (err: any) {
    if (err.message.includes("not found") || err.message.includes("Insufficient stock")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Failed to create sale" });
    }
  }
});

// List sales with filters
router.get("/", authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const isAdmin = req.user!.role === "admin";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  const { where, params } = buildFilterQuery(req, isAdmin);

  const countRow = db.prepare(
    `SELECT COUNT(*) as count FROM sales s ${where}`
  ).get(...(params as any[])) as { count: number };
  const total = countRow.count;
  const totalPages = Math.ceil(total / limit);

  const sales = db.prepare(
    `SELECT s.id, s.user_id, u.full_name as seller_name, s.total, s.notes, s.created_at
     FROM sales s
     JOIN users u ON s.user_id = u.id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  // Attach items to each sale
  const salesWithItems = sales.map((sale: any) => {
    const items = db.prepare(
      `SELECT si.*, p.name as product_name, p.sku as product_sku
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`
    ).all(sale.id);
    return { ...sale, items };
  });

  res.json({ sales: salesWithItems, total, page, totalPages });
});

// Export sales to Excel (must be before /:id to avoid route conflict)
router.get("/export", authenticate, async (req: Request, res: Response) => {
  const db = getDb();
  const isAdmin = req.user!.role === "admin";
  const { where, params } = buildFilterQuery(req, isAdmin);

  const sales = db.prepare(
    `SELECT s.id, s.created_at, u.full_name as seller_name, s.total, s.notes
     FROM sales s
     JOIN users u ON s.user_id = u.id
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
       FROM sale_items si
       JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?`
    ).all(sale.id) as any[];

    for (const item of items) {
      sheet.addRow({
        id: sale.id,
        created_at: sale.created_at,
        seller_name: sale.seller_name,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        total: sale.total,
        notes: sale.notes,
      });
    }
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sales.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

// Get single sale detail
router.get("/:id", authenticate, (req: Request, res: Response) => {
  const id = req.params.id as string;
  const db = getDb();

  const sale = buildSaleDetail(db, parseInt(id));
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  // Regular users can only view their own sales
  if (req.user!.role !== "admin" && sale.user_id !== req.user!.id) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }

  res.json({ sale });
});

// Delete sale (admin only)
router.delete("/:id", authenticate, requireRole("admin"), (req: Request, res: Response) => {
  const id = req.params.id as string;
  const db = getDb();

  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
  if (!sale) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const deleteSale = db.transaction(() => {
    // Restore stock for each item
    const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) as any[];
    const updateStock = db.prepare(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?"
    );
    for (const item of items) {
      updateStock.run(item.quantity, item.product_id);
    }

    // Delete sale_items (cascade should handle this, but be explicit)
    db.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);

    // Delete sale
    db.prepare("DELETE FROM sales WHERE id = ?").run(id);
  });

  deleteSale();
  res.json({ success: true });
});

export default router;
