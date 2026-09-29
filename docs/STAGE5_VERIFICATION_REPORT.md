# Stage 5 verification

Status: implementation, isolated verification and Owner-approved original migration completed. See STAGE5_ORIGINAL_MIGRATION_REPORT.md for fresh-backup verification, exact preservation and original-app checks. Production deployment remains separate.

## Implemented

| Area | Result |
|---|---|
| AR architecture / trigger | Immutable receivables; unique finalized Stage 4 SI or eligible independent Posted Sale source. Quotation/order/release do not duplicate obligations. Source hooks share the existing posting transaction. |
| Relationships | Stable customer, invoice, Sale, order and agent references; physical SI snapshot; document/customer navigation. |
| Terms / due dates | Cash/COD and 7/15/30/45/60/90/custom; fixed-term SI due dates derive from each invoice's Manila date. Historical source records are unchanged. |
| Payment status | Derived Unpaid / Partially Paid / Paid from original amount, valid Collections and approved adjustments. Original amounts are not editable balances. |
| Aging / overdue | Outstanding-only buckets, days overdue, seven-day Due Soon, customer/agent/channel filters. |
| Customer position | Outstanding, overdue, pending checks, available credit and financial-history links. Existing Customer Master and credit-limit field reused. |
| Collections | Stable COL numbers; multiple partial/split payments; actual configured MOP; receiving accounts; dated references; searchable listing. |
| Checks | Received/Deposited pending; only Cleared settles. Post-dated deposit protection; cancelled/bounced instruments excluded; cleared bounce restores AR. Full status history. |
| Reversals | Separate immutable Collection reversal, no deletion. |
| Returns / adjustments | Explicit authorized completed-Return adjustment; source relationship and amount caps; original invoice/Return unchanged. Excess paid amount appears as Refund Due / Customer Credit Pending. |
| Follow-up / promise | Append-only notes and Promise-to-Pay, independent of contractual due date and balances. |
| Statements | Customer-facing as-of report and print styling, historical effective events, no COGS/profit/cost. |
| Dashboard / search | Real permitted outstanding, overdue and cleared Collections-today totals; permission-aware AR/Collection/reference search. |
| Permissions | Fresh server-side user checks; granular AR, aging, paid, details, bank, check, credit, statement and adjustment permissions. Existing employees receive no unsolicited grants. |
| Audit | New financial rows and check transitions record employee/time; old audit trail retained. |
| Concurrency | Receivable locks serialize collection/clearing/reversal/adjustment; source locks and uniqueness prevent duplicate AR; return locks prevent over-adjustment. |
| Idempotency | Immutable request IDs tied to actor/operation/payload; replay cannot duplicate money events. |
| Historical ordering | Reject financial events backdated before an already-recorded financial event on the same AR to prevent invalid intermediate balances. |
| Runtime | No AI service/API/subscription dependency added. |

## Schema / files

Additive `migrations/008_receivables.sql`: receivables, collections, collection_allocations, check_events, collection_reversals, ar_adjustments, ar_followups, finance_requests; sequences/indexes; immutable and audit triggers; expanded valid permission keys. No old business-table data changes.

New domain/API files: lib/finance.ts, lib/finance-read.ts, lib/finance-api.ts, app/api/finance/route.ts. New AR/Collections/Checks/Statements pages and reusable finance form/customer/document/list components. Integration edits: commercial/Sales posting hooks, permission/audit catalogs, customer credit guard, 90-day term option, navigation/layout, dashboard/search, document/customer views. Added Stage 5 tests and preservation/rehearsal/browser-fixture/restart scripts. Original 143 tests retained unchanged.

## Preservation and legacy classification

Clean stopped Stage 4 backup: `backups/2026-09-17-stage5/local-db-before.tgz`.
Baseline: `backups/2026-09-17-stage5/baseline.json`.
Retained earlier Stage 4 backup/evidence as requested.

Migration 008 applied successfully to a restored copy. **All 30 pre-existing table counts/hashes matched exactly, and Excel matched.** Original migration 008 subsequently passed under a fresh verified backup; see the original migration report.

