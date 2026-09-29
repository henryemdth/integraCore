// ─── Report i18n ──────────────────────────────────────────────────────
// Label dictionaries for the Excel exports. Lives in shared/ so the backend
// renders reports in the requesting user's language with the same vocabulary
// the UI uses (single source of truth, same principle as the date helpers).
//
// Only rendered text is translated (headers, summary labels, Yes/No, status
// strings). Database values are never rewritten, and reports are not import
// templates, so translated status cells cannot break the Excel import.

export const REPORT_LANGUAGES = ["en", "es"] as const;
export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];

export const DEFAULT_REPORT_LANGUAGE: ReportLanguage = "en";

export interface ReportLabels {
  // Worksheet tabs
  sheetSales: string;
  sheetProducts: string;
  sheetDiscountHistory: string;

  // Shared vocabulary
  id: string;
  name: string;
  sku: string;
  category: string;
  product: string;
  status: string;
  active: string;
  discontinued: string;
  cancelled: string;
  yes: string;
  no: string;
  date: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  total: string;

  // Sales report
  saleId: string;
  seller: string;
  quantity: string;
  unitPrice: string;
  unitPriceNormal: string;
  unitCost: string;
  discountApplied: string;
  savings: string;
  subtotal: string;
  profit: string;
  totalSales: string;
  totalRevenue: string;
  totalCost: string;
  totalProfit: string;
  totalSavings: string;
  withDiscount: string;
  withoutDiscount: string;

  // Products report
  purchasePrice: string;
  sellPrice: string;
  effectivePrice: string;
  hasDiscount: string;
  discountEndDate: string;
  stock: string;
  lowStockThreshold: string;

  // Discount history report
  normalPrice: string;
  discountedPrice: string;
  pctDiscount: string;
  unitsSold: string;
  worked: string;
  reason: string;
}

export const reportLabels: Record<ReportLanguage, ReportLabels> = {
  en: {
    sheetSales: "Sales",
    sheetProducts: "Products",
    sheetDiscountHistory: "Discount History",

    id: "ID",
    name: "Name",
    sku: "SKU",
    category: "Category",
    product: "Product",
    status: "Status",
    active: "Active",
    discontinued: "Discontinued",
    cancelled: "Cancelled",
    yes: "Yes",
    no: "No",
    date: "Date",
    startDate: "Start Date",
    endDate: "End Date",
    createdAt: "Created At",
    updatedAt: "Updated At",
    notes: "Notes",
    total: "Total",

    saleId: "Sale ID",
    seller: "Seller",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    unitPriceNormal: "Unit Price (Normal)",
    unitCost: "Unit Cost",
    discountApplied: "Discount Applied?",
    savings: "Savings",
    subtotal: "Subtotal",
    profit: "Profit",
    totalSales: "Total Sales",
    totalRevenue: "Total Revenue",
    totalCost: "Total Cost",
    totalProfit: "Total Profit",
    totalSavings: "Total Savings",
    withDiscount: "With Discount",
    withoutDiscount: "Without Discount",

    purchasePrice: "Purchase Price",
    sellPrice: "Sell Price",
    effectivePrice: "Effective Price",
    hasDiscount: "Has Discount",
    discountEndDate: "Discount End Date",
    stock: "Stock",
    lowStockThreshold: "Low Stock Threshold",

    normalPrice: "Normal Price",
    discountedPrice: "Discounted Price",
    pctDiscount: "% Discount",
    unitsSold: "Units Sold",
    worked: "Worked?",
    reason: "Reason",
  },
  es: {
    sheetSales: "Ventas",
    sheetProducts: "Productos",
    sheetDiscountHistory: "Historial de descuentos",

    id: "ID",
    name: "Nombre",
    sku: "SKU",
    category: "Categoría",
    product: "Producto",
    status: "Estado",
    active: "Activo",
    discontinued: "Descontinuado",
    cancelled: "Cancelado",
    yes: "Sí",
    no: "No",
    date: "Fecha",
    startDate: "Fecha de inicio",
    endDate: "Fecha de fin",
    createdAt: "Fecha de creación",
    updatedAt: "Fecha de actualización",
    notes: "Notas",
    total: "Total",

    saleId: "ID de venta",
    seller: "Vendedor",
    quantity: "Cantidad",
    unitPrice: "Precio unitario",
    unitPriceNormal: "Precio normal",
    unitCost: "Costo unitario",
    discountApplied: "¿Descuento aplicado?",
    savings: "Ahorro",
    subtotal: "Subtotal",
    profit: "Ganancia",
    totalSales: "Total ventas",
    totalRevenue: "Ingresos totales",
    totalCost: "Costo total",
    totalProfit: "Ganancia total",
    totalSavings: "Ahorro total",
    withDiscount: "Con descuento",
    withoutDiscount: "Sin descuento",

    purchasePrice: "Precio de compra",
    sellPrice: "Precio de venta",
    effectivePrice: "Precio efectivo",
    hasDiscount: "¿Tiene descuento?",
    discountEndDate: "Fin de descuento",
    stock: "Stock",
    lowStockThreshold: "Umbral de stock bajo",

    normalPrice: "Precio normal",
    discountedPrice: "Precio con descuento",
    pctDiscount: "% Descuento",
    unitsSold: "Unidades vendidas",
    worked: "¿Funcionó?",
    reason: "Motivo",
  },
};

