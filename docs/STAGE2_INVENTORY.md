# Stage 2 — Products and inventory foundation

## Stage 2.1 update

The following describes the original Stage 2 behavior. VAT-configured products and receipts now follow [Stage 2.1 VAT rules](STAGE21_VAT.md), including recovery-aware economic cost and tax-exclusive estimates. Legacy snapshots and original values remain untouched.

## Integration plan and boundaries

Extend the stable Stage 1 Product Master, UUID relationships, authentication, current-access checks, Owner permissions, audit triggers and decimal storage. Add inventory as an immutable ledger, never an editable product quantity. Apply migration 003 after a stopped-database backup. Preserve original records and compare them against the backup. Verify backend protections before the UI, then run both stages' tests and browser/restart checks.

No FIFO, sales documents, accounting entries, automatic tax calculation, workbook import or Stage 3 module is included. Normal operation uses Node.js and PostgreSQL, with no AI SDK, key, subscription or AI endpoint. The local PGlite preview remains one process; shared production deployment uses PostgreSQL and a persistent application host.

## Product Master

The existing `/masters/products` is the single catalogue. Product names are the primary list links; SKU uniqueness and stable internal UUIDs are unchanged. Products retain brand/category, primary and secondary UOM, conversion, base price, acquisition/standard cost, retail and other selling prices, active state and reorder level. Notes were added. Detail pages show created/updated timestamps and a link to stock history.

Current acquisition cost is an approved, manually maintained amount per **primary UOM**. Receipts preserve their own acquisition cost and do not silently rewrite product costs or prices. Estimated profit = retail price − current acquisition cost; markup = estimated profit / cost × 100; margin = estimated profit / retail price × 100. Zero denominators show no percentage. These are read-only estimates on the entered amounts, not VAT-normalized gross profit or an accounting ledger. Both cost and selling-price visibility are required to receive the estimates from the server.

## Stock-in operation

1. Open Inventory and find the product by name/SKU, brand or category.
2. Choose **Stock in**. Enter received time (Manila), quantity, configured UOM, acquisition cost **per entered unit**, optional supplier, required reference and notes.
3. Check units and cost before posting. The app identifies the employee from the authenticated session.
4. The committed receipt immediately appears in balance/history and the Owner audit log. A pending form cannot submit a second copy; retries of the same request ID return the original movement. Reusing that ID with different details is rejected.

Business references are searchable but not globally unique: one supplier receipt may legitimately cover multiple products or deliveries. Request IDs provide exact-submission duplicate protection. Independently entering the same business receipt again with a new request ID is not automatically detected; review reference/history before posting.

Transactions are permanent and cannot be edited or deleted. A correction/return/reversal workflow is **not included** in this foundation. Do not use negative receipts or alter the database to correct mistakes. An Owner-approved compensating-movement workflow is a follow-up requirement before live receiving where corrections are needed.

## Units and balances

For a product with secondary UOM, that is its normalized stock unit. Otherwise the primary UOM is the stock unit. Example: 1 ROLL = 150 METER, so receiving 2 ROLL adds 300 METER; receiving 25 METER adds 25 METER. BOX→PCS works through the product's explicit conversion. An unconfigured unit is rejected. Standalone PCS, BOX, ROLL and METER products retain their own stock units. There is no meaningless grand total combining meters and pieces.

PCS/BOX/ROLL inputs require whole quantities; METER permits up to six decimals. Converted stock quantities must be exactly representable within six decimals and must be whole for non-METER stock units. Units/conversion lock after the first movement, even after balance reaches zero, to protect all historical quantities. Rename, prices, notes, reorder level and active status remain editable under existing permissions.

Available = all posted IN quantities − all posted OUT quantities. There are no reservations yet. Low stock means **available ≤ reorder level**, after converting the reorder level from primary UOM; inactive products are excluded from the low-stock filter. Zero stock at a zero reorder level is flagged.

The ledger preserves the product name/SKU, supplier name, conversion and employee name at posting. Product history follows UUIDs after renaming. Received time may be backdated, but posting order controls valuation. Future-dated receipts are rejected (one minute clock tolerance).

