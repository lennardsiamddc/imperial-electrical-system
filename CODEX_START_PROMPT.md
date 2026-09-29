# Prompt to start the Imperial system in Codex

Build Stage 1 of a production-oriented web application named **Imperial Electrical Business Management System**.

Use:
- Next.js with TypeScript
- PostgreSQL/Supabase
- Tailwind CSS
- Secure server-side authorization
- Desktop-first responsive UI

Read `README.md` and `schema.sql` in this project first. Treat them as the authoritative V1 specification.

## Stage 1 only
Implement:
1. Authentication/login
2. User profiles and role-based permissions
3. Customer Database
4. Product Database
5. Supplier Database
6. Audit logging
7. Main application shell/sidebar

Do NOT implement inventory FIFO or sales transactions yet except for database compatibility. Do not create fake accounting logic.

## Required UI
Sidebar:
- Dashboard
- Sales
- Customers
- Inventory
- Purchasing
- Accounting
- Reports
- Administration

For unfinished modules show a clean "Coming in Stage 2+" page rather than broken links.

### Customers
Create list, search, filter, create, view and edit screens. Customer profile should have tabs/placeholders for Overview, Quotations, Orders, Delivery Receipts, Invoices, AR, Payments, Products Purchased, Credit Information and Activity.

### Products
Create list, search, filter, create, view and edit screens. Include SKU, name, brand, category, primary UOM, secondary UOM/conversion, base price, supplier adjustment, standard cost, VAT, meter price, reorder level, default supplier and active status. Cost fields must be permission-protected.

### Suppliers
Create list, search, filter, create, view and edit screens.

### Permissions
PRESIDENT_ADMIN: all Stage 1 access.
SALES: customers and permitted product selling information; hide confidential costs.
WAREHOUSE: product identity/UOM information; no confidential costs.
ACCOUNTING: customer credit/accounting profile and allowed product information.
PURCHASING: suppliers and product costs.

A user can have multiple roles.

## Non-negotiable engineering rules
- Never trust client-side role checks alone. Enforce permissions server-side.
- Use UUID primary keys internally and human-readable codes externally.
- SKU must be unique.
- Customer code and supplier code must be unique.
- Financial/cost values use decimal/numeric, never floating point.
- Do not hard-delete business master records that are referenced; use active/inactive.
- Every create/edit/deactivate action must write an audit log.
- Validate all forms server-side.
- Add database migrations and seed only minimal development data clearly marked TEST.
- Keep business logic in services/domain functions rather than React components.
- Add tests for permissions, uniqueness and calculations introduced in Stage 1.

## Visual direction
Professional electrical/industrial wholesale system. Clean, fast and information-dense rather than decorative. Use the Imperial identity, with a crown/lightning concept only if an asset is supplied; do not invent a new official logo. Make tables practical for a wholesale counter environment.

## Definition of done
- App runs locally without errors.
- Login works.
- President/Admin can create the other four user types.
- Customers/products/suppliers can be created, searched, viewed and edited.
- Permissions hide and block restricted data/actions.
- Audit history works.
- Database migrations run from a clean database.
- README contains exact local setup instructions.

Before coding, briefly summarize the architecture and migration plan. Then implement Stage 1. Do not ask me to make routine technical choices unless a choice has a meaningful business consequence.
