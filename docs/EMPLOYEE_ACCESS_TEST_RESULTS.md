# Employee access enhancement — 16 September 2026

## Changes

- Extended the existing Owner/Admin page with employee search, role/status filters, shared and multiple roles, and per-employee Allow/Deny/default rules with an effective-access preview.
- Kept the internal `PRESIDENT_ADMIN` identifier, existing authentication and master records. The user-facing label is Owner/Admin.
- Added current-access checks to master reads, writes, lookup options, employee queries and audit queries. Employees cannot grant themselves Owner access or retrieve restricted cost/credit fields through these services.
- Added successful login/logout and password-reset audit events. New audit events retain the actor's name at the time of the action as well as the permanent UUID.
- Preserved disabled users, historical associations and audit entries. Account edits revoke sessions. Last-active-Owner and stale-edit protections remain enforced.
- Added red/white/light-gray design tokens and reusable page-header, notice and status-badge components. Existing screens and logic were retained.
- Added independent Terminal launch instructions and a standard-Node startup script; no AI SDK or AI service was added.

## Migration and files

Applied **002_employee_access.sql**, an additive migration containing permission overrides, database validation, audit actor-name snapshots and indexes. Migration 001 was not rewritten. The migration runner now applies recorded migrations in order under a lock.

Changed: `lib/permissions.ts`, `lib/users.ts`, `lib/auth.ts`, `lib/masters.ts`, `scripts/migrate.ts`, `app/actions.ts`, the Administration/audit and customer-detail pages, application layout, `components/user-form.tsx`, `app/globals.css`, existing Stage 1 tests, `.gitignore`, and README.

Added: `lib/sessions.ts`, `lib/audit.ts`, `lib/migrations.ts`, `components/ui.tsx`, `tests/employee-access.test.ts`, `scripts/verify-upgrade.ts`, `scripts/start-local.sh`, and Owner/operations documentation.

Before the upgrade, source and database backups were saved under `backups/2026-09-16-access-foundation/`. The preservation check compared all existing account/password/session, customer, supplier, product and audit data before/after migration and after replay. It passed: one original user, one customer, one product, one supplier, five original audit records and one original session survived the migration unchanged. Later browser logins and an unchanged Owner-profile save intentionally added audit events and replaced sessions.

## Automated results

**27 tests passed; 0 failed. TypeScript validation passed.**

Coverage includes 12 individual employees plus Owner; shared and combined roles; distinct credentials/sessions; individual cost grants and explicit denials; dependency of edit/cost access on directory access; self-promotion and forged-role rejection; Owner-only employee/audit access; disabled credential/session rejection; reactivation; password-reset revocation; last-Owner protection; duplicate employee emails, customer/supplier codes and SKUs; stale edits; decimal validation; original master CRUD/search; preserved actor attribution; immutable audit; logout/expiry; persistent rate limiting; and close/reopen persistence for users, permissions, sessions, master records and audit.

Independent-operation checks found no AI SDK or AI endpoint in core runtime code/dependencies, and login, session resolution, master reads and logout passed with external fetch disabled. This is a regression guard, not a claim that every possible network transport is sandboxed by that test.

The 12 employee test accounts were created only in isolated temporary databases, not in the existing local workspace. Existing TEST master records and Owner credentials were retained.

## Browser results

- Original Owner credentials sign in after migration.
- Employee management renders correctly with Imperial red branding and compact controls.
- Effective permission preview grants Sales cost visibility when allowed, then blocks it when product-directory access is denied.
- Existing Owner profile loads with its original email, name and role.
- Saving the unchanged Owner profile through the UI revokes its session; the original password still works on the next login.
- Resumed verification after the usage interruption on 16 September: the existing server process was present but unresponsive. Graceful termination closed its port but left the process running; the first restart was rejected by Next's existing-process lock. Force-stopping that exact process allowed the existing app to start without deleting files or resetting the database.
- After recovery, the pre-existing browser session opened the dashboard without credentials being re-entered. Customer `TEST-UI-C001`, product `TEST-UI-P001`, and supplier `TEST-UI-S001` remained visible with their original UUID links; the customer retained TEST Updated Contact and the product retained ROLL.
- Browser Sign out completed. Direct navigation to Administration redirected to login. Signing in with the original Owner credentials succeeded.
- A subsequent controlled stop exited normally. Restarting through `scripts/start-local.sh` and reloading preserved the signed-in session and Owner access to Administration.
- Audit history after that restart displayed the five original events, the earlier account update/login events, and the new LOGIN/LOGOUT events with TEST President and Manila timestamps.
- Signed out again, stopped/restarted normally, and directly requested Administration: it still redirected to login. Logout therefore remained effective after restart. The app is left running at its login page.

## Final verification status

The resumed run again passed **27 automated tests, zero failures**, plus `tsc --noEmit` and startup-script shell syntax validation. Multi-employee role/permission and disabled-user cases ran through the actual domain/database services in isolated PGlite databases; they were not repeated using real employee browser accounts. Browser checks used the preserved original Owner only. PGlite test success does not certify hosted PostgreSQL permissions or production concurrency.

Workbook SHA-256 remains `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`. No workbook edits, record deletions, reseeding, production rebuild, source replacement or new migration occurred during this continuation. Only this report and `docs/OWNER_AND_OPERATIONS.md` were edited. Login/logout generated their intended audit events and session changes.

### Failed or unresolved observations

- Initial preview responsiveness and first restart failed because of the stuck prior process. Recovery and two subsequent controlled restarts passed. The original hang's root cause remains unresolved; do not treat this preview as a proven unattended production service.
- Initial browser-control requests timed out while the old process was unresponsive; browser checks completed after recovery.
- Server logs included a missing `/favicon.ico` response (404), a cosmetic item rather than an authentication/data failure.
- No functional automated test is currently failing.

### Required before production sign-off

1. Install an independent Node runtime and configure a persistent production host/service; demonstrate that closing/removing the development tool does not stop Imperial. The current machine uses a bundled runtime, although the application has no AI runtime dependency.
2. Produce and validate an up-to-date production build in a deployment workspace. No build was performed in this preservation-only continuation; existing production artifacts are not certification of the enhancement.
3. Run migrations and the access regression checks on the selected hosted PostgreSQL database using the restricted runtime login. Verify HTTPS, secure cookies and private database/schema exposure there.
4. Prove scheduled backups and restoration into a separate database, including recovery objectives and record/audit reconciliation.
5. Test concurrent employee sessions and conflicting writes under representative 10+ user load; review deployment security and session behavior on the actual host. The 12-employee automated test establishes account support, not a load benchmark.
6. Obtain approved real employee identities/role assignments, securely replace development credentials, and complete Owner/employee acceptance testing without deleting the existing TEST history. Plan any production data migration separately.

## Limits and next stage

No production build/replacement was performed. Hosted PostgreSQL/Supabase, HTTPS, backup restoration and production concurrency still require the selected deployment environment. Actual employee names, emails and approved access assignments were not supplied, so no real employee accounts were invented. The design tokens follow the requested deep-red direction; exact official color values remain to be confirmed if brand specifications become available.

Recommended next stage: Inventory/Stock-In/UOM/FIFO with approved opening-stock and costing rules. No next module was started.