## Value and future stock-out integration

Receipt value = entered quantity × acquisition cost per entered unit, rounded to six PHP decimals. Available inventory value = receipt values − issue values. No FIFO batches or allocations are used. The future stock-out service calculates issue value using the running weighted-average cost under a product-row lock. Full depletion takes the complete remaining value to avoid residual rounding balances. Negative stock is rejected.

`postMovement` is the independent service entry point. `postMovementInTransaction` allows a future sales document and its movement to commit in the same database transaction. Stock-out requires `inventory.issue`; it is Owner-only by default and can be assigned through individual overrides. It has no public posting API or UI in Stage 2. Future integrations must keep idempotency, fresh employee authorization and document/movement atomicity.

## Permissions and API protection

| Capability | Defaults / dependencies |
| --- | --- |
| View inventory/history | Owner, Sales, Warehouse, Accounting, Purchasing; also requires product read |
| Post stock receipts | Owner, Purchasing; requires inventory read and product cost access |
| View inventory cost/value and supplier snapshots | Owner, Purchasing; requires inventory read and product cost access |
| Issue stock infrastructure | Owner; other users require explicit individual grant plus inventory/product read |
| Edit product cost/prices | Existing product write + the applicable cost/prices permission |
| Complete audit snapshots / employee controls | Owner only, unchanged |

Owner manages these through the existing Employees & access page. Multiple employees may share roles; individuals may combine roles or use explicit Allow/Deny exceptions. Product-read denial blocks inventory. Cost denial blocks receiving/value. Every service reloads the current active employee from the database; supplied role claims do not confer rights. User changes continue to revoke sessions.

The read-only `/api/inventory` accepts `view=balances`, `view=history`, or `view=product&product=<UUID>`, plus appropriate search/filter/page parameters. Anonymous requests return 401; forbidden requests return 403. Sensitive columns are excluded from query projections and response objects, not hidden in CSS. Responses are private/no-store. There is no POST handler (405); the stock-in Server Action independently authenticates, validates and authorizes, and uses Next's same-origin action protection. Browser/Supabase clients must never access the private database schema directly.

Notes and references are operational text visible to inventory readers; do not enter confidential prices in those fields. Use the protected structured cost fields.

## Migration and production database grants

`003_inventory.sql` adds `products.notes`, `inventory_movements`, time/product indexes, immutable/audit triggers, a product-UOM lock trigger, and the new allowlisted permission keys. Migrations 001/002 are unchanged; no existing quantities are inferred/imported. Migration replay is safe.

In addition to Stage 1 grants, the restricted server runtime login needs SELECT/INSERT on `imperial.inventory_movements`, and EXECUTE on `imperial.protect_inventory_units()` and `imperial.audit_inventory()`. Preserve the earlier validation/audit function grants. Do not grant UPDATE/DELETE on movements or UPDATE/DELETE on audit rows. Use the migration-owner login for schema changes; keep the schema unexposed to public APIs.

Before applying to an existing environment: stop its local PGlite process, make a consistent backup, run `pnpm db:migrate` with the intended database configuration, then restart. Never reseed. Hosted PostgreSQL migrations must be scheduled against the selected deployment with appropriate rollback/restore planning.

## Remaining production requirements

- Independently installed Node, current production build in a deployment workspace, persistent hosting, HTTPS and secure cookies.
- Real PostgreSQL verification using the restricted runtime login, plus 10+ simultaneous-user load and conflicting-write tests. PGlite service concurrency tests do not constitute a hosted load test.
- Scheduled off-device backups and a full hosted restore rehearsal. A local pre-upgrade backup was restored separately and compared successfully, but this is not certification of hosted disaster recovery.
- Owner acceptance of unit mappings, entered price/cost tax basis, weighted-average valuation and posting-date policy; approved opening-stock entries and real employee assignments.
- A controlled correction/return workflow before operational use that requires correcting posted receipts. No hidden edit/delete or unsupported adjustment endpoint was introduced.

Stage 3 has not begun.
