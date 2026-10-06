# integraCore — Improvement Tracker

Tracking file for the improvement tasks identified in [REPORT.md](./REPORT.md) (Architecture Review, 2026-10-05).
Statuses below are **verified against the codebase** (2026-10-06), not copied from the report's claims — the report's summary matrix was corrected where it was wrong (see item 3.3).

**Last updated**: 2026-10-06 (Phase 1 completed; every item re-checked against the proposed solution in REPORT.md — proposal → implementation mapping and any deviation recorded per row below)

## Status legend

| Icon | Meaning |
|---|---|
| ⬜ | **Pending** — issue confirmed in the code; evidence points at where it lives |
| 🟡 | **Partial** — some of the work already exists; notes list what's covered vs. missing |
| ✅ | **Done** — completed; evidence points at the proof (fix / test), with date |
| 🚫 | **Skipped** — decided against; one-line reason |

## How to update this file

1. When an item is completed: flip its **Status** to ✅, set the completion date, and replace the evidence with the **file:line of the fix** (or test names for 4.1). Partial items flip to ✅ only when the listed "missing" work is finished.
2. If an item is decided against, mark 🚫 with the reason instead of silently dropping it.
3. Update **Last updated** above and the progress summary below in the same edit.
4. Pending items keep their evidence pointing at the offending code, so re-verifying is a one-file check.

## Progress summary

| Phase | Done | Partial | Pending | Total |
|---|---|---|---|---|
| Phase 1 — Quick Wins | 5 | 0 | 0 | 5 |
| Phase 2 — Core Refactoring | 0 | 0 | 6 | 6 |
| Phase 3 — Strategic Architecture | 1 | 1 | 3 | 5 |
| Phase 4 — Long-Term Evolution | 0 | 2 | 3 | 5 |
| **Total** | **6** | **3** | **12** | **21** |

> Verification corrections vs. REPORT.md: 3.3 was already implemented (report wrongly listed it as a gap); 3.5, 4.1 and 4.4 are partially covered rather than fully missing.

---

## Phase 1 — Quick Wins (1–3 days)

| # | Improvement | Effort | Status | Evidence / Notes |
|---|---|---|---|---|
| 1.1 | Service re-instantiation on every request | 1h | ✅ Done (2026-10-06) | Report proposed Option A (lazy singletons) or Option B (service classes). **Implemented Option A, generalized**: `backend/src/services/container.ts` exposes `getServices()` — all 8 services instantiated once, lazily, bound to the adapter singleton (safe across restore: `replaceAdapter` swaps the connection inside the same adapter object). All 9 route files went from 2-line per-request boilerplate to 1 line, as the report's expected impact describes. Option B (classes) deliberately deferred: unit tests bind to the factory signatures, and class conversion folds naturally into 3.1's repository layer |
| 1.2 | N+1 queries in sales list | 2h | ✅ Done (2026-10-06) | **Implemented the report's proposed solution as written**: one batched `WHERE si.sale_id IN (${placeholders})` query + in-memory `Map` grouping — `getSaleItemsBatch()` in `backend/src/services/saleService.ts`; `list()` issues exactly the report's target of 2 constant queries per page (was 1+N; 51 at 50 sales/page). Extra: `getSaleItems()` (single-sale) is now a thin wrapper over the same SQL, so the column list lives in exactly one place; batch rows are ordered by `si.id` to preserve insertion order |
| 1.3 | `any` type proliferation in backend services | 4h | ✅ Done (2026-10-06) | **Implemented the report's proposal verbatim** — `backend/src/types/models.ts` row interfaces mirroring the schema (including every field of the report's example `ProductRow`) and `db.get<ProductRow>(...)` generics throughout the service layer. Went beyond it: `Pick<>` for partial selects; status/role columns typed with the `as const` unions from `@integracore/shared` (`ProductStatus`/`DiscountStatus`/`Role`); `NotificationAudience`; adapter boundary tightened to `params?: unknown[]` + generic `raw<T>()` (interface, SQLite and Postgres drivers); socket `SocketData` module augmentation; structural error shapes in errorHandler; cron layer typed. `as any` in backend/src: ~43 → 1 (exceljs `load()`, unnameable legacy .d.ts, documented inline). Residual: PG returns NUMERIC as strings; row types document the SQLite contract, coercion stays per-query (full fix belongs to 2.1) |
| 1.4 | Missing index on `sale_items.discount_id` | 15m | ✅ Done (2026-10-06) | SQL is exactly the report's proposed statement. **One deviation from the proposed placement**: the report says to add it to the `sqliteMigrations`/`postgresMigrations` arrays, but those base phases fail loud and run *before* the additive column phase — on a legacy DB that only receives `sale_items.discount_id` via `columnMigrations`, that would crash startup. The index therefore runs in the isolated post-column phase (`sqliteIndexMigrations` for SQLite; appended to `postgresColumnMigrations` after the ADD COLUMN for Postgres), safe for fresh and legacy databases alike |
| 1.5 | In-memory write lock has no TTL/safety valve | 1h | ✅ Done (2026-10-06) | **Implemented the report's proposed solution verbatim**: `lockedAt` timestamp + `LOCK_TIMEOUT_MS = 30_000`, `acquireWriteLock(): boolean` returning false when already held, stale locks self-expire on the next `isWriteLocked()` check. Caller updated: `backupService.restoreBackup` throws 409 `RESTORE_IN_PROGRESS` when the lock is held. The report's cloud note (pg_advisory_lock / locks table) is recorded in the lock's file header as the documented future path |

---

