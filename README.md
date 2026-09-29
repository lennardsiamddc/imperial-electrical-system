# Imperial Electrical Business Management System

## Stage 4 commercial documents

Quotations, Sales Orders, partial Delivery Receipts, SI-only goods releases and separate Sales Invoices now integrate with the existing Sales engine. Migration 007 preserves all earlier records. See [Stage 4 verification](docs/STAGE4_COMPLETION_REPORT.md) and [staff/Owner guide](docs/STAGE4_OPERATIONS.md). Goods release is the posting point; invoice issue alone never deducts stock. Existing weighted-average COGS is unchanged. Stage 5 has not begun.

## Stage 3 Sales and Returns

Sales across Wholesale, Retail and Online, controlled SI/DR records, atomic stock-out, historical costing, and full/partial Returns now extend the existing foundation. Additive migrations 005/006 are applied to this local workspace; all original records and the reference workbook were preserved. **115 automated tests passed.** See [completion and production acceptance report](docs/STAGE3_COMPLETION_REPORT.md) and [staff/Owner operating guide](docs/STAGE3_OPERATIONS.md). Stage 4 has not begun. Earlier-stage descriptions below are historical.


## Stage 2.1 VAT foundation

Independent cost/selling VAT controls, Owner Tax Settings and immutable receipt tax snapshots extend the preserved web app. See [VAT operating rules and limitations](docs/STAGE21_VAT.md) and [verification results](docs/STAGE21_TEST_RESULTS.md). Apply additive migration `004_vat_foundation.sql` after backup; never reseed the existing database. No Stage 3 or FIFO was added.

## Stage 2 inventory foundation

Products and transaction-based inventory now extend the preserved Stage 1 application. See [Stage 2 operations, units, valuation, permissions and deployment requirements](docs/STAGE2_INVENTORY.md). Migration `003_inventory.sql` is additive. No FIFO or Stage 3 workflows are implemented. See [Stage 2 verification results](docs/STAGE2_TEST_RESULTS.md).

## Stage 1 application — local setup

### Employee access enhancement

Owner/Admin now manages individual role defaults and Allow/Deny exceptions in **Administration → Employees & access**. Shared roles, multiple roles and 10+ employees are supported without a seat limit. Migration `002_employee_access.sql` is additive and preserves existing data. See [Owner controls and independent operation](docs/OWNER_AND_OPERATIONS.md) for the permission rules and running Imperial without any AI application or subscription.

After an existing installation is backed up and stopped, run `pnpm db:migrate`, then restart it. Do not reseed the existing database. On a machine with standalone Node installed, `sh scripts/start-local.sh` launches the existing local workspace from Terminal independently of Codex.

The implementation in this folder covers login, profiles/multiple roles, Customers, Products, Suppliers, audit history, and the application shell. Inventory now has Stage 2 receipts, stock balances and history; other future modules remain placeholders. **The Excel workbook is reference-only and has not been imported or modified.** The original `schema.sql` mentioned by the start prompt was absent; the new schema is `migrations/001_stage1.sql`.

### Requirements

- Node.js 22.13+ (Node 24 tested) and pnpm 11.
- For local review, no separate database installation is required: PGlite stores embedded PostgreSQL under `.local-db/`.
- For production or concurrent use, set `DATABASE_URL` to PostgreSQL/Supabase. Do not run multiple local processes against the same PGlite directory.

### Quick start: local TEST workspace

