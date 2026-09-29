# Stage 3 completion and acceptance report

16 September 2026. Scope: Parts 1–7, the Owner's confirmed VAT/discount rules, and the Returns/Cancellations/Online Returns addition. Implementation and local verification are complete; production sign-off remains subject to the gates below. No Stage 4 work was started.

## 1. Architecture

Extended the existing Next.js/TypeScript app, PostgreSQL-compatible database layer, authentication, dynamic permissions, audit and inventory transaction engine. Services validate and project data server-side; the UI uses those services. No runtime AI dependency or AI package was added. The runtime source/package scan found no OpenAI/ChatGPT/Codex/Astra reference.

## 2. Schema and migrations

Applied additive migrations `005_sales.sql` and `006_returns.sql` to the original database after a clean backup and successful restore rehearsal. Added normalized Sales/lines, payments, documents/document lines, options, idempotency requests, reversal links, Returns/lines/events, refund-reference and platform-policy foundations. Reserved delivery, template, settlement and reversal-line structures support later work. Current cancellation history is authoritative through Return lines and the reversal's Return link; the reserved reversal-line table is not populated by this workflow.

Added database uniqueness, immutable-history checks, cumulative-return reservation checks, audit triggers, permissions validation and separate S/RTN sequences. No existing business rows were rewritten or deleted.

## 3. Customer Master

Reused existing stable customer IDs, contacts, TIN, addresses, terms and status. Added granular create/edit protections, TIN/contact search and a Sale-history link. Sales retain historical customer snapshots. Browser-created TEST customer was found by TIN and supplied its 30-day default terms.

## 4. Wholesale

Requires an active Customer Master record, supports terms, multiple products, controlled documents and unpaid sales without fictitious receipts. A seeded 50-line Wholesale Draft was reviewed and posted in the browser.

## 5. Retail

Supports Walk-in customers and multi-product orders. Browser verified a two-product paid Retail Sale, posting and subsequent partial Return.

## 6. Online

Supports configurable platforms and order references, unpaid platform-settlement intent, and linked platform return cases. Browser verified Shopee Sale/Return references; no collection was invented for an unpaid platform order.

## 7. Channels

Wholesale, Retail and Online share one consistent Sales model with channel tabs/filters. No duplicate Sales system per channel.

## 8. Product information in listings

One row per Sale displays actual product names/quantities, the first three lines and “+N more.” Detail shows all lines. Stable product IDs and historical names protect records from later renaming.

## 9. Multiple products

Structured child lines, without an artificial ten-line cap. Automated creation/posting/restart verified 100 distinct product lines in one Sale. Browser reviewed/posted 50 pre-seeded lines; it did not manually type all 50.

## 10. Search

Sales search includes internal and SI/DR numbers, customer, products/brand, agent and online references; filters cover channel, dates, platform, status, terms and payments. Returns search includes RTN, original Sale, customer, product, platform/order/case and status/date filters. Lookup results are bounded and permission-filtered.

## 11. VAT

Entered 700 EX remains 700 EX; customer payable is 784 at 12%. Entered 784 INC remains 784 INC, with net 700 and VAT 84. Buying/selling modes stay independent. Existing Stage 2.1 VAT code and historical snapshot protections remain intact.

## 12. Discounts

Centralized exact-decimal calculation applies percentage discount to entered price before adding/extracting VAT. Both 700 EX less 10% and 784 INC less 10% produce net 630, VAT 75.60 and payable 705.60. Both were checked in the browser and automated tests. Financial totals sum stored rounded line amounts.

## 13. Mode of payment

Configurable methods, receiving-account labels, conditional check/bank information, payment intent and actual received amounts are separate. Automated checks cover all nine initial methods and conditional validations. Configuration snapshots remain historical.

## 14. Terms

Cash/COD, numbered-day terms and custom due dates are supported. Calendar validation rejects invalid dates. Customer defaults are used, with authorized changes and historical snapshots.

## 15. Payment status

