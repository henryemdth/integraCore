import type { DatabaseAdapter } from "../db/adapter.js";
import { nowString } from "@integracore/shared";

// The core "active discount covering right now" predicate, in one place: every
// price-resolution path (sales, product lists, realtime payloads) must agree
// on which discount applies today. Cancelled discounts never match. If several
// rows ever overlap, the latest-starting one wins.
//
// Lives in its own dependency-free module so productService and
// discountService can both use it without importing each other.
export async function findActiveDiscounts(db: DatabaseAdapter, productIds: number[]): Promise<Map<number, any>> {
  if (productIds.length === 0) return new Map();
  const now = nowString();
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await db.all(
    `SELECT * FROM product_discounts
     WHERE product_id IN (${placeholders})
       AND status = 'active'
       AND start_date <= ? AND end_date >= ?
     ORDER BY start_date DESC`,
    [...productIds, now, now],
  ) as any[];
  return new Map(rows.map((d) => [d.product_id, d]));
}

export async function findActiveDiscount(db: DatabaseAdapter, productId: number) {
  // Map.get → undefined when absent, matching db.get's "no row" convention.
  const discounts = await findActiveDiscounts(db, [productId]);
  return discounts.get(productId);
}
