# Stage 1 architecture and workbook migration plan

## Specification gap

The supplied start prompt refers to `schema.sql`, but no such file was supplied. `README.md` and `CODEX_START_PROMPT.md` defined the implementation. `migrations/001_stage1.sql` is the new reproducible Stage 1 schema; it is not a recovered original schema.

## Read-only workbook inspection

Reference: `IMPERIAL SYSTEM LIVE.xlsx`. SHA-256 before implementation: `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

Inspected workbook metadata and Products!F6:U12. The workbook has 19 sheets, including Products, Stock In Log (Add), Sales Listing, Wholesale AR, sales documents, staff quotation sheets and reports. There are no separate Customer or Supplier master sheets in this file. Products!M1 contains a cached `#REF!` error. No cells were modified or recalculated. Template/sample rows and source formulas require a separate migration audit before import.

| Workbook product field | Stage 1 destination / treatment |
| --- | --- |
| Product Name / Item Code (SKU) | `products.name` / case-insensitive unique `sku` |
| Capital | `supplier_adjustment`, a decimal rate; confirm interpretation before import |
| Base Price | Confidential `base_price` |
| Meter Per Roll | `primary_uom=ROLL`, `secondary_uom=METER`, `conversion` after confirmation |
| Base Price Per Meter | Do not equate automatically with a meter selling price |
| Total Costs | Confidential `standard_cost`; confirm cost/VAT basis |
| Supplier | Resolve to an approved supplier UUID |
| Tax Amount | Preserve as migration evidence; confirm VAT status/rate separately |
| Retail Selling Price w/ VAT PER ROLL | Approved `retail_price`; confirm VAT-inclusive convention |
| Retail Mark Up / Estimated Profit / Profit Margin | No automatic formula imported in Stage 1 |
| All-time Items Sold / All-time Sales | Future transaction-derived reporting; no master totals imported |

## Architecture

Next.js App Router and TypeScript render the UI. Server Actions authenticate and validate all writes. Services enforce permissions again using current database roles inside the mutation transaction. SQL queries use parameters and an allowlisted entity/field list. Query projections omit costs and selling prices for restricted roles. Tailwind and shared CSS provide the desktop-first shell and forms.

The private `imperial` PostgreSQL schema is accessed only by the server. There is no browser database client, Supabase anonymous key, public API for tables, or service key in client code. Do not expose this schema through Supabase Data API. Use a dedicated restricted database login in production and grant only the tables/operations needed by the application. Database owners remain capable of administrative changes and require separate access controls.

Production uses `pg` and `DATABASE_URL`. Local development optionally uses PGlite (embedded PostgreSQL) on disk. PGlite is for a single local process only. Production startup requires PostgreSQL unless the explicit local verification override is set. The same migration and service tests run against the PostgreSQL SQL engine.

Passwords use salted scrypt hashes. Opaque random session tokens are stored hashed in the database, expire after eight hours, and use HTTP-only, SameSite cookies (Secure in production). Login attempts are limited per normalized account in a persistent 15-minute window. Next.js Server Actions provide same-origin checks. User edits revoke that user's sessions; mutation services also recheck active state and roles.

Audit triggers capture creates, edits and deactivations atomically, with actor identity and before/after values. Password hashes are excluded. Business masters cannot be deleted, and audit entries cannot be updated or deleted through normal SQL. Versions reject stale saves. Audit details are President/Admin-only; customer Activity exposes action/time/actor without confidential snapshots.

## Stage 1 permission decisions

| Role | Customers | Products | Suppliers | Administration |
| --- | --- | --- | --- | --- |
| President/Admin | Full | Full | Full | Users, roles, audit |
| Sales | Create/edit contacts and addresses; credit fields restricted | Identity and selling prices, read only | No | No |
| Warehouse | No | Identity/UOM/reorder status, read only | No | No |
| Accounting | Create/edit including credit fields | Identity and selling prices, read only | No | No |
| Purchasing | No | Create/edit including costs | Create/edit | No |

Multiple roles combine permissions. Base price is treated as confidential because it is used as a cost basis in the workbook. Selling prices have separate explicit fields. Prices and cost rates are entered directly; Stage 1 introduces no accounting or automatic pricing calculations. The only numeric processing is database decimal validation/storage. Credit fields are restricted to Accounting and President/Admin as the conservative interpretation of the specification.

## Migration sequence (not executed)

1. Review source records and mark real, duplicate, template, future-dated and sample rows.
2. Approve customer identities/codes, contacts and addresses; deduplicate across transactional sheets.
3. Approve supplier identities/codes and resolve product supplier names.
4. Approve product SKU uniqueness, UOM conversions, VAT and pricing meanings. Quarantine missing or ambiguous values.
5. Produce a dry-run mapping and reconciliation report. Obtain migration approval before importing business records.
6. Later stages: opening inventory batches, open AR, open PO/AP, then approved historical transactions.

Future transactions can reference stable UUID customer/product/supplier IDs and snapshot prices. No FIFO, inventory quantities, invoice, payment, AR or ledger tables have been guessed or implemented. Customer credit and activity fields are ready for later workflow additions.
