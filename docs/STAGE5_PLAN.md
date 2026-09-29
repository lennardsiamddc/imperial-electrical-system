# Stage 5 implementation plan

Owner-confirmed rules: only Cleared checks settle AR; return financial adjustments require separate authorized approval; eligible independent Posted Sales generate one receivable with actual payments imported once. Stage 4 release Sales never generate Sale-based AR.

1. Preserve stopped Stage 4 database backup and hash all 30 tables and Excel (completed).
2. Add immutable receivables, collections/allocations, check events, collection reversals, AR adjustments and follow-ups. Balances derive from dated events. No ledger, stock or VAT recalculation.
3. Create AR in the invoice finalization transaction and independent Sale posting transaction; add explicit idempotent reconciliation for pre-existing obligations. Flag ambiguous legacy reversals/payments for review. Report classification before original migration.
4. Snapshot invoice terms and due dates, use Manila dates for aging. Preserve pre-existing document dates. Add 90 Days to selectable terms.
5. Lock receivables for collections/clearing/adjustments; immutable request tokens and unique source links prevent duplicates. Pending checks reserve capacity against duplicate instruments but do not reduce authoritative AR.
6. Granular server permissions, Owner-managed access, audited changes, safe projections. Reuse customer credit-limit storage with separate view/edit controls.
7. Native AR/Collections/Checks/statement UI; related links, dashboard/search, customer history. Statements reconstruct dated financial events. Refund due is tracked, never executed.
8. Isolated tests, all 143 existing tests, typecheck/build; restored-backup migration and exact preservation comparison. Ask Owner before original migration. Browser role/security acceptance and restart persistence; leave app running. No Stage 6.

Backup: backups/2026-09-17-stage5/local-db-before.tgz. Baseline: backups/2026-09-17-stage5/baseline.json. Preserve these and all Stage 4 evidence.
