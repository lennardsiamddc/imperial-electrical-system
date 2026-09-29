# Stage 3 — Sales and Returns implementation plan

Status: implementation and local verification completed on 16 September 2026; awaiting Owner acceptance and production deployment verification. Parts 1–7, the Owner's VAT/discount clarification, and the Returns/Cancellations addition are authoritative. See STAGE3_COMPLETION_REPORT.md for evidence and remaining gates.

A clean pre-migration backup is in `backups/2026-09-16-stage3/local-db-before.tgz`. `baseline.json` records exact original row counts/hashes and the Excel checksum. Migrations 005 and 006 were tested on isolated databases and a restored backup, then applied to the original database. Exact original-row and workbook fingerprints passed before and after.

## Confirmed accounting calculation

Keep the entered unit selling price and EX/INC mode unchanged. Apply percentage discount to the entered amount first. EX adds VAT to compute customer payable; INC extracts VAT from the discounted entered amount. At 12%, 700 EX and 784 INC both yield 784 payable; a 10% discount yields 630 net + 75.60 VAT = 705.60 payable. Centralize this in `lib/sales-calculations.ts`, with tests. Preserve Stage 2.1 product cost/selling interpretation and historical snapshots.

## Existing integration points

- Customer Master already supports codes, names, contacts, TIN, billing/delivery addresses, payment terms, credit notes, active status and notes. Extend the existing experience; do not duplicate customers.
- `lib/inventory.ts` exposes `postMovementInTransaction` for stock changes within an enclosing document transaction. It already locks product rows, validates units, prevents negative stock and calculates weighted-average economic cost.
- `lib/vat.ts` contains exact-decimal calculations and a selling-only snapshot helper. Preserve these calculations and independent entered-amount interpretation.
- Existing services refresh employee permissions from the database. New Sales access must use the same mechanism and preserve explicit denials.
- Product search is authenticated, bounded and identity-only. Reuse its search experience and add a separately authorized sale-entry lookup for current selling defaults; never expose acquisition data through selection results.
- Existing audit triggers require an employee identity. Extend audit coverage to sales, lines, payment information, documents and Owner configuration.

## Proposed implementation sequence

1. Reconcile the complete seven-part request and Returns addition with the existing implementation; preserve the verified foundation.
2. Back up the existing database safely before applying an additive migration. First develop and verify the migration against isolated databases. Do not copy a running PGlite database or reset existing tables.
3. Add structured sale headers and sale-line rows, followed by payment information, configurable lookup records and controlled documents. Add only necessary permissions; retain all existing permission meanings and denials.
4. Implement draft saving, validation and atomic posting, then historical read projections and search. Build the UI only on these protected services.
5. Add a compact sale listing and one-page multi-line entry screen, reusing Stage 2.2 controls and product search.
6. Run every existing regression plus new sales, documents, costing, security, concurrency, migration-preservation and persistence tests. Complete browser acceptance with isolated role-specific TEST users before applying verified changes to the original app.

## Data structure

- One unified sale header for Wholesale, Retail or Online, with many structured sale lines. No artificial ten-line limit.
- Header snapshots: customer identity/address, channel/platform, sale date, reference, terms, salesperson/agent, notes and relevant payment information.
- Line snapshots: stable product ID, historical product name/code, quantity/unit, entered price, independently selected selling VAT mode/treatment, discount, VAT rate/configuration, monetary breakdown and posted cost basis.
- Discounts: store the applied percentage explicitly with an extensible structured rule representation. Do not represent products as text or use a sale per product.
- Payments: child records support future multiple methods. Separate payment intent/status from actual received amounts; unpaid terms sales must not create fictitious cash receipts. No full collections or settlement engine.
- Owner-configurable payment methods, receiving-account labels and online platforms, with immutable historical snapshots. Receiving-account configuration must not contain credentials.
- Documents: separate child rows for SI and DR, independent of the internal sale number. Keep document type, series/booklet context, text number including leading zeros, status, assignment history and future template references. Preserve controlled assignments rather than deleting them or silently freeing numbers after voiding.
- Separate SI/DR template definitions allow future pre-printed layouts and alignment settings without implementing a calibration engine now.

## Posting safety

- Drafts do not deduct stock.
- Posting locks the sale, rechecks permissions/status/version, locks affected products in a deterministic order and creates all line stock-outs in the same transaction.
- Failure on any line rolls back the complete posting, including stock, document assignment and payment records involved in that operation.
- Duplicate posting requests return the existing result without deducting stock again.
- Use the existing weighted-average stock-out calculation and snapshot each line's resulting cost. Never accept client-supplied COGS or profit.
- Return available-stock errors in the employee's selected unit without changing UOM conversion rules.
- Posted sales and financial snapshots are immutable. Full/partial returns and controlled posted cancellation are now required for Stage 3 sign-off; a placeholder or status-only reversal is insufficient. Restore only actual sellable returned quantities through new ledger entries using historical line costs.

