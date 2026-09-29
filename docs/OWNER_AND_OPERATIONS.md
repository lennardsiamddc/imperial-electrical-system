# Imperial employee access and independent operation

## Owner workflow

Open **Administration → Employees & access**. Create an employee with an individual email and initial password, select one or more roles, review the effective permission table, and save. Multiple employees can share a role. There is no employee-count limit in the application or database. The integration suite creates 12 employees plus an Owner.

Use **Manage access** to change roles, set individual permission exceptions, reset a password or disable an account. Unchecking **Account enabled** blocks login and revokes the employee's current sessions. Enabling it again restores login but does not restore old sessions. Disabled accounts are retained with their UUIDs, assignments and audit history. There is no employee delete operation.

Only Owner/Admin may manage employees or inspect full audit snapshots. `PRESIDENT_ADMIN` remains the internal role identifier to preserve the existing database; the UI calls it **Owner/Admin**. The final enabled Owner cannot be demoted or disabled. Never share the Owner login with employees.

### Permission rules

The effective permission combines all selected roles, then applies individual Allow/Deny exceptions. An explicit Deny overrides combined role defaults. Denying a directory also blocks editing and sensitive fields in that directory. Owner/Admin always has full access; employee overrides cannot grant administration rights.

| Permission | Meaning |
| --- | --- |
| View customers / products / suppliers | Open that directory and its permitted record details |
| Create / edit customers / products / suppliers | Create, edit and activate/deactivate that directory's records; requires View |
| Customer credit information | Credit limit, terms, status and credit notes; editing also requires customer edit permission |
| Confidential costs and supplier details | Base price, standard cost, adjustment and default supplier; editing also requires product edit permission |
| Selling prices and VAT | Selling prices, meter selling price and VAT; editing also requires product edit permission |

Roles retain the Stage 1 defaults. Sales has customers and selling information; Accounting additionally has credit access; Warehouse/Inventory has product identity/UOM; Purchasing has suppliers, product editing and costs. Sensitive values are omitted from server query results for restricted users, not merely hidden with CSS.

The server reloads current access for reads and writes. The account-management transaction serializes privilege changes and retains last-Owner protection. Account edits revoke existing sessions. An edit form opened before a change cannot bypass the new permissions or the record-version check.

### Audit

Creates, edits, deactivations, role/permission changes, password resets and successful login/logout record the employee UUID and database timestamp. New events snapshot the employee name so renaming does not rewrite attribution. Older entries retain their original rows and use the current employee name as a fallback. Passwords, password hashes and session tokens are excluded from audit snapshots. Times in the UI use Asia/Manila.

## Zero AI runtime dependency

Imperial's business code has **no dependency on ChatGPT, Codex, Astra, an OpenAI API key or any OpenAI subscription**. Authentication, permissions, database writes, audit and UI are implemented locally in Node.js/PostgreSQL. Cancelling ChatGPT Plus does not remove an application feature or disable a login. Optional future AI must sit behind a separate adapter and may fail or be disabled without affecting core operations.

What must remain running is the ordinary application server and its database. A local preview process launched inside a development tool may stop when that tool closes. That is process hosting, not an AI subscription requirement. For independent use, launch from Terminal with a standalone Node.js installation, or host the application on an independent server. Do not depend on executable paths inside a Codex installation.

### Start the existing local workspace independently

Install standalone Node.js 22.13+ (Node 24 tested). This is a one-time machine prerequisite, not an AI service. With dependencies already installed, open Terminal:

```sh
cd "/Users/lennardsiamdelacruz/Desktop/IMPERIAL SYSTEM"
sh scripts/start-local.sh
```

Open `http://127.0.0.1:3000` in any browser. This script never reseeds, resets or deletes the database and does not create a production build. It uses the existing `.local-db` and installed dependencies. Keep the Terminal process open while using this local preview. Never run two app processes against the same PGlite directory.

For a fresh independent machine, install pnpm 11 and run `pnpm install --frozen-lockfile`. Package downloads require registry access during installation; core app usage does not require an AI connection. Preserve or restore the existing data instead of reseeding over it.

### Stop, restart and sign out

1. Finish any unsaved forms. To end your employee session, choose **Sign out** in Imperial. Closing a tab or stopping the server is not logout.
2. In the Terminal that runs Imperial, press **Control-C** and wait for the command prompt to return.
3. Restart with the same `sh scripts/start-local.sh` command from the same project folder. Never run a second process against `.local-db`.
4. Reload the browser. A valid session lasts up to eight hours and may survive an app restart. A logged-out, expired or revoked session must sign in again. Account changes and disabling an employee revoke their sessions.

If startup says another server is running, do not delete the database or build folders. Check the original Terminal and stop that server first. If it hangs, have the operator identify the exact process before terminating it; never stop unrelated Node applications. On 16 September a previously interrupted development process required a forced stop. Subsequent controlled restarts passed, but the original hang's cause has not been diagnosed.

### Local backup and recovery

These instructions apply to the default local `.local-db`, not a hosted `DATABASE_URL` or a custom `LOCAL_DB_PATH`.

