// Row-level shapes mirroring the database schema (backend/src/db/schema.ts).
// The service layer types every db.get/db.all against these interfaces instead
// of casting to `any`, so a wrong column name or a missing field fails at
// compile time. Value types follow the SQLite contract the whole stack is
// built on: TEXT timestamps as strings, BOOLEAN as 0/1, MONEY as numbers.
// Status/role unions come from @integracore/shared — the same `as const`
// vocabulary the CHECK constraints and the frontend use.
import type { DiscountStatus, ProductStatus, Role } from "@integracore/shared";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: Role;
  active: number;
  created_at: string;
  updated_at: string;
}

// The user shape safe to hand around after authentication — no password hash.
export type UserProjectionRow = Omit<UserRow, "password_hash">;

export interface ProductRow {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  sell_price: number;
  stock: number;
  low_stock_threshold: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface SaleRow {
  id: number;
  user_id: number;
  total: number;
  notes: string | null;
  created_at: string;
}

// sales joined with users (seller name resolved for list/export/detail views).
export type SaleListRow = SaleRow & { seller_name: string };

export interface SaleItemRow {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_id: number | null;
  original_price: number;
  // NULL marks items sold before cost tracking existed.
  cost_price: number | null;
}

// sale_items joined with products; includeCost adds the admin-only effective
// cost (cost frozen at sale time, falling back to the product's purchase price).
export type SaleItemDetailRow = SaleItemRow & {
  product_name: string;
  product_sku: string;
  product_category: string;
  effective_cost?: number;
};

export interface DiscountRow {
  id: number;
  product_id: number;
  discounted_price: number;
  start_date: string;
  end_date: string;
  status: DiscountStatus;
  reason: string | null;
  created_at: string;
}

// product_discounts joined with products plus aggregated units sold
// (discount history list and export).
export type DiscountHistoryRow = DiscountRow & {
  product_name: string;
  product_sku: string;
  normal_price: number;
  units_sold: number;
};

export interface ProfitTargetRow {
  id: number;
  target_amount: number;
  period: string;
  period_days: number;
  created_at: string;
  updated_at: string;
}

export type NotificationAudience = "all" | "admin";

export interface NotificationRow {
  id: number;
  type: string;
  message: string;
  params: string | null;
  audience: NotificationAudience;
  read: number;
  created_at: string;
}