## Employee experience

- One listing row per sale, showing actual product names/quantities plus “+N more”; the detail view shows every line.
- Channel tabs and search by sale number, SI/DR number, customer and product.
- Wholesale uses existing customer records; Retail supports Walk-in without mandatory master creation. Online shows its platform selector.
- Search-first multi-line grid with quantity, UOM, entered price, EX/INC, percentage discount and final entered-basis amount. VAT equivalents remain secondary details.
- Product defaults are read from Product Master and snapshotted. Authorized sale-only price changes never edit Product Master.
- Conditional payment fields and separate required/pending SI/DR controls keep routine entry short.
- Quantities should remain grouped by unit where needed; adding rolls, meters and pieces into an unlabeled total would be misleading.

## Verification scope

Retain all 82 baseline tests. Add large orders (including 100+ lines), draft/post lifecycle, all-or-nothing rollback, duplicate posting, competing sales, stock unit conversions, discount/VAT rounding and independence, recoverable-VAT economic COGS, cost/profit secrecy, price-override restrictions, unpaid terms, configurable-method snapshots, controlled-document series uniqueness/search, immutable historical snapshots, audit identity and restart persistence.

Implementation and both additive migrations are complete. All 115 tests, type checking and the production build passed. The workbook and existing records were preserved. Production acceptance is still required.

## Returns and cancellations — required Stage 3 scope

### Data and lifecycle

- Keep cancelled Drafts, Posted Sales, original stock-outs, payments, VAT snapshots and SI/DR assignments. Draft cancellation creates no stock, revenue or COGS posting.
- Add structured return headers and lines linked to original sale lines; issue never-reused `RTN-` numbers. Each return records reason, employee/time, request/received dates, online platform/order snapshot, separate platform case reference, and original Sale number.
- Support full and partial returns across all channels, multiple returns per Sale, and controlled cancellation of the remaining unreturned portion of a Posted Sale. Never reverse already returned quantities again.
- Track Requested → Approved → In Transit (optional) → Received → Inspected → Restocked (when applicable) → Completed; Rejected/Cancelled are explicit terminal paths. Record every transition as an immutable event. Do not cancel a restocked return without a separate controlled correction.
- Use per-line condition: Sellable, Damaged, Defective, For Inspection, Other. Only inspected Sellable quantities can be restocked. Other dispositions remain separate from available stock; future quarantine handling must not require rewriting the original return.
- Receiving reserves quantities without financial acceptance; inspected claims may be rejected before acceptance. Serialize receipt reservations and acceptance/restocking on the Sale and affected original sale lines, then product locks in deterministic order. Accepted allocations, including non-sellable returns, cannot cumulatively exceed the original quantities. Reject conflicting or repeated submissions safely; pending requests cannot bypass acceptance limits.
- Link each restock to a unique return line and immutable inventory movement. Retain original UOM/conversion and economic COGS. Do not use today's product acquisition price or current VAT settings.

### Historical financial information

- Snapshot proportional original entered/net/VAT/customer-payable amounts and original COGS. Use cumulative allocation differences so rounding residuals are assigned exactly once and complete returns reconcile to the original line.
- Keep original Sales figures and Return adjustments separately reproducible. Distinguish historical COGS associated with a returned item from value actually restored to sellable inventory. Non-sellable dispositions must not silently become stock assets or conceal losses.
- These are operational historical allocations, not issued tax credit documents or an automatic refund journal. Ask the Owner before implementing any new Philippine tax-document treatment or accounting policy for damaged-goods losses.
- Refund state is independent and initially Pending/Not recorded. Prepare partial/platform/store refund and credit/offset references without creating fictitious cash refunds, collections or settlement entries.
- Platform return-window configuration is optional and versioned/snapshotted; do not hard-code a seven-day limit or reject a return based on an assumed policy.

### Access and UI

- Owner-configurable separate permissions for view, request, approve, receive, condition, restock, reject, complete, cancellation/reversal and protected Return financial data. Refresh permissions server-side on every operation and redact protected response fields.
- Show Return Pending / Partially Returned / Fully Returned / Cancelled–Reversed activity on Sales lists without removing original Sales. Detail shows original, accepted-returned and retained quantities plus linked RTN numbers and conditions/history.
- Add a simple Return action from a Posted Sale and a searchable return list (RTN, Sale, customer, product, platform/order/case, status/date). Keep advanced workflow controls permission-dependent.

### Acceptance tests

Add Draft cancellation, posted cancellation, full/partial/multi-product/multiple returns, cumulative limits and concurrent acceptance, every condition, restock idempotency, preserved original stock-out/COGS/VAT/documents, original-cost allocation after master/rate changes, return/refund separation, online case references/configuration, direct API permissions/disabled users, audit identity, rounding conservation and restart persistence. Run all existing Stage 1–3 tests. Browser-verify normal and restricted employee return workflows. No Stage 4 work.
