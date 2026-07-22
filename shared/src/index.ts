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
  stock: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: number;
  user_id: number;
  total: number;
  notes: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface ProfitTarget {
  id: number;
  target_amount: number;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  read: number;
  created_at: string;
}

export interface CreateProductDto {
  name: string;
  sku: string;
  category?: string;
  price: number;
  stock?: number;
  low_stock_threshold?: number;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  category?: string;
  price?: number;
  stock?: number;
  low_stock_threshold?: number;
}

export interface CreateSaleDto {
  items: { product_id: number; quantity: number }[];
  notes?: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  full_name: string;
  role?: "admin" | "user";
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StockMovementDto {
  quantity: number;
  notes?: string;
}

export interface ImportResult {
  imported: number;
  errors: { row: number; sku: string; error: string }[];
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

export interface SaleListResponse {
  sales: SaleDetail[];
  total: number;
  page: number;
  totalPages: number;
}

export interface FilterSalesDto {
  user_id?: number;
  date_from?: string;
  date_to?: string;
  product_id?: number;
  page?: number;
  limit?: number;
}

export interface UpdateUserDto {
  full_name?: string;
  role?: "admin" | "user";
}

export interface AdminResetPasswordDto {
  password: string;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
}
