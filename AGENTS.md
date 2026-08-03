# AGENTS.md — Local Inventory & Sales Management System

## Project Overview

A desktop application for a single-owner business (unipersonal) to manage inventory and sales, running fully local on a private network with no internet dependency. No electronic invoicing (facturación) is required. The system is distributed as two separate Windows executables — one for the server machine, one for client machines — with no external dependencies to install.

The architecture must allow future expansion to a cloud-based backend without rewriting the core logic (only changing where the backend server lives — local machine vs. cloud host).

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React | UI components, tables, forms, dashboards |
| Desktop packaging | Electron + Electron Builder | Produces two Windows `.exe` installers — Server and Client — from two build configs, Node.js embedded, no separate install needed |
| Backend | Node.js + Express | Runs as a local server; same code can later run in the cloud |
| Database | SQLite | Single-file, embedded, no separate database server to install |
| LAN communication | REST API over local network (HTTP) | Other machines connect to the "server" machine's local IP; no other machine needs its own DB engine |
| Excel export/import | `exceljs` or `xlsx` (Node.js library) | Used for both exporting reports and importing bulk product data |
| Scheduled checks | `node-cron` | Used for periodic profit-threshold checks |
| Real-time updates | `socket.io` (WebSockets) | Pushes live updates to all connected machines when critical data changes (see "Real-Time Updates" below) |

---

## Functional Requirements

### 1. Inventory Module
- Product registration (name, code/SKU, category, price, current stock)
- Stock in (restocking/purchases)
- Stock out (sales-driven or manual adjustment)
- Low-stock alerts (configurable threshold per product)
- Bulk product import from Excel
- Export current inventory to Excel
- **Product status**: each product has a `status` field — `active` (default) or `discontinued`
  - Since products cannot be deleted (sales history references them), setting stock to 0 is not sufficient to signal "I no longer intend to restock this."
  - Low-stock alerts must only be generated for products with `status: active`. A `discontinued` product sitting at 0 stock must not keep re-triggering alerts.
  - The Admin can toggle a product between `active` and `discontinued` at any time; reactivating a product resumes normal low-stock alerting.
  - Discontinued products remain visible in inventory (e.g., visually de-emphasized or in a separate filter/tab), since they still matter for sales history and reporting — they are hidden from alerts only, not from the system.

### 2. Sales Module
- Register sales, automatically decrementing stock
- Sales history log (date, product, quantity, price, seller/user, total)
- Filter sales by:
  - Seller/user (who made the sale)
  - Date range
  - Product
- Export sales reports to Excel

### 3. User Roles & Authentication
- Two roles: **Admin** and **User** (seller)
- Admin permissions: full access — manage products, view all reports, manage users, configure profit targets, delete/edit records
- User permissions: register sales, view own sales history — no access to deleting records, user management, or profit configuration
- Login required per user (local authentication, no external identity provider)

### 4. Profit Notification
- Admin can configure a **monthly target amount** (or other period, as configured) representing expected profit
- The system periodically checks actual profit against this configured target
- If actual profit falls short of the target within the configured time window, trigger a notification (in-app alert; email optional/future)
- Admin can edit/update the target amount at any time

### 5. Excel Import/Export
- **Export**: inventory report, sales report (with filters applied) to `.xlsx`
- **Import**: bulk product upload via `.xlsx` template (validate format, handle errors gracefully — e.g., duplicate SKUs, missing required fields)

### 6. Real-Time Updates (WebSockets)
- When the Admin changes a **product price** or **stock quantity**, all connected User machines must reflect the change immediately, without needing to manually refresh the screen.
- Implemented via `socket.io`: the server pushes an update event to all connected clients as soon as the change is saved to the database.
- Scope of real-time updates: **prices and stock levels** (critical, money-affecting data).
- Non-critical screens (e.g., historical reports) can continue to use a simple "fetch on load" pattern — they do not require real-time push updates.
- Goal: prevent a User from selling a product at an outdated price after the Admin has already updated it.

### 7. Local Network (LAN) Communication & Server/Client Installers
- The application is distributed as **two separate Windows installers**, built from the same codebase:
  - **Server installer**: installs and runs the Node.js/Express backend plus the embedded SQLite database on this machine.
  - **Client installer**: installs only the frontend — no backend or SQLite included. It connects to the server machine's local IP address over HTTP (REST API); no database engine required on client machines.
