# Migration 008 — original database results

Completed 17 September 2026 following explicit Owner approval.

## Fresh backup, verified before migration

- Original port-3000 server stopped before backup; no concurrent database writer.
- Backup: `backups/stage5-original-approved-20260917-193123/local-db-before.tgz`.
- Archive SHA-256: `828d56520af0e5f02b7d6871f8677926e0fe555218276905a1d29b458192e6c7`.
- Restored into `verified-restore/.local-db` under that backup folder.
- All **1,164 database files** matched by relative path and SHA-256 after restoration.
- Restored database opened successfully and matched the fresh original snapshot: **30 existing business/runtime tables plus the seven original schema-migration rows**. Excel and migration-file hashes matched.
- Evidence: `archive-verification.json`, `baseline.json`, retained restored database.

## Migration result

Applied **008 only**, in a single database transaction after asserting versions 001–007 exactly. Executed `008_receivables.sql` and inserted only its migration-history entry. No reset, reseed, reconciliation/import, deletion or historical business-row modification was run.

Versions afterward: 001, 002, 003, 004, 005, 006, 007, 008.

Eight new financial tables exist and each contains **0 rows**:
receivables, collections, collection_allocations, check_events, collection_reversals, ar_adjustments, ar_followups, finance_requests.

Unvalidated database constraints: **0**.

## Preservation result

Two post-migration comparisons, before restarting/login, matched every pre-existing table count/hash exactly. The original seven migration-history rows were unchanged; only 008 was added. Excel was unchanged.

Workbook SHA-256: `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`.

Preserved records explicitly checked:

- S-000001 — Draft.
- S-000034 — Draft.
- Q-000001 — Quotation, Draft.

No unexpected database differences, migration errors or preservation failures occurred. Evidence: `post-migration-verification.json` in the fresh backup folder.

## Application verification

- Regression suite: **175 passed, 0 failed**, including all 143 Stage 1–4 baseline tests. Tests use isolated databases.
- Type checking: **passed after resolving generated-cache duplication** (see discrepancy below).
- Production build: **passed**.
- Original Imperial restarted successfully at `http://127.0.0.1:3000` using its existing local startup script.
- Browser Owner login succeeded using the existing account.
- Dashboard showed both existing Draft Sales and the Draft Quotation; Pending AR was ₱0.00.
- AR opened with zero records and zero aging/pending-check balances.
- Collections opened with zero records and configured payment methods.
- Check Monitoring opened with zero records and expected status filters.
- No original financial TEST scenarios were created or imported. Browser login added only normal authentication/session/audit activity after the exact migration-preservation comparisons.

Logs: `test-results/stage5-original-regression.txt`, `stage5-original-typecheck.txt`, `stage5-original-build.txt`.

## Non-database discrepancy and resolution

The first type check failed on duplicate generated declarations in `.next/types/cache-life.d 2.ts` and `.next/types/routes.d 2.ts`. Investigation found 45 generated cache copies with ` 2.` in their names. They were moved intact to the fresh backup's `generated-cache-duplicates` folder with `.preserved` extensions and a SHA-256 manifest, so TypeScript no longer compiled the duplicates. No application source logic or database data was changed to resolve this. Type checking and production build then passed. Initial error log retained as `test-results/stage5-original-typecheck-initial.txt`.

## Boundary

Stage 5 original migration and requested application checks are complete. Existing Stage 4/Stage 5 backups and rehearsal evidence are retained. No Stage 6 started. Production hosting/HTTPS, standalone runtime installation, PostgreSQL load verification, staff acceptance, printer calibration and operational monitoring/recovery remain separate deployment gates. See Stage 5 verification and operations reports for feature limitations.
