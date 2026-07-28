import { z } from "zod";

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
}

export interface SaleItemDetail {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
