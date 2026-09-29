# Stage 2.2 — Employee usability pass

Completed 16 September 2026. Stage 3 was not started.

## 1. UI changes

The existing Imperial red, white and gray design is retained. Navigation now emphasizes Dashboard, Products, Inventory and Stock In. Existing Customers/Suppliers remain accessible according to their original permissions; unfinished Sales/Purchasing/Accounting/Reports pages are no longer advertised in navigation. Administration and Tax Settings links are Owner-only. Direct page/service authorization remains in place.

Forms have clearer labels, required indicators, placeholders, comfortable controls, focus outlines and pending/loading messages. Status includes words, not just color. Extra information uses expandable details.

## 2. Everyday employee workflow

- Products: search by name, code or brand; open the matching product.
- Product editing: name, code, brand and unit first, followed by cost/selling inputs, low-stock level, active status and notes.
- Additional unit conversions, extra prices and default supplier remain under View Details.
- Calculated profit/markup/margin are read-only, permission-controlled details.
- Product and Stock In forms retain entered values after validation errors. Invalid fields inside collapsed details are revealed by browser validation.

## 3. Owner/Admin

Existing employee management, multiple roles, individual permission overrides, disabled-account handling, Tax Settings and audit pages are preserved. Owner financial details remain available under disclosures. Default supplier information remains visible to cost-authorized users.

## 4. Product search

A 250 ms debounced, cancellable search fetches partial name/SKU/brand matches. Results link using stable IDs and show product names first. No full product catalogue is downloaded. Responses contain at most 20 identity-only results, with a prompt to narrow additional matches. Catalogue lists remain paginated at 50 and their separate filters are expandable. Stock In search includes active products only.

The new authenticated `/api/products/search` endpoint returns only id, name, sku, brand and active status, even for Owners. It reuses the existing fresh-actor permission checks. Existing list search additionally matches product brand. No write or financial calculation rules changed.

## 5. Stock In

Open Stock In, search for a product, then enter quantity, unit, cost, independent VAT mode, supplier and reference. Date/time defaults to the current Manila time and remains editable under details. Existing product tax/recovery settings are retained; unconfigured tax options are visible and still require completion. Cost remains explicitly entered per selected unit; no automatic unit/cost conversion was introduced.

The button shows Adding stock while pending. Successful posting shows the actual saved product, quantity/unit and reference, plus Add another delivery. The same server posting function and request ID protection remain authoritative. The old inventory receive link redirects to the new page.

## 6. VAT

Entered amounts remain primary. Cost500EX/selling700EX display500/700. INC560 extracts500+60; INC784 extracts700+84. Both modes remain independent. Calculated equivalents, recovery/economic cost and saved-rate information remain under View VAT Details. Existing required treatment/recovery choices, rate-version checks and snapshots are unchanged.

## 7. Inventory and history

Inventory emphasizes Product, Available Stock, Unit and Status. Valuation appears only for authorized users. All / Low Stock / Stock Activity links provide simple navigation. Product-specific Stock Details retain totals in/out, conversion and threshold information.

Activity shows STOCK IN / STOCK OUT, signed entered quantity/unit, product, reference, date and employee. Extra posting/unit/financial details are expandable and retain the existing permission boundaries. Supplier information in activity retains its existing valuation permission requirement.

Dashboard has quick actions, up to five low-stock products and the five latest stock entries. It does not present partial-list counts as whole-business totals.

## 8. Security verification

All previous server-side permissions remain authoritative. No cost/profit fields are hidden merely with CSS. Existing server projections exclude financial fields for restricted users. The new search endpoint applies authenticated fresh-actor checks and then emits identity fields only. Owner-shaped records were also passed to presentation tests to confirm restricted financial sections do not render.

Existing regression checks for disabled users, forged roles, direct API restrictions, stale edits, immutable audit/history, rate snapshots, duplicate protection, session persistence and AI-independent runtime continue to pass.

## 9. Automated results

**82 passed, 0 failed, 0 skipped.** This includes all existing 67 tests and 15 additional Stage 2.2 checks. TypeScript validation passed.

New checks cover navigation/access visibility; everyday/advanced field grouping; friendly validation; all four VAT combinations in the simplified editor; restricted product/table rendering; success feedback; permitted supplier details; partial name/code/brand search; anonymous and denied API access; bounded results; duplicate-safe Stock In; low-stock filtering and readable history.