- A machine's role (server or client) is determined by which installer was run — there is no in-app "designate as server or client" step to choose between them.
- The server machine's local IP is configured when installing a Client, and remains editable afterward (e.g., from an in-app setting), so a later change to the server's IP doesn't require reinstalling the Client.
- No internet connection required for any of this to function.

### 8. Initial Setup Screen (Server installer, first run)
- Applies only to the Server installer. The Client installer never shows a setup screen — it always opens straight to the login screen, since it holds no data of its own.
- **Works with both backend database drivers** — the gate applies identically whether `DB_DRIVER` is `sqlite` (local/server) or `postgresql` (cloud/web). The setup screen must appear in both cases under the same condition (empty `users` table).
- **Gate condition**: on startup, the backend checks whether the `users` table has any rows.
  - **Empty** → the app opens the `/setup` screen instead of `/login`.
  - **Not empty** → skip straight to `/login` as normal.
- The gate check must be database-agnostic (e.g., `SELECT 1 FROM users LIMIT 1` existence check, not a `COUNT(*)` strict-equality comparison). The PostgreSQL driver returns `COUNT(*)` as a string, so a comparison like `count === 0` silently reports `needsSetup: false` on a Postgres backend even with an empty `users` table — the setup screen would never appear.
- **`/setup` screen flow**:
  1. Choose a starting point: **"Start fresh"** or **"Restore from an existing backup"**.
  2. **Start fresh** → form to create the initial Admin account:
     - `username` (must be unique — enforced by the existing `UNIQUE` constraint; show a clear error on collision, though on a first-run empty table this only matters for retries)
     - `full_name`
     - `password` + confirm password (hashed server-side into `password_hash`; the plaintext password is never stored or logged)
     - `role` is not a field on this form — it is hardcoded to the Admin role for this first account, never left to the user to pick.
     - `active` is not shown — it uses its existing default (enabled).
     - On submit, the backend runs any pending migrations if needed, inserts this row, and redirects to `/login`.
  3. **Restore from an existing backup** → upload a `.sqlite` file:
     - SQLite-only option. When the backend runs on `postgresql` (cloud/web), the restore option is hidden on the setup screen (it can only swap the embedded SQLite file); the "Start fresh" path remains the only option. Cloud backups are handled at the hosting level per section 9.
     - Validate it's a real SQLite file with the expected schema (has a `users` table with the expected columns, etc.); reject with a clear message and return to step 1 if invalid.
     - If valid, swap it in as the active database, then re-run the same gate check against the restored data:
       - If it already contains users → go straight to `/login` (the normal case for a real backup).
       - If it somehow contains zero users → fall back to step 2 ("Start fresh") so the system is never left with no way to log in.

### 9. Database Backup & Restore (Admin, Server installer only)
- Applies only to the Server installer (SQLite). Not applicable to the Client installer or to the Cloud/web deployment — cloud backups are handled at the hosting/infra level (Render/Neon), outside this app.

- **Export (backup)**:
  - Available to the Admin from the dashboard, on the server machine.
  - Before copying the file, run a WAL checkpoint (`PRAGMA wal_checkpoint(FULL)`) to ensure all committed writes are consolidated into the main `.sqlite` file, avoiding an incomplete backup if writes are still pending in the `-wal` file.
  - Served as a downloadable file named with the current date, e.g. `backup-2026-07-29.sqlite`.

- **Restore from backup**: available in **two places**, both destructive operations requiring the same safeguards:
  1. **Initial Setup Screen** (see section 8 above) — used when setting up a new/replacement server machine.
  2. **Admin dashboard**, on the running server — used to revert the current database without reinstalling.
  - **Required safeguards for both paths**:
    - Explicit warning before proceeding, stating plainly that **all current data (products, sales, users, discounts) will be replaced** and this cannot be undone.
    - An automatic backup of the current database is taken before the swap, in case the uploaded file is wrong or corrupted.
    - The uploaded file is validated (valid SQLite + expected schema) before being accepted; reject with a clear explanation if invalid, never a silent failure.
    - Writes are temporarily blocked during the swap (reject in-flight sales/changes for the few seconds the operation takes) to avoid race conditions.
    - After the swap completes, the backend emits a `db:restored` event via `socket.io` to all connected clients. Unlike the price/stock real-time update (which only refreshes those two values), this event tells every connected client to fully reload/re-fetch all data, since everything may have changed.