Stop the app fully before copying PGlite files. From the project folder, create a uniquely named backup:

```sh
umask 077
mkdir -p backups
backup_stamp=$(date +%Y%m%d-%H%M%S)
tar -czf "backups/local-db-$backup_stamp.tgz" .local-db
tar -tzf "backups/local-db-$backup_stamp.tgz" >/dev/null
```

Keep an access-controlled copy on a separate device or backup service. A backup on this Mac alone does not protect against losing the Mac. Also preserve the application source, migrations, package manifest and lockfile, plus any environment configuration in secure storage. Database backups contain business data and password hashes; do not email them casually or commit them to source control. Archive readability alone is not proof of a successful database restore.

To rehearse recovery without overwriting the working database, stop the normal app, then extract a chosen archive into a **new empty folder**:

```sh
restore_dir=$(mktemp -d "$PWD/backups/restore-check.XXXXXX")
tar -xzf backups/REPLACE_WITH_CHOSEN_BACKUP.tgz -C "$restore_dir"
LOCAL_DB_PATH="$restore_dir/.local-db" sh scripts/start-local.sh
```

Replace the example archive name with the actual backup filename. Sign in and verify known records and audit history in the restored copy. Any edits during this rehearsal belong only to the copy. Stop that server before restarting the normal command without `LOCAL_DB_PATH`. Never extract a backup over the live `.local-db`, reseed it, or discard the original as part of troubleshooting. A live recovery requires a separately verified backup and an explicit decision about which data version becomes authoritative.

The pre-enhancement backup is under `backups/2026-09-16-access-foundation/`; it predates migration 002 and later audit events. For an older backup, apply the matching outstanding migrations to the **restored copy** before using the current app, with that copy's `LOCAL_DB_PATH` set. No restore rehearsal has yet been certified for production.

### Current machine readiness

The app was verified using an already available bundled Node runtime. Standalone Node is not currently available on the default Terminal PATH. Install and verify an independent Node runtime before relying on operation after removing Codex. This is a machine setup requirement; Imperial contains no AI subscription check or AI service requirement. The current launch script is a local development preview, not an unattended production service.

### Employee production deployment

Use standard PostgreSQL/Supabase and a persistent Node host with HTTPS for shared employee access. The existing `pg` connection pool serves multiple users; its pool size is not a user limit. `127.0.0.1` is a local preview address, not a shared office deployment. PGlite is for single-process local review, not a multi-instance deployment. Hosted PostgreSQL, TLS, backup restoration and concurrent load must be checked in the chosen hosting environment before live employee use.

Keep `DATABASE_URL` server-side. Run migrations with the migration-owner login, then use the restricted runtime database login described in README. Migration 002 also requires runtime EXECUTE permission on `imperial.valid_permission_overrides(jsonb)` and `imperial.stamp_audit_actor()` for validations and audit triggers. The schema must remain unexposed to browser/Supabase REST access.

Build for deployment using the project's normal build process when deployment is authorized; no production rebuild was needed for this enhancement. Use an operating-system service or hosting process manager so closing a development tool does not stop the business app. All hosting is independent of an AI account.

## UI foundation

Shared CSS tokens define deep red `#8b1e2d`, dark red `#54121d`, white surfaces, light gray canvas, borders and spacing. These follow the requested red company direction; an exact official color specification was not supplied. No new official logo was invented. `components/ui.tsx` supplies reusable page headers, notices and status badges. Existing tables use compact padding and consistent statuses. The employee page adopts these components without rewriting every screen.

## Stage 2.1 update

Use **Administration → Tax Settings** for prospective default-rate changes. See [VAT operations](STAGE21_VAT.md) for independent cost/selling controls, receipt snapshots, rounding and Owner acceptance requirements.

## Stage 2 update

Products and inventory are now implemented as described in [Stage 2 operations](STAGE2_INVENTORY.md). The historical recommendation below predates the new request: FIFO remains excluded, and Stage 3 has not begun.

## Next-module boundaries (historical Stage 1 plan)

Continue to reference stable user/customer/product/supplier UUIDs. Future inventory movements, stock receipts, FIFO allocations, quotation/order/DR/invoice chains, wholesale AR, collections, purchasing, expenses, reports and dashboard services should check explicit module permissions and write audit events inside the same transaction. Add their permissions through an additive migration and catalogue update when those modules are implemented. Do not use shared department accounts or spreadsheet totals as authoritative transaction balances.

Recommended next stage: Inventory/Stock-In, explicit UOM conversions and FIFO, beginning with approved stock-opening rules and costing examples. None of those workflows is implemented by this access enhancement.

## Stage 3 update — 16 September 2026

Sales, controlled SI/DR records, stock-out, Returns and cancellations now extend the preserved foundation. Follow the [Stage 3 operating guide](STAGE3_OPERATIONS.md); see the [verification and production acceptance report](STAGE3_COMPLETION_REPORT.md) for 115 passing tests, exact migration preservation, restart checks and remaining deployment requirements. Earlier “Stage 3 has not begun” statements describe the historical stage at which they were written. No Stage 4 work has begun.
