import i18n from "@/i18n"

// Maps backend error codes (AppError.code, sent in the JSON error body) to
// i18n keys so users see every server-side message in their selected language.
// The backend's English `error` string remains the developer-facing fallback
// for any code that has no entry here.
const CODE_KEYS: Record<string, string> = {
  // auth
  INVALID_CREDENTIALS: "errors.invalidCredentials",
  ACCOUNT_DEACTIVATED: "errors.accountDeactivated",
  USERNAME_EXISTS: "errors.usernameExists",
  SETUP_ALREADY_COMPLETED: "errors.setupAlreadyCompleted",
  CURRENT_PASSWORD_INCORRECT: "errors.currentPasswordIncorrect",
  RATE_LIMITED: "errors.rateLimited",
  INSUFFICIENT_PERMISSIONS: "errors.insufficientPermissions",
  VALIDATION_FAILED: "errors.validationFailed",
  NO_FILE: "errors.noFile",
  INVALID_ID: "errors.invalidId",
  // users
  USER_NOT_FOUND: "errors.userNotFound",
  CANNOT_CHANGE_OWN_ROLE: "errors.cannotChangeOwnRole",
  CANNOT_DEACTIVATE_SELF: "errors.cannotDeactivateSelf",
  LAST_ACTIVE_ADMIN: "errors.lastActiveAdmin",
  ROLE_INVALID: "errors.roleInvalid",
  // products
  PRODUCT_NOT_FOUND: "errors.productNotFound",
  SKU_EXISTS: "errors.skuExists",
  PRODUCT_HAS_SALES: "errors.productHasSales",
  INSUFFICIENT_STOCK: "errors.insufficientStock",
  PRODUCT_DISCONTINUED: "errors.productDiscontinued",
  NO_WORKSHEET: "errors.noWorksheet",
  // sales
  SALE_NOT_FOUND: "errors.saleNotFound",
  // discounts
  DISCOUNT_NOT_FOUND: "errors.discountNotFound",
  DISCOUNT_ALREADY_CANCELLED: "errors.discountAlreadyCancelled",
  DISCOUNT_PRICE_ABOVE_SELL: "errors.discountPriceAboveSell",
  DISCOUNT_DISCONTINUED: "errors.discountDiscontinued",
  DISCOUNT_OVERLAP: "errors.discountOverlap",
  DISCOUNT_HAS_SALES: "errors.discountHasSales",
  // backup
  INVALID_SQLITE_FILE: "errors.invalidSqliteFile",
  INVALID_DB_SCHEMA: "errors.invalidDbSchema",
  RESTORE_FAILED: "errors.restoreFailed",
  RESTORE_FAILED_CRITICAL: "errors.restoreFailedCritical",
}

/**
 * Resolves the user-facing message for an error in the selected language.
 *
 * - Axios errors: uses the backend `code` → i18n key (with `params`
 *   interpolation) when known; otherwise falls back to the raw backend
 *   message; otherwise the caller's fallback key. Axios's own English
 *   `err.message` ("Network Error", "Request failed with status…") is never
 *   surfaced.
 * - Plain Errors (client-side validation thrown before the request): the
 *   message is already translated at the throw site — used as-is.
 */
export function getErrorMessage(err: unknown, fallbackKey = "common.unexpectedError"): string {
  const e = err as { isAxiosError?: boolean; response?: { data?: { code?: string; error?: string; params?: Record<string, string | number> } }; message?: string }

  if (e?.isAxiosError || e?.response) {
    const data = e.response?.data
    if (data?.code && CODE_KEYS[data.code]) {
      return i18n.t(CODE_KEYS[data.code], { defaultValue: data.error, ...data.params })
    }
    if (data?.error) return data.error
    return i18n.t(fallbackKey)
  }

  if (e?.message) return e.message
  return i18n.t(fallbackKey)
}

// Excel-import per-row error codes (productService.importFromExcel) → i18n keys.
const IMPORT_ROW_CODE_KEYS: Record<string, string> = {
  MISSING_NAME: "errors.importRow.missingName",
  MISSING_SKU: "errors.importRow.missingSku",
  INVALID_PRICE: "errors.importRow.invalidPrice",
  INVALID_SELL_PRICE: "errors.importRow.invalidSellPrice",
  DUPLICATE_SKU_FILE: "errors.importRow.duplicateSkuFile",
  INVALID_STATUS: "errors.importRow.invalidStatus",
  SKU_EXISTS_DB: "errors.importRow.skuExistsDb",
}

/** Localized text for one Excel-import row error; falls back to the raw backend message. */
export function getImportRowError(row: { code?: string; error: string }): string {
  if (row.code && IMPORT_ROW_CODE_KEYS[row.code]) {
    return i18n.t(IMPORT_ROW_CODE_KEYS[row.code])
  }
  return row.error
}