The first run exposed an invalid new test fixture (an extra employee id was supplied to create-user validation). The fixture was corrected; application validation was preserved. The final full suite passed after all code changes.

## 10. Browser acceptance

Acceptance used a separate temporary database/application on localhost:3001 and three isolated TEST accounts. The operational app remained on 127.0.0.1:3000.

| Perspective/check | Result |
| --- | --- |
| Owner navigation, employee/permission controls and advanced VAT details | Passed |
| Owner product edit/save and success feedback | Passed |
| Buy500EX/sell700EX | Passed; primary500/700 unchanged |
| Buy560INC/sell700EX | Passed; cost extraction500+60, selling700EX |
| Buy500EX/sell784INC | Passed; cost500EX, selling extraction700+84 |
| Buy560INC/sell784INC | Passed; both independent extractions |
| Partial brand search in Products; partial SKU search in Stock In | Passed |
| Inventory employee with cost/receive/value grants | Passed; can receive stock without Owner controls |
| Invalid negative quantity | Friendly error; no receipt saved |
| Entries retained after correcting validation reset behavior | Passed; reference, unit cost and VAT choices retained |
| Double-click Stock In | One receipt saved, +4ROLL; stock changed150→750METER |
| Success receipt details and employee-attributed history | Passed |
| Low-stock filter after receipt | Product correctly no longer listed as low stock |
| Restricted employee product/dashboard/inventory usefulness | Passed; no costs, VAT, valuation or profit shown |
| Restricted direct Administration and Stock In page access | Access restricted |
| Direct API navigation in browser | Browser tool blocked navigation; automated API tests passed |
| Desktop layout and narrow-screen inventory layout | Inspected; table supports horizontal scrolling |

Browser testing caught and corrected an automatic form-reset usability problem after validation errors. It did not require changing posting or VAT rules. The temporary browser tab and server were closed after testing. Its separate TEST data was retained in the temporary directory; nothing was copied into the operational database.

## 11. Preservation and files

**No database migration, reset, import or operational business-record write.** No changes to VAT calculation, inventory ledger, UOM conversion, weighted-average costing, recovery, profit, permissions, sessions or audit implementation. Only search matching, UI validation wording and the success redirect presentation changed around existing services.

Read-only browser verification of the original app showed:

- TEST Browser Wire: 0 METER, value 0.
- TEST Stage 2 Browser Cable: 300 METER, value 1800.
- TEST Stage 2.1 VAT Item: 2 PCS, value 1000.
- Original Owner session remained usable.

Original workbook SHA256 remained `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

Files added: `components/product-search.tsx`, `components/product-details.tsx`, `components/inventory-table.tsx`, `components/inventory-history.tsx`, `components/stock-success.tsx`, `lib/navigation.ts`, `lib/form-presentation.ts`, `lib/form-errors.ts`, `lib/product-search.ts`, `app/api/products/search/route.ts`, `app/(system)/stock-in/page.tsx`, `app/(system)/loading.tsx`, `tests/stage22-ui.test.ts`, `scripts/prepare-ui-acceptance.ts`, and this guide.

Files updated: `components/nav.tsx`, `components/master-form.tsx`, `components/stock-in-form.tsx`, `components/vat-editor.tsx`, `app/globals.css`, `app/(system)/layout.tsx`, `app/(system)/page.tsx`, `app/(system)/inventory/page.tsx`, both existing master list/detail pages, `app/actions.ts`, `app/inventory-actions.ts`, `lib/masters.ts`, and README.

## 12. Known limitations

- Search is partial-text matching, not typo-tolerant/fuzzy search. Requests and payloads are bounded; a thousands-of-products/concurrent-user production benchmark was not performed.
- Supplier selection retains the existing dropdown. Search-first product selection is implemented for the current Products and Stock In workflows; future modules are not built.
- New/unconfigured tax choices still need approved employee input. No tax classification or recovery eligibility is inferred.
- Narrow inventory tables scroll horizontally. Full device/browser accessibility certification was not performed.
- Browser checks ran in development mode. Production build/deployment, hosted PostgreSQL load checks, HTTPS, backups/restore and earlier accounting/operating sign-offs remain separate prerequisites.
- No unresolved functional failure was found in the completed checks. No claim of production certification is made.

Stage 2.2 is complete within this UI/usability scope. Stop here; Stage 3 has not begun.
