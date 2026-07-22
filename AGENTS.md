# AGENTS.md — Local Inventory & Sales Management System

## Project Overview

A desktop application for a single-owner business (unipersonal) to manage inventory and sales, running fully local on a private network with no internet dependency. No electronic invoicing (facturación) is required. The system must be distributed as a single Windows executable with no external dependencies to install.

The architecture must allow future expansion to a cloud-based backend without rewriting the core logic (only changing where the backend server lives — local machine vs. cloud host).

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React | UI components, tables, forms, dashboards |
| Desktop packaging | Electron + Electron Builder | Produces a single Windows `.exe` installer, Node.js embedded, no separate install needed |
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

### 7. Local Network (LAN) Communication
- One machine acts as the "server" — runs the Node.js/Express backend and holds the SQLite database
- Other machines ("clients") connect to the server machine via its local IP address over HTTP (REST API) — no database engine required on client machines
- No internet connection required for any of this to function
- Server machine's local IP must be configurable/discoverable during setup

---

## Explicitly Out of Scope (for this version)

- Electronic invoicing (facturación electrónica) / tax authority integration
- Cloud hosting / remote access from outside the local network (architecture should allow this later, but it is **not** built now)
- Thermal printer / ticket printing integration
- Accounts receivable / credit sales
- Software licensing / anti-piracy protection (hardware ID, activation keys) — **deferred to a future phase**
- Multi-branch / multi-location management

---

## Architecture Notes for Maintainable / Swappable UI

- The visual design (theme, colors, layout, component styling) must be kept fully separate from business logic — no styling decisions hardcoded inside components that handle data or logic.
- Use a component-based UI approach (React components) with a centralized theme/style configuration (e.g., a single theme file, CSS variables, or a UI library's theming system such as Tailwind config or shadcn/ui theme tokens) so that colors, fonts, spacing, and layout can be changed globally without touching individual screens.
- Avoid inline styles scattered across the codebase; prefer reusable, swappable components (buttons, tables, forms, cards) so that if the client dislikes the look and feel, the design can be reworked or reskinned without rewriting the underlying functionality.
- Goal: if the client asks to change the visual design after seeing the first version, this should require restyling components/theme, not rebuilding features.

## Architecture Notes for Future Cloud Expansion

- Keep all business logic in the Express backend, not in the Electron/React frontend, so the same backend code can later be deployed to a cloud host (e.g., Render, Railway) with minimal changes.
- Client machines should only ever talk to the backend via HTTP/REST — never directly to the database — so that switching the backend's location (local IP → cloud URL) does not require changing client-side logic beyond a configuration value.
- SQLite is appropriate for the current scale (single business, 2–3 machines). If the business grows to require heavy concurrent writes across many machines, migrating to PostgreSQL is the recommended future path — this should be kept in mind when designing the data access layer (e.g., avoid SQLite-specific query syntax where avoidable).

---

## Deliverable

- A single Windows installer (`.exe`) that installs the full application (frontend + backend + embedded database) with no additional software required by the end user.
- The installer should support designating a machine as "server" or "client" during setup (or via a simple in-app setting).