Workbook SHA-256: `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

Required legacy report (`test-results/stage5-legacy-classification.json`):

- A: eligible independent Posted Sales: **0**.
- B: excluded Stage 4 goods-release Sales: **0**.
- C: Sales with actual legacy payments to recognize: **0**.
- D: eligible Unpaid / Partially Paid / Paid: **0 / 0 / 0**.
- E: duplicate commercial obligations: **0**; review exceptions: **0**.

The two existing TEST Sales are Drafts and remain excluded. The existing TEST Quotation remains Draft. Separate isolated tests exercise eligible legacy cash/check payments, one-time recognition and Stage 4 release exclusion.

## Verification evidence

**175 tests passed, 0 failed (all 143 baseline tests plus 32 Stage 5 tests, including their enclosing test). Type checking and production build passed.** Final test/build totals are recorded in `test-results/stage5-tests.txt`, `stage5-typecheck.txt`, `stage5-build.txt`. Baseline suite separately passed 143/143 before adding Stage 5 tests. No old test weakened.

Isolated restored database, production server port 3001, browser acceptance:

- Owner login and actual dashboard AR ₱500,000; physical SI TEST-STAGE5-004821.
- Double-clicked ₱200,000 Bank Collection produced COL-000001 once; balance ₱300,000.
- ₱150,000 Check Received: balance stayed ₱300,000; pending checks ₱150,000.
- Deposited → Cleared history retained; cleared balance ₱150,000.
- Separate ₱150,000 Bank Collection: Paid, balance zero, three records retained.
- Authorized reversal retained original Collection and restored ₱150,000.
- Accounting individual login recorded ₱10,000 GCash; outstanding ₱140,000.
- Promise-to-Pay saved independently of contractual due date.
- Customer statement showed correct original, collected and remaining amounts without internal cost/profit.
- Limited Sales could view permitted AR but had no Collection/check/follow-up controls; Collections page denied.
- Restricted Warehouse had no AR/Collections navigation and direct AR page denied.
- Direct API authorization/forged role/disabled account/forged origin checked in automated handler tests. Browser tool blocked raw JSON endpoint navigation, so that particular browser check was not claimed as passed.
- Closed/reopened isolated DB: all 39 table hashes/counts matched (`stage5-restart.json`), including financial history, sessions and audit. Final production server restart passed. The restricted employee session persisted and remained denied; Owner reopened the saved AR with ₱140,000 outstanding, four Collections (one reversed), cleared-check history and separate Promise-to-Pay. Global Search found the check Collection by its check number.

All browser-created financial records are confined to the isolated restored database, not the original.

## Architecture-ready / deferred

- One payment allocated across several invoices: normalized allocation table exists; current entry is one receivable per Collection.
- Customer credit-limit / existing hold data are advisory; no automated Sales enforcement, warnings in Sale entry, or notification engine.
- No executed refunds, transferable credits/advances, official tax-credit note, full ledger, commission engine, or bank/marketplace reconciliation.
- One approved adjustment per Return/AR; adjustment amendment/reversal workflow deferred. Original financial events remain immutable.
- Statement snapshots/PDF archive and final official paper calibration deferred; browser print available.
- Listing/search are functional; high-volume SQL projection optimization and hosted PostgreSQL load verification remain production work.

## Original migration checkpoint — completed

Owner approved migration 008. A fresh backup was restored and verified before changes; only 008 was applied. Every pre-existing table and Excel matched exactly afterward. Original port-3000 Owner login, dashboard, AR, Collections and Check Monitoring passed after restart; no business transactions were created. See `STAGE5_ORIGINAL_MIGRATION_REPORT.md` for exact evidence and the resolved generated-build-cache issue.

Production deployment remains separate: independent Node installation, hosted PostgreSQL, HTTPS, load testing, backup restore drills, staff acceptance, printer calibration, monitoring and recovery. Architecture-ready/deferred features above are not represented as fully implemented. No Stage 6.