/**
 * Resolves a request-provided language tag to a supported report language.
 * Exact match first ("es"), then language-range prefix ("es-MX" → "es"),
 * falling back to English so unknown or missing values degrade safely.
 */
export function resolveReportLanguage(lang?: string | null): ReportLanguage {
  if (!lang) return DEFAULT_REPORT_LANGUAGE;
  const lower = lang.toLowerCase();
  if ((REPORT_LANGUAGES as readonly string[]).includes(lower)) {
    return lower as ReportLanguage;
  }
  const prefixMatch = REPORT_LANGUAGES.find((l) => lower.startsWith(`${l}-`));
  return prefixMatch ?? DEFAULT_REPORT_LANGUAGE;
}

// ─── Excel Import Vocabulary ──────────────────────────────────────────
// The product import is language-agnostic: it understands the union of every
// supported language's vocabulary (derived from the same report labels the
// exports emit, so a new language extends both at once), never just the
// importer's UI language. A file's language and the user's UI language are
// independent — neither can break the other.

export type ImportProductField =
  | "name"
  | "sku"
  | "category"
  | "price"
  | "sellPrice"
  | "stock"
  | "lowStockThreshold"
  | "status";

/**
 * Normalizes a header/status word for matching: lowercase, strip diacritics
 * ("Categoría" → "categoria"), drop decorative punctuation (*, ¿?, !) and
 * collapse whitespace.
 */
export function normalizeHeaderToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!*_.]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const importFieldLabel: Record<ImportProductField, (labels: ReportLabels) => string> = {
  name: (l) => l.name,
  sku: (l) => l.sku,
  category: (l) => l.category,
  price: (l) => l.purchasePrice,
  sellPrice: (l) => l.sellPrice,
  stock: (l) => l.stock,
  lowStockThreshold: (l) => l.lowStockThreshold,
  status: (l) => l.status,
};

// Hand-written files often shorten the canonical headers: "Precio" /
// "Price" for the purchase price, "Umbral" for the stock threshold. The
// price field is the only place a cross-language alias is needed ("price"
// vs "precio"); exact token matching keeps "Sell Price"/"Precio de venta"
// from ever colliding with them.
const importColumnExtras: Partial<Record<ImportProductField, string[]>> = {
  price: ["precio", "price"],
  lowStockThreshold: ["umbral"],
};

/** Accepted header tokens per import field, across every supported language. */
export function buildImportColumnAliases(): Record<ImportProductField, string[]> {
  const aliases = {
    name: [], sku: [], category: [], price: [], sellPrice: [], stock: [], lowStockThreshold: [], status: [],
  } as Record<ImportProductField, string[]>;
  for (const field of Object.keys(importFieldLabel) as ImportProductField[]) {
    for (const lang of REPORT_LANGUAGES) {
      aliases[field].push(normalizeHeaderToken(importFieldLabel[field](reportLabels[lang])));
    }
    for (const extra of importColumnExtras[field] ?? []) {
      aliases[field].push(normalizeHeaderToken(extra));
    }
  }
  return aliases;
}

/**
 * Maps a status cell to its canonical value by matching the word in any
 * supported language ("active"/"activo", "discontinued"/"descontinuado").
 * Returns null for unrecognized values (empty handled by the caller).
 */
export function resolveImportStatus(value: string): "active" | "discontinued" | null {
  const token = normalizeHeaderToken(value);
  if (!token) return null;
  for (const lang of REPORT_LANGUAGES) {
    if (token === normalizeHeaderToken(reportLabels[lang].active)) return "active";
    if (token === normalizeHeaderToken(reportLabels[lang].discontinued)) return "discontinued";
  }
  return null;
}

/** The import template's columns, in order, with headers in the given language. */
export function importTemplateHeaders(lang: ReportLanguage): { field: ImportProductField; header: string }[] {
  const l = reportLabels[lang];
  return [
    { field: "name", header: l.name },
    { field: "sku", header: l.sku },
    { field: "category", header: l.category },
    { field: "price", header: l.purchasePrice },
    { field: "sellPrice", header: l.sellPrice },
    { field: "stock", header: l.stock },
    { field: "lowStockThreshold", header: l.lowStockThreshold },
    { field: "status", header: l.status },
  ];
}
