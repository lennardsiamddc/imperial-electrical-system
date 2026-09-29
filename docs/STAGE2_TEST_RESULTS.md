# Stage 2 implementation and verification — 16 September 2026

## Outcome

The requested Product Master + Inventory foundation is implemented and verified locally on the preserved Stage 1 application. **41 automated tests passed; 0 failed. TypeScript validation passed.** Production sign-off remains pending the requirements below. No FIFO or Stage 3 module was started.

## Built

- Extended the existing centralized Product Master with notes, timestamps in the detail UI, protected derived markup/profit/margin estimates and name-first links. Existing SKU, UOM, cost, price, status and reorder fields remain in place.
- Added an immutable inventory ledger with entered and normalized quantities/UOM, received and posted timestamps, acquisition/extended costs, supplier/reference/notes and employee/product/supplier snapshots.
- Added receipt posting, exact-submission idempotency, current balances, total in/out, low-stock filtering, per-product valuation, searchable history and product-history links.
- Added transaction-safe weighted-average stock-out infrastructure, negative-stock protection and a composable service for future document transactions. No stock-out UI/public mutation API or sales module is exposed.
- Extended the existing Owner-managed permission catalogue; costs/value are omitted server-side for restricted users. Kept individual logins, combined roles, disabled-user handling and audit protections.
- Kept the existing Imperial red theme, table/form components and responsive layout rules. Quantities retain exact decimal arithmetic but display without unnecessary trailing zeroes.

## Database and file changes

Applied `migrations/003_inventory.sql`: product notes; `inventory_movements` table, foreign keys, checks and indexes; immutable movement audit triggers; protection against changing stocked product units/conversion; new inventory permission keys. Migrations 001/002 were not rewritten. Migration replay passed.

Added:

- `lib/inventory.ts`, `lib/inventory-api.ts`, `lib/pricing.ts`, `lib/format.ts`
- `app/api/inventory/route.ts`, `app/inventory-actions.ts`, `app/(system)/inventory/page.tsx`
- `components/stock-in-form.tsx`
- `tests/stage2.test.ts`
- `scripts/verify-stage2-preservation.ts`
- `docs/STAGE2_INVENTORY.md`, this report

Extended:

- `lib/migrations.ts`, `lib/masters.ts`, `lib/permissions.ts`, `lib/field-labels.ts`, `lib/audit.ts`
- Existing product list/detail routes, audit page, application shell/dashboard wording
- `components/master-form.tsx`, `app/globals.css`
- `tests/stage1.test.ts` only to apply migration 003 in setup; every original assertion remains
- `scripts/verify-upgrade.ts`, README and Owner operations documentation

No authentication/session/password implementation, Owner user-management logic, dependency manifest or lockfile was replaced. No production build or destructive reset was run.

## Preservation result

Stopped the preview and saved source/database archives under `backups/2026-09-16-stage2/` before migration. Restored the database archive into a separate temporary directory and compared **every original column** against the upgraded workspace database:

| Original table | Rows before upgrade | Result |
| --- | ---: | --- |
| Users | 1 | Identical, including password hash, roles, permissions, active state and version |
| Customers | 1 | Identical |
| Products | 1 | Identical original columns; new notes default empty |
| Suppliers | 1 | Identical |
| Audit log | 11 | Identical, including actor snapshots |
| Sessions | 0 | Unchanged at migration time |
| Login attempts | 0 | Unchanged |

No opening quantities were inferred. The original customer, supplier and product TEST rows were not edited. Browser testing subsequently added one clearly labelled product (`TEST-S2-UI-001`, UUID `060da801-1aa3-44be-8d45-c07107c29fa1`) and one receipt (`TEST-S2-BROWSER-RECEIPT-001`) plus their audit events and ordinary login/session activity. These new TEST records are retained. Automated employee and stock fixtures exist only in isolated temporary test databases.

Workbook SHA-256 unchanged: `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`. Excel was not modified or imported.

## Automated results

Final command: `tsx --test tests/*.test.ts` — **41 pass, 0 fail, 0 skipped**. `tsc --noEmit` passed.