- **Schema compatibility across app versions**: explicitly deferred for this MVP (see Explicitly Out of Scope). No automated migration handling is built now; restoring a backup taken on a different app version is a manual/best-effort process for this phase.

### 10. Promotional Pricing (Temporary Discounts)
- The Admin can apply a **temporary discount** to a product: a discounted price valid only within a specific date range (e.g., "Product Z at $23 from July 1 to July 7").
- Discounts are stored as a **full history**, not just "the current discount" — every discount ever applied to a product is kept as its own record (product, discounted price, start date, end date, and optionally a reason/note). Applying a new discount never overwrites or deletes a previous one.
- **No overlapping discounts** are allowed for the same product — overlap check is inclusive on both ends (if discount A ends 07/07, a new discount starting 07/07 for the same product conflicts). The system must reject creating a new discount whose date range overlaps with an existing active/cancelled-with-sales one for that product, to avoid ambiguity about which price applies on a given day.
- **UI placement**: discount creation/management is a dialog opened from the product list row actions (e.g., a "Set discount" action in the row's dropdown menu) — not a separate page or a tab inside the product edit form.
- **Price resolution at sale time**: when a sale is registered, the system checks whether today's date falls within an active discount range for that product; if so, the discounted price is used as `unit_price` for that sale item — otherwise, the normal price is used. This calculated price is what gets frozen into the sale record (consistent with the existing rule that `sale_items.unit_price` always reflects the actual price charged, never a live reference to the product's current price).
  - `sale_items` also stores `discount_id` (nullable FK to the discount used, NULL if none) and `original_price` (the product's normal price at the time of sale, so the sale detail can always show a "was X, sold at Y" comparison regardless of what happens to the discount or product afterward).
- **Real-time updates**: when a discount becomes active or expires (date-based, not just a manual Admin action), connected clients must reflect the updated effective price — this extends the existing real-time price/stock update requirement (see "Real-Time Updates" section) to also cover date-triggered price changes, not only manually-edited ones.
- **Canceling vs. deleting a discount**:
  - A discount has a `status`: `active` or `cancelled`.
  - If a discount has **zero sales** associated with it (e.g., the Admin made a typo in the discount price and no one has bought at that price yet), it can be **deleted outright** — no trace needs to remain.
  - If a discount **already has one or more sales** associated with it, it **cannot be deleted** — it must instead be **cancelled** (sets `status: cancelled`, stops applying immediately, but the record and its linked sales remain intact for history/reporting).
  - Attempting to delete a discount with existing sales must be blocked with a clear explanation (e.g., "This discount can't be deleted because it already has sales. Cancel it instead to stop it from applying going forward.") — never a silent failure or a generic error.
  - A `cancelled` discount does not count as active for the overlap-check rule — the Admin can create a new, corrected discount over the same or overlapping dates once the faulty one is cancelled.
- **Sale summary / sale detail UI**: when a sale includes multiple products, each product with a discount shows its own discount indicator (e.g., a percentage-off badge) and its normal price struck through next to the discounted price — independent per line item, since different products in the same sale may have different discounts (or none). The sale summary includes a total "savings from discounts" line, summing the difference between normal and discounted prices across all discounted items in that sale.
- **Inventory (Stock) export**: includes a summarized view per product — whether it currently has an active discount, the effective price today, and the discount's end date. It does NOT include the full discount history (see next point).
- **Sales export (monthly/filtered)**: the existing sales Excel report adds columns for **Unit Price at normal rate** (i.e., `original_price`) and **Discount applied? (Yes/No)**, alongside the existing columns (Sale ID, Date, Seller, Product, SKU, Quantity, Unit Price [price actually charged], Subtotal, Total). A summary row at the end of the sheet shows total sales, total savings from discounts, and count of sales with vs. without discount.
- **Discount history export**: a separate Excel report (or sheet) listing every discount ever applied — product, normal price, discounted price, % discount, date range, status (active/cancelled), units sold during that period, and whether it "worked" (generated sales) or not. This is for the Admin to evaluate which discounts were effective over time.
- Discontinued products (see Inventory Module, product status) can still have discount history, but new discounts should not be creatable for a `discontinued` product.

---

## Explicitly Out of Scope (for this version)

- Electronic invoicing (facturación electrónica) / tax authority integration
- Cloud hosting / remote access from outside the local network (architecture should allow this later, but it is **not** built now)
- Thermal printer / ticket printing integration
- Accounts receivable / credit sales
- Software licensing / anti-piracy protection (hardware ID, activation keys) — **deferred to a future phase**
- Multi-branch / multi-location management
- Automated schema migrations for SQLite databases across app versions (e.g., restoring a backup taken on an older version with a different schema) — **deferred to a future phase**; handled manually for this MVP

---

## Project Structure Notes

- Monorepo layout: `backend/` (Express API), `frontend/` (React UI), `electron/` (main process — backend process lifecycle on the server machine, autostart), `shared/` (cross-package utilities), `data/` (local SQLite file and generated backups on the server machine).
- The SQLite database file and all backup exports/imports (see "Database Backup & Restore") live under `data/` on the server machine — this is the path the export/restore logic reads from and writes to, and what gets swapped during a restore.
- `shared/` currently centralizes date formatting used by both backend and frontend. Since discount date ranges, sales timestamps, and the profit-notification period all depend on consistent date/time handling, any timezone decision (e.g., always store/compare in UTC, format for display in local time) should be implemented once here rather than duplicated per package.

---

## Architecture Notes for Maintainable / Swappable UI

- The visual design (theme, colors, layout, component styling) must be kept fully separate from business logic — no styling decisions hardcoded inside components that handle data or logic.
- Use a component-based UI approach (React components) with a centralized theme/style configuration (e.g., a single theme file, CSS variables, or a UI library's theming system such as Tailwind config or shadcn/ui theme tokens) so that colors, fonts, spacing, and layout can be changed globally without touching individual screens.
- Avoid inline styles scattered across the codebase; prefer reusable, swappable components (buttons, tables, forms, cards) so that if the client dislikes the look and feel, the design can be reworked or reskinned without rewriting the underlying functionality.
- Goal: if the client asks to change the visual design after seeing the first version, this should require restyling components/theme, not rebuilding features.

## Architecture Notes for Future Cloud Expansion

- Keep all business logic in the Express backend, not in the Electron/React frontend, so the same backend code can later be deployed to a cloud host with minimal changes.
- **Confirmed cloud targets (current test setup)**: frontend on Vercel, backend on Render, database on Neon (Postgres). This split matters specifically because of `socket.io`: Vercel's serverless functions don't hold persistent connections open and cannot run a WebSocket server, but the frontend there doesn't need to — it's just a static/SSR client. Render runs the backend as a long-lived process, which is what `socket.io` requires; this is why the backend must stay on a persistent-process host (Render or equivalent) and must not be moved to a serverless platform like Vercel functions.
- Client machines should only ever talk to the backend via HTTP/REST — never directly to the database — so that switching the backend's location (local IP → cloud URL) does not require changing client-side logic beyond a configuration value.
- SQLite is appropriate for the current scale (single business, 2–3 machines). If the business grows to require heavy concurrent writes across many machines, migrating to PostgreSQL is the recommended future path — this should be kept in mind when designing the data access layer (e.g., avoid SQLite-specific query syntax where avoidable).
- **No client-IP registry is needed for real-time updates.** WebSocket connections (via `socket.io`) are always initiated by the client toward the server, never the reverse. The server does not need to know or store client IPs to push updates — it simply broadcasts (`io.emit(...)`) to all currently connected sockets, which `socket.io` already tracks internally. This applies unchanged whether the server is a LAN machine or a cloud host; only the URL/protocol the client connects to changes (`ws://<lan-ip>` → `wss://<cloud-url>`).
- **Role (`server`/`client`) is fixed by which installer was run, not a stored runtime flag** — see "Local Network (LAN) Communication & Server/Client Installers". Cloud/local mode is a separate axis entirely: cloud is served exclusively through the web deployment (Vercel/Render/Neon), which has no server/client distinction at all.

---

## Deliverable

- Two Windows installers (`.exe`): one for the Server machine (frontend + backend + embedded database), one for Client machines (frontend only) — no additional software required by the end user in either case.
- The installer used determines the machine's role directly; there is no separate "designate as server or client" step within a single installer.
- On first launch, the Server installer opens the Initial Setup Screen (see section 8) when the `users` table is empty — create the first Admin account, or restore an existing backup — with no manual configuration steps left to the end user.