Run in this folder:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed:test
pnpm dev
```

Open http://127.0.0.1:3000. The seed creates only `TEST President` (`president@example.test`) with a random password saved in `.local-test-login` (owner-readable, ignored by Git). No business master records are seeded. The seed requires an empty user table. If the TEST account already exists, use the existing credentials file. In Administration, create individual accounts and select one or more roles.

**On this computer**, Node/pnpm are bundled with Codex but are not on the default shell PATH. Use the following first, then the same commands above:

```sh
export PATH="/Users/lennardsiamdelacruz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/lennardsiamdelacruz/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
cd "/Users/lennardsiamdelacruz/Desktop/IMPERIAL SYSTEM"
```

Stop the development server with Ctrl+C before running another process that accesses the same local database. Tests use their own temporary PostgreSQL directory and can run independently.

### PostgreSQL / Supabase setup

1. Create a fresh PostgreSQL database. Use a direct or session-pooler PostgreSQL connection (not the Supabase REST URL). Keep TLS verification enabled using your provider's documented connection settings.
2. Set `DATABASE_URL` in your shell for migration/bootstrap commands. Set it in `.env.local` for Next.js development or your host's secret environment for production. CLI scripts do not automatically read `.env.local`.
3. Run `pnpm db:migrate`. Migrations are transactional and recorded in `imperial.schema_migrations`; repeating this command is safe.
4. Bootstrap the first President/Admin on an empty users table:

```sh
export ADMIN_EMAIL='your-email@example.com'
export ADMIN_NAME='President'
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
pnpm db:admin
unset ADMIN_PASSWORD
```

Type a password of at least 12 characters at the silent prompt and press Enter. There is no default production password. Later users and role changes belong in Administration. User edits revoke that user's sessions. The final active President/Admin cannot be deactivated or demoted.

5. Run `pnpm build`, then `pnpm start`. Put production behind HTTPS (session cookies are Secure). The default server binds to loopback; configure the hosting platform's startup command as needed. Do not set `ALLOW_LOCAL_DB` in production; that escape hatch is only for local verification.
6. Keep the `imperial` schema private and out of Supabase's exposed schemas. The browser must never receive database credentials. Apply migrations with an owner connection; provision a separate runtime login with schema USAGE, SELECT/INSERT/UPDATE on users and master tables, SELECT/INSERT/DELETE on sessions, SELECT/INSERT/UPDATE/DELETE on login_attempts, SELECT/INSERT on audit_log, and EXECUTE on the two trigger functions. Do not grant DELETE on masters or UPDATE/DELETE on audit_log. Set the runtime connection as the application's `DATABASE_URL`.

Schedule database backups and test restoration with your PostgreSQL provider before live use. Workbook migration requires a separate review and approval. See [architecture and migration mapping](docs/MIGRATION_PLAN.md).

### Validation

```sh
pnpm typecheck
pnpm test
pnpm build
```

The integration suite creates a clean, isolated embedded PostgreSQL database, applies the SQL migration, and checks the five-role matrix, combined roles, confidential-field projection, forged writes, unique codes/SKUs, decimal precision, conversion validation, create/edit/deactivate/search, stale writes, atomic audit history, immutable audit entries, password hashing, user creation, role changes and revocation. It does not touch the workbook or local review database. Real hosted PostgreSQL connectivity must be verified after supplying that environment.

### Using Stage 1

- **Customers** opens the customer directory. Search name/code, filter active status, add or open a record, and select Edit. Delivery addresses accept one address per line. Credit fields are available to Accounting and President/Admin.
- **Inventory → Product Database** opens products. Warehouse sees product identity/UOM information. Sales and Accounting also see selling prices. Purchasing and President/Admin can edit products and see costs.
- **Purchasing → Supplier Database** opens suppliers for Purchasing and President/Admin.
- **Administration** manages individual profiles/roles and links to the complete audit history. Customer Activity shows change metadata without confidential snapshots.
- Use the Active checkbox to deactivate records. Codes and SKUs remain reserved. Prices are entered directly; there is no guessed cost, VAT, FIFO, sales or accounting calculation.

---

## Original V1 blueprint

Source workbook: `IMPERIAL SYSTEM LIVE.xlsx`

## Objective
Replace the spreadsheet-driven workflow with one interconnected web application. Master records are entered once and reused everywhere. The existing workbook remains the live/backup system until migration is approved.

## Recommended stack
- Next.js + TypeScript
- PostgreSQL / Supabase
- Server-side business rules and validation
- Tailwind CSS
- Vercel deployment
- PDF/print templates for Quotation, PO, DR and Sales Invoice

## Core modules
1. Authentication & Role-Based Access
2. Dashboard
3. Customer Database
4. Product Database
5. Supplier Database
6. Inventory / Stock In / FIFO / UOM conversions
7. Quotations
8. Sales Orders
9. Delivery Receipts
10. Sales Invoices
11. Accounts Receivable / Collections
12. Purchasing / Receiving
13. Expenses
14. Commissions / Leaderboard
15. Targets
16. Reports / Financial Statement
17. Settings
18. Audit Trail

## Roles
- PRESIDENT_ADMIN: unrestricted access
- SALES: customers, quotations, orders and allowed selling prices; cost/margin hidden unless granted
- WAREHOUSE: inventory, receiving, stock release and DR fulfillment
- ACCOUNTING: invoices, AR, collections, expenses, VAT and financial reports
- PURCHASING: suppliers, PO, receiving and supplier costs

A user may have more than one role.

## Interconnection rule
No module owns duplicate master data. Transactions reference IDs.

Customer -> Quotation -> Sales Order -> Delivery Receipt -> Sales Invoice -> AR -> Payment

Product -> Inventory Batch -> FIFO Allocation -> Sale -> COGS -> Gross Profit

Supplier -> Purchase Order -> Goods Receipt -> Inventory Batch -> Inventory Value / AP

All transactional modules -> Dashboard / Reports / Leaderboard / Financial Statement

## Customer Database
Each customer has one permanent ID and profile. Required features:
- Customer code
- Registered/company/trade name
- Customer type (Retail, Contractor, Wholesale, Project, etc.)
- Contact person, phone, email
- TIN
- Billing and multiple delivery addresses
- Assigned salesperson
- Payment terms
- Credit limit
- Current AR and available credit (calculated)
- Account status
- Notes
- Complete quotation/order/DR/invoice/payment history
- Lifetime sales, YTD/MTD sales, order count, top products
- Credit investigation and approval history

## Product Database
Workbook source fields observed include Product Name, SKU, Capital/Supplier Adjustment, Base Price, Meter Per Roll, Base Price Per Meter, Total Cost, Supplier, Tax Amount, Retail Markup, Retail Selling Price, Estimated Profit, Profit Margin, All-Time Items Sold and All-Time Sales.

Web product master should include:
- SKU (unique)
- Product name
- Brand/category
- Primary UOM
- Secondary UOM and conversion when applicable
- Base price
- Supplier adjustment/capital rate
- Current/standard cost
- VAT status/rate
- Retail/contractor/wholesale prices or markup rules
- Meter price where applicable
- Reorder level
- Active/inactive status

All-time sold/sales and available stock are calculated from transactions, not manually stored as authoritative totals.

## Inventory
Workbook source has Stock-In Date, Product Name, Stocks Added, Status, Item Price, UOM, Notes, Available Stock, Low Stock Alert, Inventory Value, All-Time Stock-In, All-Time Stock-Out, All-Time Sales, Meter Price and Available Stock Meter.

New system rules:
- Every stock receipt creates inventory batch(es).
- Every stock movement is immutable/traceable.
- FIFO consumes oldest available eligible batch first.
- Inventory cannot go negative unless President/Admin explicitly enables override.
- PCS/ROLL/BOX/METER are explicit UOMs.
- Products can define conversion such as 1 ROLL = 150 METER.
- Selling meters consumes the correct source inventory and cost basis.
- Adjustments require reason and audit entry.

## Sales documents
Use one transaction chain with conversion instead of retyping:
Quotation -> Sales Order -> DR -> Sales Invoice.

Documents preserve a snapshot of description, quantity, UOM, unit price, discount, VAT and totals at the time of issuance even if the product master changes later.

Quotation staff sheets become ONE quotation module. `created_by` and permissions replace separate STAFF 1/2/3 tabs.

## Accounts Receivable
- AR is created from finalized credit invoices, not from Stock-In.
- Terms: COD / 7 / 15 / 30 / 45 / 60 / 90 days and custom.
- Supports Paid, Partial, Unpaid, Overdue.
- Supports cash, bank transfer, check and other configured methods.
- Multiple payments can be allocated to one invoice.
- One payment can be allocated to multiple invoices.
- Check details/status are tracked.
- Customer statement of account is generated from invoices, credits and payments.

## Pricing / discounts
Preserve editable selling prices with permissions. Product master provides defaults; quotation/sale captures a price snapshot.
Support sequential discounts such as `-25-5-3` and percentage additions where approved, but normalize them into structured discount components for reliable calculation and audit.

## Dashboard
Dashboard is calculated from transactional tables. KPIs include sales, gross profit, expenses, inventory value, AR, AP, cash, VAT, customers, low stock, recent sales/purchases, top products/channels/customers and salesperson performance.

## Printing
Required print layouts:
- Quotation
- Purchase Order
- Delivery Receipt
- Sales Invoice

Support browser/PDF printing and later exact alignment for pre-printed NCR forms / Epson LX-310. Document numbering must be sequential, controlled and auditable.

## Audit & security
- Individual accounts; no shared login
- Role-based access
- Server-side authorization
- HTTPS
- Audit create/update/void/approve/print actions
- Soft-delete/void for financial transactions instead of destructive deletion
- Database backups
- Session controls and rate limiting
- Cost/margin fields restricted by permission

## Migration
Do not import every workbook row blindly. Separate real records from template/test data (including future-dated/sample entries). Migration sequence:
1. Customers
2. Suppliers
3. Products
4. Opening inventory batches
5. Open AR
6. Open PO/AP if applicable
7. Historical transactions if approved

## Stage 1 acceptance criteria
- Login works
- 5 users can be created with roles
- President can manage permissions
- Customer CRUD with unique customer ID
- Product CRUD with unique SKU
- Supplier CRUD
- Search/filter on all masters
- No duplicate SKU/customer IDs
- Audit log records changes
- Responsive desktop-first UI
- Database migrations are reproducible

## Stage 2.2 employee usability

See [Stage 2.2 workflows, verification and limitations](docs/STAGE22_UI_UX.md). Products and Stock In now offer search by product name, code or brand. Existing VAT, access controls and inventory rules are preserved.

## Stage 5 — AR and Collections

See [Stage 5 operations](docs/STAGE5_OPERATIONS.md) and [verification / migration checkpoint](docs/STAGE5_VERIFICATION_REPORT.md). Migration 008 is additive and must be rehearsed on a restored backup before Owner-approved original deployment. Pending checks settle only when Cleared. Product Returns require separately approved AR adjustments; no refund or tax credit note is implied. No AI runtime dependency or Stage 6 module is introduced.
