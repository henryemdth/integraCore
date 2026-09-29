/**
 * Central registry of React Query keys.
 *
 * Every key here reproduces the literal array it replaced, so cache identity is
 * unchanged. The point is to remove the hand-written shapes scattered across
 * the pages: a typo in a literal silently creates a second cache entry that
 * never invalidates, and nothing catches it at compile time.
 *
 * Convention: `all` is the prefix used for invalidation (`["products"]` matches
 * every key that starts with `"products"`), and the more specific keys are
 * built from it so the prefix relationship is explicit.
 */
export const queryKeys = {
  products: {
    /** Invalidates every products query (list, categories, list-all, detail). */
    all: ["products"] as const,
    list: (params: Record<string, string>) => ["products", params] as const,
    categories: ["products", "categories"] as const,
    listAll: ["products", "list-all"] as const,
    detail: (id: number) => ["products", "detail", id] as const,
  },
  sales: {
    all: ["sales"] as const,
    list: (params: Record<string, string>) => ["sales", params] as const,
    stats: (params: Record<string, string>) => ["sales", "stats", params] as const,
  },
  users: {
    all: ["users"] as const,
    list: (params: Record<string, string>) => ["users", params] as const,
    listAll: ["users", "list-all"] as const,
    /** Options for filter dropdowns (small projection, no pagination). */
    options: ["users", "options"] as const,
  },
  discounts: {
    all: ["discounts"] as const,
    list: (params: Record<string, string>) => ["discounts", params] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
    list: (unreadOnly: boolean) => ["notifications", { unreadOnly }] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: ["dashboard", "summary"] as const,
  },
  system: {
    all: ["system"] as const,
    info: ["system", "info"] as const,
  },
  profit: {
    all: ["profit"] as const,
    target: ["profit", "target"] as const,
    check: ["profit", "check"] as const,
  },
  auth: {
    all: ["auth"] as const,
    setupStatus: ["auth", "setup-status"] as const,
  },
} as const
