# Stage 2.1 completion report — 16 September 2026

## 1. Implemented VAT functionality

Added deterministic, decimal-based VAT calculations with independent selling/acquisition controls, VATable/Zero-Rated/VAT-Exempt treatment, inclusive/exclusive entry, live previews, permanent receipt snapshots, recovery-aware valuation and Owner Tax Settings. Imperial remains the existing web application; no Stage 3, accounting ledger, tax return, FIFO or AI runtime integration was introduced.

## 2. Schema and files

Applied additive `004_vat_foundation.sql`:

- New singleton `tax_settings`: configurable standard rate, version, effective/update times, reason and employee attribution, plus audited-update/no-delete triggers.
- New nullable product fields: `selling_tax_treatment`, `selling_entry_mode`, `cost_tax_treatment`, `cost_entry_mode`, `cost_input_vat_recoverable`, `selling_vat`, `cost_vat`.
- New nullable `inventory_movements.cost_vat` snapshot. Existing entered cost and inventory value columns remain.

Added `lib/vat.ts`, `lib/tax-settings.ts`, Tax Settings page/action/form, reusable VAT editor/summary, `tests/stage21.test.ts`, `scripts/verify-vat-upgrade.ts` and VAT documentation.

Extended existing master/inventory services, financial field projections, pricing indicators, product/receipt forms and detail pages, audit filtering, migration runner and documentation. Stage 1 test setup now also applies migration 004; none of its existing assertions were removed or weakened. Stage 2 tests were retained unchanged. Authentication, users, session logic, package dependencies and costing method were not replaced.

## 3. Selling-price VAT behavior

Independent selling treatment/mode controls apply to retail, contractor, wholesale and meter prices. Retail has a live preview; all applicable saved selling breakdowns are available in product details. At 12%, 1,120 inclusive or 1,000 exclusive yields net 1,000, output VAT 120, gross 1,120. Sales snapshots contain no acquisition-cost or input-VAT fields. Existing saved product snapshots do not change merely because the default rate changes.

## 4. Acquisition/COGS behavior

Cost treatment/mode are independent of selling. At 12%, 560 inclusive yields net 500, input VAT 60, gross 560. With recoverable input VAT selected, economic cost is 500 and recoverable VAT is 60. Otherwise economic cost is 560 and recoverable VAT is zero. The system records the user's authorized recovery choice, not a legal eligibility decision. No GL/COGS posting workflow is implemented; future weighted-average issues consume the correct economic ledger value.

## 5. Inventory receipts

New browser receipts require tax controls and preserve their own entered amount, tax treatment, mode, applied/configured rates, unit breakdown, recovery amounts, rounded line totals, configuration version/effective time and rounding rule. These may differ from Product Master. Immutable receipt and audit snapshots survive product/default-rate changes. Legacy receipts remain unchanged with a null VAT snapshot, visibly labelled as unconfigured historical data.

## 6. Profit/margin

Configured estimates compare VAT-exclusive retail revenue to economic acquisition cost. The browser example (cost 560 inclusive/recoverable, selling 1,000 exclusive) shows profit 500, markup 100%, margin 50%. Nonrecoverable VAT remains part of cost. One-sided VAT configuration suppresses estimates; completely legacy products retain the old estimate with an explicit legacy-basis label. No accounting profit or tax-return calculation is claimed.

## 7. Tax Settings

Owner-only configuration starts at 12.00%. Updates take effect immediately for new calculations and are versioned/audited. Stale forms/updates fail rather than silently adopting a changed preview rate. Existing product/receipt snapshots are not recalculated. In the real workspace browser test, the Owner saved **12% unchanged** with a TEST reason, creating configuration 2 and an audit event. Rate-change tests from 12% to 10% occurred only in isolated test databases.

## 8. Security results

Passed: fresh server-side permissions, forged Owner-role rejection, Owner-only Tax Settings read/write, cost/input-VAT/valuation/profit projection, separate selling-price visibility and direct API response checks for restricted users. Computed VAT snapshots cannot be supplied as trusted client fields. Old disabled-user/session/override tests still pass. HTTP financial responses use existing private/no-store handling.

Authenticated API tests call the actual response handler using real stored test sessions. They confirm that Sales/Warehouse responses omit protected cost snapshots, recovery amounts, valuation and profit; Warehouse also lacks selling snapshots. This is not a certification of production database grants or hosted security.

## 9. Audit results

Product changes retain before/after snapshots containing tax controls, costs/prices and computed breakdowns. Receipt audit includes its tax snapshot and employee. Tax Settings updates contain before/after rate, reason, version/time and employee. Browser verification confirmed a persisted Tax Settings event for TEST President after restart. Initial configuration is identifiable migration data, not an invented employee action. Existing audit immutability tests pass.

