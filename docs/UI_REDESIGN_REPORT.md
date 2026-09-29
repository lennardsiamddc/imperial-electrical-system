# Imperial reference UI implementation

Completed 16 September 2026. Applied to the actual app at http://127.0.0.1:3000. No Stage 4 work, schema migration, business-rule change or original business-record edit.

## Implemented

- 79px red full-width header, 240px desktop red sidebar, white/light-gray workspace, compact tables and clean footer matching the supplied sketch's proportions.
- Supplied logo displayed from the exact logo region of `IMP UI.png`, using a proportional CSS crop. The source image is copied unchanged; its typography and crown are not redrawn. The older `imperial logo.jpg` differs from the latest reference and was not substituted. No promotional/banner image is displayed.
- Actual authenticated employee name/roles, profile sign-out menu, notification area with an honest unavailable message, and a working permission-aware global search.
- Five desktop KPI cards; Sales Overview with month/year selection, authorized profit series and accessible figures; Top Selling Products; existing low-stock logic/UOM; Recent Sales; future Quotations empty state.
- Shared header/navigation, tokens and styles apply to Products, Inventory, Stock In, Sales/History/Detail, Returns, Customers, Suppliers, Administration, Tax Settings and Sales & Returns Settings.
- Reusable page headers, notices/status badges, cards, buttons, fields, inputs, dropdowns, search fields, tables, empty states and native dialog component. No existing business workflow was replaced with a new dialog.
- Responsive desktop/tablet/phone layout. A 390px overflow issue found during browser verification was corrected; document width then matched the 390px viewport.

## Real-data definitions and unavailable features

Dashboard totals are complete SQL aggregates, not totals from a paginated first page. They refresh employee permissions before reading. Sales amounts use original Posted customer-payable figures (including VAT), explicitly labelled before Return adjustments; the dashboard does not invent a net-revenue/accounting policy. Profit uses existing stored posted profit and is omitted without permission. Drafts are excluded from totals/charts/rankings but can appear in Recent Sales with Draft status. Dates use Asia/Manila. Quantities remain grouped by product snapshot and UOM, never summed across unlike units.

Inventory value uses the existing signed stock-ledger values. Low-stock rows use the unchanged inventory service. Customer count includes existing active/inactive Customer Master records. Sales/customer visibility matches existing service restrictions.

Pending AR and Quotations are unavailable pending those modules. Notifications have no fake count. Unimplemented modules are omitted from navigation. Recent Sales is labelled Sales, not falsely represented as issued Sales Invoices. Global search covers permitted Products, Customers, Suppliers and Sales/document references; it does not claim to search unimplemented modules. No fake records, comparison percentages or charts were added.

## Verification

- **116 automated tests passed, 0 failed/skipped/cancelled.** All 115 existing tests remain intact. The added dashboard test verifies actual posted totals, stored profit, inventory value, quantity/UOM, financial omission, fresh-role/disabled-account enforcement and no audit writes from reads.
- TypeScript checking passed.
- Optimized production build passed.
- Actual original app browser checks passed: Dashboard, Products, Inventory, Stock In, Sales History, Returns, Customers, Suppliers, Administration/Employees, Tax Settings, Sales & Returns Settings and global search.
- Preserved isolated TEST workspace checks passed: populated Sales chart/ranking, existing 50-line Sale detail/SI/DR history, authorized employee New Sale form, logout/login, restricted financial cards and navigation. Direct restricted navigation to Administration and New Sale stayed blocked.
- Compared actual desktop rendering at the supplied 1536×1024 reference size; refined heading weight, spacing, KPI heights, sidebar labels, profile contrast and proportional logo display. Tested 390px responsive layout.
- Original app remains available at port 3000. The isolated port-3001 test server was stopped after checks. Existing data in both databases was retained.

A stale development server initially failed HTTP/browser responses; it was stopped cleanly and restarted. No database/build reset was used. A new test fixture initially used an invalid permission value; the fixture was corrected, not the permission implementation. Both issues are resolved. No current test/build failure remains.

## Files changed/added

- `app/(system)/layout.tsx`, `app/(system)/page.tsx`, `app/(system)/search/page.tsx`
- `app/globals.css`
- `components/app-header.tsx`, `components/nav.tsx`, `components/icon.tsx`
- `components/dashboard-ui.tsx`, `components/sales-chart.tsx`, `components/ui.tsx`, `components/dialog.tsx`
- `lib/dashboard-read.ts` — read-only presentation aggregates; no mutations or migration
- `public/branding/imperial-reference.png` — unchanged copy of supplied image, only logo region displayed
- `tests/dashboard.test.ts`
- This report; logs under ignored `test-results/ui-redesign/`

No changes to Stage 3 Sales/Returns posting, VAT, COGS, inventory, permissions, audit functions, schema or historical snapshots. The Stage 3 backup remains at `backups/2026-09-16-stage3/local-db-before.tgz`. The original workbook remains unchanged; SHA-256 `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

## Remaining scope

Business data differs from the example sketch, intentionally. The original workspace currently has no posted Sales; it shows true empty chart/ranking/recent-Sales states. AR, Quotations and notifications need their separately authorized modules before showing working data. Icons are reusable UI icons rather than a pixel-identical tracing of the sketch; the supplied logo itself is preserved. Existing production-deployment prerequisites in the Stage 3 report remain unchanged.

Stopped after this UI pass. Stage 4 has not begun.


## Owner acceptance correction

The initial UI checks missed the actual Sale draft POST origin mismatch. It was subsequently reproduced and fixed without relaxing CSRF protection. See [request-origin fix verification](ORIGIN_FIX_REPORT.md) for browser saves before/after restart and the 121-test result.