Paid/partial/unpaid validation follows received amounts. Unpaid terms/platform Sales create no fake cash receipt. Browser verified Paid Retail and Unpaid Wholesale/Online behavior.

## 16. AR and split-payment foundation

Payment children and references prepare later AR/collections and split-payment work. No full AR ledger, collections workflow, split-payment UI or marketplace reconciliation engine is claimed.

## 17. SI/DR control

Independent requirements, Pending assignment, actual series/text number with leading zeros, duplicate protection, void history, replacement and late assignment. Controlled numbers remain reserved. Assigning documents does not deduct stock again.

## 18. Pre-printed architecture

Separate document/template structures and protected previews exist. Actual paper/printer calibration and official tax-document acceptance are deferred. Preview is not certification of a compliant invoice.

## 19. Stock-out

Drafts do not affect inventory. Posting uses the existing inventory engine within one transaction, validates UOM/conversion and snapshots weighted-average economic COGS. METER and ROLL conversion/return restoration are tested. No FIFO was added.

## 20. Overselling and concurrency

Sale/product locks, current-stock checks, deterministic lock ordering, optimistic versions and request idempotency protect posting. Two authenticated competing requests for 8 of 10 available units yielded one success and one rejection. A forced second-line failure proved complete rollback of the first stock-out and associated audit/COGS. These are local embedded PostgreSQL tests, not a hosted multi-worker load certification.

## 21. COGS

Server-calculated historical economic cost comes from the existing weighted-average inventory engine, including recoverable input-VAT treatment. Client-supplied COGS is not trusted. Product/rate changes do not rewrite Posted costs or returned historical allocations.

## 22. Profit and margin

Historical posted COGS/profit/margin are stored and disclosed only through authorized projections. Returns retain corresponding historical adjustments separately from original Sales. Damaged-return associated cost is distinct from value restored to sellable inventory; no new loss-accounting policy was invented.

## 23. Permissions/security

Extended the existing Owner-managed role and individual Allow/Deny system. Separate controls cover posting, override/discounts, payment editing, SI/DR actions, cancellation and Return steps/financial values. Direct API checks cover confidential-field omission, forged role/financial input, permission dependencies, disabled users, anonymous access and write-origin enforcement. Restricted browser user saw no costs/prices/actions and received Access restricted on direct Sale-entry navigation. No hard-coded test-user permissions or five-user limit.

## 24. Audit

Sales/lines, documents, payments, Return transitions/conditions/restocks and Owner configuration record employee/time. Historical events are immutable and included in Owner audit filters. Original audit rows survived migration exactly.

## 25. Automated tests and build

**115 tests passed; 0 failed, skipped or cancelled.** All 82 existing regressions were retained. New calculation, Sales and Returns suites cover VAT/discounts, large orders, UOM, atomic rollback, duplicate/concurrent operations, permissions, documents, history, return quantity caps, rejected inspected claims, online references, Owner policy snapshots and persistence. TypeScript checking and the optimized Next.js build passed.

During development, tests/UI checks found and fixed quantity-input step validation, received-time precision and a test-session assumption after intentional session revocation. No failing acceptance test remains. Evidence is retained under `test-results/stage3/` (ignored by source control).

## 26. Browser acceptance

Passed individual Owner/employee/restricted login and logout, 50-line Wholesale posting, SI/DR 000101 assignment, two-line paid Retail posting, partial mixed-condition Return, unpaid Shopee Sale and full Return, restricted navigation, customer creation/TIN search/terms, EX/INC discount examples, Owner bank-label configuration and desktop/narrow layout checks. Sellable returned stock was restored; damaged stock was not. Refund stayed Not recorded. The final received-claim rejection refinement was verified automatically; that specific branch was not repeated manually in the browser.

## 27. Restart

Stopped the isolated development server and opened the compiled app against the same test database. Owner stayed signed in; Sales and completed Returns were visible. Then stopped it and compared exact row fingerprints: all matched, including 4 Sales, 54 Sale lines, 1 payment, 8 documents, 100 document lines, 2 Returns, 3 Return lines, 12 Return events, 105 stock movements, 428 audit entries and the active session. Original app restarted successfully on port 3000 and its login page was verified.