## Phase 2 — Core Refactoring (1–2 weeks)

| # | Improvement | Effort | Status | Evidence / Notes |
|---|---|---|---|---|
| 2.1 | Raw SQL not DB-portable (regex transform is the primary mechanism) | 3d | ⬜ Pending | Services write `datetime('now')` / `LIKE` directly (e.g. `saleService.ts:150,394`, `productService.ts:308`, `userService.ts:23`); runtime regex patching in `backend/src/db/postgres.ts:3,29,35,41`. No query-builder (`db.qb`) exists |
| 2.2 | No migration versioning system | 2d | ⬜ Pending | `backend/src/db/schema.ts` — `CREATE TABLE IF NOT EXISTS` + ad-hoc `ALTER TABLE` with try/catch only; no `schema_version` table, no sequential migration runner |
| 2.3 | Excel export loads all records into memory | 1d | ⬜ Pending | `backend/src/services/saleService.ts:223-327` — unbounded fetch of all sales (:240-246), N+1 items per sale (:281), in-memory `new ExcelJS.Workbook()` (:252); no streaming/chunking |
| 2.4 | No React error boundaries | 3h | ⬜ Pending | Zero hits for `ErrorBoundary` / `componentDidCatch` / `react-error-boundary` across `frontend/src` |
| 2.5 | No code-splitting / lazy loading | 2h | ⬜ Pending | `frontend/src/App.tsx:9-19` — all 9 page components eagerly imported; no `lazy()` / `Suspense` |
| 2.6 | Socket reconnects on user object identity | 30m | ⬜ Pending | `frontend/src/contexts/SocketContext.tsx:71` — effect deps `[user, backendUrl, queryClient, logout]`; `AuthContext` re-sets the user object (new identity) at :30, :38, :48 → spurious reconnects |

---

## Phase 3 — Strategic Architecture Improvements (2–4 weeks)

| # | Improvement | Effort | Status | Evidence / Notes |
|---|---|---|---|---|
| 3.1 | No repository / data-access layer | 5d | ⬜ Pending | No `backend/src/repositories/` directory; raw SQL inline in services (e.g. `saleService.ts:143`, `userService.ts:23`, `productService.ts:51`) |
| 3.2 | Unstructured logging (`console.*`) | 1d | ⬜ Pending | No pino/winston in `backend/package.json`; 31 raw `console.log/error/warn` calls across `backend/src` |
| 3.3 | Rate limit authentication endpoints | 2h | ✅ Done (2026-10-06) | Already implemented before the review was written — `authRateLimiter` (express-rate-limit, 20 req / 15 min, env-tunable) is applied to `/login` (`backend/src/routes/auth.ts:26`) and `/setup` (`auth.ts:19`), matching the report's proposed solution. Residual, not tracked as a separate item: no *global* rate limiter on the API |
| 3.4 | Auth middleware queries DB on every request | 3h | ⬜ Pending | `backend/src/middleware/auth.ts:24-25` — `fetchUserProjection(db, decoded.id)` on every authenticated request; no cache/invalidation (deliberate tradeoff per inline comment) |
| 3.5 | No explicit DTOs (ad-hoc field stripping) | 2d | 🟡 Partial | Covered: explicit projection for users only (`backend/src/services/userProjection.ts`). Missing: DTO layer for products/sales — ad-hoc `stripPurchasePrice()` at `backend/src/routes/products.ts:16-18` and cost-field nulling at `saleService.ts:374-375` |

---

## Phase 4 — Long-Term Evolution (1–3 months)

| # | Improvement | Effort | Status | Evidence / Notes |
|---|---|---|---|---|
| 4.1 | Business-critical test coverage | 5d | 🟡 Partial | Covered: sale w/ active discount ✅ (`test/unit/services/saleService.test.ts:41` + `test/integration/discounts.test.ts`) · discount overlap ✅ (`discountService.test.ts:67` + integration overlap boundaries) · auth deactivated user ✅ (`auth.test.ts:77`) · Excel import ⚠️ only standard headers exercised (`productService.test.ts:289-331`; alias/reordered/positional header detection in `productService.ts:187-203` untested). Missing: backup export + WAL checkpoint ❌ · backup restore + rollback ❌ · profit cron notification dedup ❌ (no test for `backend/src/cron/profitCheck.ts` — the code has no dedup logic either) · stock-out race condition ❌ (no concurrency tests anywhere) |
| 4.2 | Request correlation IDs | 1d | ⬜ Pending | No `correlationId` / `x-correlation-id` anywhere in backend or frontend; `backend/src/middleware/errorHandler.ts:10-13` returns no ID; `frontend/src/lib/api.ts:64-73` interceptor doesn't capture one |
| 4.3 | API versioning (`/api/v1/`) | 1d | ⬜ Pending | `backend/src/app.ts:30-39` mounts all routes at bare `/api/*`; no version prefix logic anywhere |
| 4.4 | Frontend offline resilience | 5d | 🟡 Partial | Covered: socket disconnect banner (`frontend/src/components/Layout.tsx:32-35` via `connected` from `SocketContext`). Missing: query persistence (`@tanstack/query-persist-client` not in `frontend/package.json`) · offline sale queue in localStorage · re-sync on reconnect |
| 4.5 | Postgres pool hardening + deep health check | 3h | ⬜ Pending | `backend/src/db/postgres.ts:18-26` — pool config lacks `idleTimeoutMillis`, `connectionTimeoutMillis`, and an `on('error')` handler; `/api/health` (`app.ts:26-28`) returns a static OK with no DB ping |
