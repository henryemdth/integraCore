import { z } from "zod";

// ─── Date Helpers ─────────────────────────────────────────────────────
// Discount ranges are stored as full-day wall-clock timestamps (local time):
//   start_date = "YYYY-MM-DD 00:00:00.000"
//   end_date   = "YYYY-MM-DD 23:59:59.999"
// All comparisons use the same YYYY-MM-DD HH:MM:SS.SSS format so a plain
// lexicographic string compare behaves as chronological ordering. Centralized
// here so backend (Node) and frontend (browser) always agree on "today".

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD (no time component). */
export function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local now as YYYY-MM-DD HH:MM:SS.SSS (full instant). */
export function nowString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

/** Expands a YYYY-MM-DD date to the first instant of that day (inclusive). */
export function startOfDay(dateStr: string): string {
  return `${dateStr} 00:00:00.000`;
}

/** Expands a YYYY-MM-DD date to the last instant of that day (inclusive). */
export function endOfDay(dateStr: string): string {
  return `${dateStr} 23:59:59.999`;
}

/** Returns the day after the given YYYY-MM-DD date, also YYYY-MM-DD. */
export function nextDayDateString(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// ─── Entity Interfaces ────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "user";
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  price: number;
  sell_price: number;
  stock: number;
  low_stock_threshold: number;
  status: "active" | "discontinued";
  created_at: string;
  updated_at: string;
  discounted_price?: number | null;
  discount_end_date?: string | null;
}

export interface SaleItemDetail {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_id: number | null;
  original_price: number;
}

export interface SaleDetail {
  id: number;
  user_id: number;
  seller_name: string;
  total: number;
  notes: string;
  created_at: string;
  items: SaleItemDetail[];
}

export interface ProductDiscount {
  id: number;
  product_id: number;
  discounted_price: number;
  start_date: string;
  end_date: string;
  reason: string;
  status: "active" | "cancelled";
  product_name?: string;
  product_sku?: string;
  normal_price?: number;
  created_at: string;
}

// ─── Zod Validation Schemas ───────────────────────────────────────────

export const LoginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const RegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["admin", "user"]).optional().default("user"),
});

export const SetupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Full name is required"),
});

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
});

export const AdminResetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().optional().default(""),
  price: z.number().min(0, "Price must be >= 0"),
  sell_price: z.number().min(0, "Sell price must be >= 0"),
  stock: z.number().int().min(0).optional().default(0),
  low_stock_threshold: z.number().int().min(0).optional().default(5),
  status: z.enum(["active", "discontinued"]).optional().default("active"),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  category: z.string().optional(),
  price: z.number().min(0).optional(),
  sell_price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  status: z.enum(["active", "discontinued"]).optional(),
});

export const StockMovementSchema = z.object({
  quantity: z.number().int().min(1, "Quantity must be > 0"),
  notes: z.string().optional(),
});

const CreateSaleItemSchema = z.object({
  product_id: z.number().int().positive("product_id is required"),
  quantity: z.number().int().min(1, "Quantity must be >= 1"),
});

export const CreateSaleSchema = z.object({
  items: z.array(CreateSaleItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  role: z.enum(["admin", "user"]).optional(),
});

export const CreateDiscountSchema = z.object({
  discounted_price: z.number().min(0, "Discounted price must be >= 0"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD format"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD format"),
  reason: z.string().optional().default(""),
}).refine((d) => d.start_date <= d.end_date, {
  message: "start_date must be on or before end_date",
  path: ["end_date"],
});
