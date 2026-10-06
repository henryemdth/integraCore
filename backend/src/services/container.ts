import { getAdapter } from "../db/index.js";
import { config } from "../config.js";
import { authService } from "./authService.js";
import { productService } from "./productService.js";
import { saleService } from "./saleService.js";
import { userService } from "./userService.js";
import { profitService } from "./profitService.js";
import { discountService } from "./discountService.js";
import { dashboardService } from "./dashboardService.js";
import { backupService } from "./backupService.js";

// Services are stateless closures over the database adapter, which is itself a
// process-wide singleton whose object identity survives a restore
// (replaceAdapter swaps the connection inside the same SqliteAdapter). Each
// service is therefore instantiated once, lazily on first use, instead of once
// per HTTP request. Unit tests bypass this container and call the service
// factories directly with their own adapter.
export interface Services {
  auth: ReturnType<typeof authService>;
  products: ReturnType<typeof productService>;
  sales: ReturnType<typeof saleService>;
  users: ReturnType<typeof userService>;
  profit: ReturnType<typeof profitService>;
  discounts: ReturnType<typeof discountService>;
  dashboard: ReturnType<typeof dashboardService>;
  backup: ReturnType<typeof backupService>;
}

let cached: Services | null = null;

export function getServices(): Services {
  if (!cached) {
    cached = {
      auth: authService(getAdapter()),
      products: productService(getAdapter()),
      sales: saleService(getAdapter()),
      users: userService(getAdapter()),
      profit: profitService(getAdapter()),
      discounts: discountService(getAdapter()),
      dashboard: dashboardService(getAdapter()),
      backup: backupService(getAdapter(), config.dataDir),
    };
  }
  return cached;
}