## 10. Regression and browser results

**Final full suite: 59 tests passed, 0 failed, 0 skipped. TypeScript validation passed.**

All 41 Stage 1/2 tests remain passing. Added VAT coverage includes:

- Inclusive/exclusive selling and acquisition formulas, all four independent mode combinations.
- Configurable rate and unchanged historical product/receipt snapshots after a rate change.
- Distinct zero-rated/exempt treatment with zero applied VAT.
- Central HALF_UP, centavo line totals, six-decimal units and net + VAT = gross reconciliation.
- Recoverable/nonrecoverable cost valuation, partial-configuration profit suppression, economic profit/margin.
- Receipt-specific tax choices, idempotent retries, conflicting configuration-version reuse rejection and stale-rate rejection.
- Owner configuration permissions/audit, sensitive-field/API protection and rejection of forged snapshots.
- Weighted-average depletion based on economic cost; no output VAT fabricated on stock-out.
- Database close/reopen persistence for settings, receipts, audits and a session; deterministic VAT without external fetch.

An early VAT test expected a formatted string inside PostgreSQL audit JSON; PostgreSQL correctly returned a JSON number. The new assertion was corrected to that representation without changing the calculation or audit behavior. Initial type errors during implementation were resolved. No tests remain failing.

Browser checks:

- Preserved Owner session and both earlier products loaded after migration.
- Created `TEST-S21-VAT-001` / **TEST Stage 2.1 VAT Item**, UUID `25ae965e-b7e1-40bf-a1d0-fc8fec98af2d`.
- Verified live and saved independent controls: cost 560 inclusive/recoverable; selling 1,000 exclusive. Expected breakdowns and 500 profit estimate displayed.
- Posted `TEST-S21-VAT-RECEIPT-001`: 2 PCS at 560 inclusive, supplier amount 1,120, recoverable input VAT 120, inventory cost/value 1,000.
- Saved Owner Tax Settings at unchanged 12% with a TEST reason; UI showed configuration 2 and success.
- Normal server stop/restart passed. Fresh browser tab retained the existing login, 2 PCS, 1,000 inventory value and the original configuration-1 receipt snapshot. Tax Settings audit persisted separately.

No production build or hosted PostgreSQL/load test was performed. Tests use isolated PGlite PostgreSQL-engine databases; their passing does not replace production-environment verification.

## 11. Preservation

Before modification, stopped the preview and saved source/database archives under `backups/2026-09-16-stage21/` (owner-readable). Extracted the database archive into a separate temporary directory. After migration and replay, compared every original column of every existing business row:

| Table | Original rows | Result |
| --- | ---: | --- |
| Users | 1 | Identical, including credentials, roles, overrides and active state |
| Customers | 1 | Identical |
| Products | 2 | All original columns identical |
| Suppliers | 1 | Identical |
| Inventory movements | 1 | All original quantity/cost/value/snapshot identity columns identical |
| Audit log | 14 | Identical |
| Sessions | 1 | Identical |
| Login attempts | 0 | Unchanged |

No VAT basis was inferred and no old receipt was recalculated. Subsequent browser verification added only the labelled new product/receipt, their audit events and the audited new Tax Settings save. Those TEST additions are retained. No prior TEST record was edited or deleted. Workbook hash remains `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`; Excel was not modified or imported.

## 12. Known limitations

- Recovery is full or none; no partial input-tax allocation or automatic BIR qualification.
- Rates apply at posting/configuration save time; no scheduled activation or historical-rate selection for backdated entries.
- Legacy costs have an unknown VAT basis and remain untouched; combining legacy and new economic values requires reconciliation before accounting use.
- Product saves explicitly refresh configured amounts using the current rate; default changes alone do not reprice products.
- Receipt correction/reversal workflow remains the Stage 2 follow-up item.
- Hosted PostgreSQL grants, production build/HTTPS, 10+ simultaneous-user load, independent unattended hosting and disaster-recovery validation remain outstanding.

## 13. Owner acceptance

Before operational sign-off, confirm VAT treatment eligibility, input-tax recovery policy/evidence, legacy balance handling, line-centavo rounding and the posting-time rate policy for older purchases. Accept the distinction between price estimates and accounting results. Standalone installation/hosting prerequisites from earlier stages remain; the business code has no AI runtime dependency.

See [VAT operating guide](STAGE21_VAT.md) for formulas, precision, source references, permissions and production grants. **Stage 3 has not begun.**
