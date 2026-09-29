# Stage 4 implementation and verification — 17 September 2026

## Delivered

- Quotations: search-first products/customer/agent, multiple normalized lines, EX/INC, percentage discounts, customer/address snapshots, company, validity, terms, notes, status transitions and branded printable view.
- One-time Approved/Accepted quotation → Sales Order conversion with links in both directions and frozen historical snapshots. Independent Draft editing uses version checks.
- Sales Orders: confirmation without inventory posting, per-line delivery/invoice progress, order-level locking, many documents per structured customer ID and full document relationship chain.
- Partial/full DRs and SI-only explicit goods releases. Finalizing a release creates one linked Sale and invokes the existing posting engine in the same transaction. The verified weighted-average COGS behavior is retained; no FIFO engine was added.
- Separate invoicing before/after goods release, partial invoices, delivery-specific invoices, advance-invoice-to-release matching and cumulative over-invoicing protection. SI finalization never inserts a Sale or stock movement.
- Independent physical SI/DR numbers, case/whitespace-normalized uniqueness per series across legacy and new documents, leading-zero preservation and permanent number reservation after Draft cancellation.
- Configurable Owner-managed permissions, current-user authorization, strict shared CSRF origin guard, protected financial responses, audit snapshots and duplicate submission protection.
- Imperial listings, details, printable Q/SO/DR/SI views, real Recent Quotations dashboard and permission-aware Global Search. The existing UI was reused.
- The legacy SI/DR mutation path is blocked on Stage 4 goods-release Sales so it cannot bypass order invoice controls. Legacy independent Sales retain their existing document workflow.

## Schema and files

Additive migration **007_commercial_documents.sql** adds commercial_documents, commercial_lines, commercial_requests, physical_document_registry, a document-number sequence, relationships/indexes, audit/history triggers and permission-key validation. The registry imports existing physical-number references without altering existing rows. Migration 007 is registered in lib/migrations.ts.

New core files: lib/commercial.ts, lib/commercial-read.ts, lib/commercial-api.ts; app/api/commercial/route.ts; commercial entry/control/list components; quotations/orders/delivery-receipts/sales-invoices listings; commercial new/detail/edit pages; tests/stage4-commercial.test.ts; preservation/restart scripts and this operating documentation.

Integration updates: lib/sales.ts exposes the same transaction-scoped posting engine, lib/sales-documents.ts prevents the alternate document path for linked release Sales, permission/audit/navigation catalogs, existing Sales detail, dashboard/global search, layout and scoped print CSS. No replacement inventory engine, VAT algorithm or auth system.

## Preservation

Backup: backups/2026-09-17-stage4/local-db-before.tgz.
Baseline: backups/2026-09-17-stage4/baseline.json.

The stopped original database was backed up. Every pre-existing row was hashed by table (26 tables, excluding migration bookkeeping), and the original Excel checksum was recorded. Migration was tested first in isolated test databases and twice on separately restored backup copies. The original was compared again before migration. After migration 007 on the original, **all 26 original table counts/hashes and Excel matched exactly**. No reset, deletion or rewriting of historical Stage 1–3 records.

Workbook SHA-256: d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19.

Subsequent original-app acceptance adds one clearly labelled **Draft Q-000001**, ID 42bf7a5b-ec6b-45d7-90c1-2dd84f435ce6, and its normal audit/submission rows. It does not post stock or alter any existing TEST Sale. Normal login session/audit activity is separate from the migration comparison.

## Tests and security

Final suite: **143 tests passed; 0 failed**, including every original 121 test and 22 Stage 4 tests (including the enclosing test).

Coverage includes 1-line and 50/55-line documents; EX/INC and discounts; no quotation/order/invoice stock deduction; conversion/retry protection; tax/master changes after agreement; partial/full deliveries/invoices; distinct employee concurrency; physical number conflicts including legacy API and cancelled Draft numbers; no-DR release; fractional METER conversion; rounding conservation; insufficient-stock rollback; stale edits; immutable history; forged-role/origin rejection; direct API redaction; disabled-session rejection; audit; legacy document bypass prevention; restart persistence.

One early new assertion expected the word “delete” while the protected database returned “deletion”; only the new assertion was corrected. A browser-found validity-date input issue was fixed in the new commercial form and verified through save. No old tests were weakened.

Type checking and production webpack build passed. The production build was also started against the isolated acceptance database and its saved workflow reopened successfully.

## Browser acceptance

Isolated restored copy, port 3001:
- Logged in with the existing TEST Owner.
- Created Q-000001 with a preserved TEST product; approved and double-click converted to SO-000002, producing one order.
- Confirmed order; issued SI-000003 for 1 PCS before delivery. Inventory screen remained 2 PCS.
- Finalized DR-000004 for 1 PCS, producing one linked Sale.
- Verified re-invoicing that already advance-invoiced delivery was rejected.
- Finalized REL-000005 for the remaining 1 PCS without a physical DR.
- Created linked SI-000006 for that release without another posting.
- Final order showed 2 ordered / 2 delivered / 2 invoiced / 0 remaining, with two matched invoice/release links and two posted Sales.
- Double-click tested conversion, document creation and finalization. Physical SI and DR identities remained separate.
- Checked customer print view visually and physical-number Global Search.
- All acceptance database table hashes matched after close/reopen (test-results/stage4-restart.json). Reopened the full chain after production-server restart.

Original app, port 3000:
- Login/new Stage 4 pages verified after migration.
- Created only the unposted TEST quotation noted above; validity 31 December 2026 and entered ₱1,000 EX / payable ₱1,120 persisted through saving. The full posting acceptance workflow was deliberately confined to the restored copy. After the final original-app restart, Q-000001 and its validity date reopened successfully, the Owner session persisted, the dashboard showed the real quotation, and both existing S-000001/S-000034 TEST Draft Sales remained visible.

## Remaining limitations / production gates

- Converted order snapshots are locked; there is no confirmed-order amendment or over-quantity override workflow.
- Finalized invoice credit notes/void/corrections need an approved accounting workflow. They are blocked rather than silently editing financial history. Released goods use the existing audited Returns/Cancellation workflow; Returns do not automatically reopen order quantities or rewrite invoices.
- Delivery-specific billing proceeds in order-line quantity sequence. Invoice earlier quantities first; use the order form for a remaining partial invoice.
- SI/DR Draft lines are replaced by cancelling/recreating the Draft; assigned physical numbers remain reserved.
- Status filters use stored lifecycle statuses; derived partial-delivery/invoice progress is displayed separately.
- Physical printer alignment, official paper acceptance, production PostgreSQL multi-worker load testing, hosting/HTTPS and operational restore drills remain deployment gates. No claim of production certification.
- AR/Collections, commissions and FIFO conversion are outside this stage. No Stage 5 work was started.

See STAGE4_OPERATIONS.md for staff steps, permission dependencies and correction boundaries.

## Final running state

Imperial is running at http://127.0.0.1:3000 using its existing local startup mode and original upgraded database. The isolated port-3001 server was stopped. Final logs are retained in test-results/stage4-tests.txt, stage4-build.txt and stage4-typecheck.txt. No Stage 5 work started.