All Stage 1 checks remain: individual accounts, more than ten employees, shared/combined roles, overrides, cost/credit projection, forged-role rejection, Owner-only controls, last Owner, disabled-user rejection/reactivation, password/session revocation, duplicates, validation, master edits/search, audit immutability and login/logout/reopen persistence.

Stage 2 checks cover:

- Product notes, duplicate SKU rejection, decimal estimates and zero denominators.
- Zero-stock and threshold low-stock behavior, active/inactive filtering.
- Receipts, exact retries, conflicting retry rejection and employee audit attribution.
- ROLL→METER and BOX→PCS conversion, separate PCS products, invalid units/count fractions/precision/negative/future inputs.
- Weighted-average issue valuation, concurrent issue attempts without overselling, full depletion with zero residual value.
- Renaming with historical snapshots intact, UOM locking and immutable movements.
- Current database authorization despite forged caller roles; individual receiving/value grants and explicit cost denial.
- Direct API handler requests: 401 anonymous/disabled, 403 denied, successful Owner access, and absence of cost/value/price/margin keys from restricted responses.
- Inventory operation with external fetch disabled; no AI SDK/endpoints in runtime source/dependencies.
- Database close/reopen preserving balances, movement rows and audit history.

Early new-test runs failed because test fixtures incorrectly included an `id` in the strict employee update payload; fixtures were corrected. A duplicate fixture property and initial UI type errors were also corrected. No existing validation was relaxed. There are no remaining failing tests.

Tests use PGlite's PostgreSQL engine. The simulated competing service calls do not replace true hosted PostgreSQL concurrency/load testing. Authenticated API cases exercise the actual response handler with real stored sessions; live HTTP smoke checks separately verified anonymous GET 401 with private/no-store and POST 405.

## Browser and actual restart results

- Original Owner credentials signed in successfully after migration.
- Original TEST product remained in the name-first Product Master.
- Created the new TEST cable with 1 ROLL = 150 METER, cost 900 and retail 1200. Detail showed estimated profit 300, markup 33.33%, margin 25%.
- Posted 2 ROLL at PHP 900/ROLL through the actual Server Action: 300 METER available and PHP 1,800 value, with supplier/reference/employee in history.
- Low-stock filtering excluded the stocked new product and retained the original zero-stock product.
- Stopped and restarted the actual local application normally. Existing browser session, new product, balance, value and receipt history persisted. Owner audit page showed the new IN event and all older events.
- A tab that had loaded a connection-error page during downtime could not be reused by browser control; a fresh tab in the same browser verified persistence successfully. This did not require resetting the app or database.
- Desktop UI visually inspected. Existing responsive classes are retained; a separate mobile viewport test was not performed this turn.

## Known limits and completion criteria

The requested local foundation is implemented. Before operational production sign-off:

1. Owner/warehouse acceptance of unit definitions, six-decimal receipt valuation, weighted-average issue costing, posting-order policy and non-tax-adjusted product estimates; approved opening stock and real employee assignments.
2. A controlled compensating correction/return workflow for mistakes in posted receipts. Receipts cannot currently be edited, deleted or reversed from the UI. This avoids unaudited rewrites but must be addressed for routine live receiving.
3. Independent Node installation and persistent production hosting, up-to-date deployment build, HTTPS and secure cookies.
4. Hosted PostgreSQL verification with restricted runtime grants, representative 10+ concurrent users/conflicting writes, and production security review.
5. Scheduled off-device backups and a hosted restoration/reconciliation rehearsal. The successful separate local backup restore/comparison is narrower evidence.

References are searchable, not unique business-document keys; request UUIDs prevent replay of the same submission, not independently re-entered duplicate receipts. Notes are visible operational text and should not contain confidential prices. No accounting profit, reservations, FIFO, supplier-return workflow, sales deduction UI or Stage 3 functionality is claimed.

See `docs/STAGE2_INVENTORY.md` for operation, formulas, permissions, migration grants and future integration boundaries.