## 28. Existing data preservation

Clean backup: `backups/2026-09-16-stage3/local-db-before.tgz`. Fresh restored copy passed original-record fingerprints both before and after the final migrations. The original database then passed the same comparisons before and after upgrade: 1 user, 1 session, 1 customer, 1 supplier, 3 products, 2 movements, 1 tax-settings record, 17 audit rows and zero login-attempt rows all identical. This comparison includes complete rows, not just counts.

Browser-created TEST records were kept in an isolated database and archived as `backups/2026-09-16-stage3/browser-verification.tgz`; they were not mixed into the original business database or discarded. Backups contain sensitive data and remain access-controlled/ignored by Git.

## 29. Excel

`IMPERIAL SYSTEM LIVE.xlsx` was not modified or imported. Before/after SHA-256: `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

## 30. Known limits and deferred work

No known failing automated acceptance test. Production PostgreSQL runtime-role grants, multi-worker/10+ concurrent load, HTTPS/hosting and off-device backup recovery still require deployment verification. Current local PGlite is single-process. Standalone Node is not on this Mac's default Terminal PATH; verification used an available bundled runtime. The source requires no AI subscription, but independent Node/service hosting must be installed/configured for unattended use outside the development tool.

Full AR/collections, split-payment UI, check monitoring, marketplace settlement, commissions, advanced reports, partial delivery, official form calibration, refund execution and tax-credit/accounting journals remain deferred. No Stage 4 or FIFO implementation was begun.

## 31. Owner acceptance before production completion

Have Owner and representative staff approve entry/posting, permission assignments, controlled SI/DR procedures and return dispositions. Select and verify independent hosting/PostgreSQL, HTTPS, backups/restore and concurrent load. Test physical forms if used. Agree with accounting on refunds, damaged-goods treatment and tax-credit documentation before relying on those processes. Stage 3 is ready for this acceptance review; it is not certified for live production deployment yet.

## 32. Returns, cancellations and online returns

Implemented Draft cancellation without stock effects; controlled Posted cancellation through linked Returns/reversal; full/partial/multiple/multi-product Returns with cumulative quantity protection; receive/inspect/reject/restock/complete lifecycle; condition-specific inventory behavior; unique RTN history; online references and optional versioned return policies; historical VAT/COGS allocation with rounding conservation; separate refund foundation; server permissions and audit.

Receipt reserves original quantities without economic acceptance. Restocking or completion accepts immutable historical allocations. Only Sellable lines create stock-in, once. Received/inspected claims may be rejected before acceptance, and released quantities can be claimed again. Original Sale, payments, stock-outs and SI/DR history are retained. Automated checks include concurrent receipt protection and cancellation of the remaining unreturned portion.

## Files added/changed

- Database: `migrations/005_sales.sql`, `migrations/006_returns.sql`, `lib/migrations.ts`.
- Services: `lib/sales*.ts`, `lib/returns.ts`, `lib/returns-api.ts`, `lib/return-calculations.ts`; extended `lib/permissions.ts`, `lib/masters.ts`, `lib/navigation.ts`, `lib/audit.ts`.
- UI: `components/sale-entry.tsx`, `sale-actions.tsx`, `sales-search.tsx`, `sales-settings.tsx`, `return-entry.tsx`, `return-actions.tsx`, `use-submission.ts`; Sales/Returns routes under `app/(system)/`, Owner Sales settings, Sales/Returns API routes, shared CSS, Customer Master/history and audit navigation.
- Verification: three `tests/stage3-*.test.ts` suites; `scripts/seed-stage3-verification.ts`, `stage3-preservation.ts`, `stage3-restart-snapshot.ts`.
- Documentation: Stage 3 plan, this report, operating guide, README and Owner guide links. Existing Stage 1/2 tests were not removed or weakened.

See [staff and Owner operating guide](STAGE3_OPERATIONS.md). Stop here for Owner review; no next module starts automatically.
