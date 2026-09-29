# Stage 1 verification — 15 September 2026

## Existing automated checks (completed before restart)

- TypeScript validation passed.
- Production Webpack build passed before the interrupted session. No production rebuild was performed during the resumed testing session.
- Ten integration checks passed against an isolated, clean embedded PostgreSQL engine: role matrix and combined roles, create/reference/decimal storage, case-insensitive uniqueness, restricted projections and forged writes, invalid precision/rates/UOM, edits and stale writes, audit immutability, user management and final-admin protection, revocation and password hashing.
- Local database migration completed successfully.

## Browser checks after restart

- Existing TEST President login succeeds using the existing database.
- Customer creation succeeds with two delivery addresses.
- Customer contact edit persists; Activity shows both CREATE and UPDATE with actor/time.
- Supplier creation succeeds.
- Product creation succeeds with ROLL → METER conversion of 150 and a linked TEST supplier.
- Product search by SKU and active-status filter returns the correct record.
- Case-insensitive duplicate SKU submission is rejected with a readable validation message.
- Administration renders the current user and all five role controls. Audit history shows user and master-record actions.
- At 390-pixel width, found and fixed search/status input overlap with a small CSS adjustment. Verified the stacked controls via hot reload, then restored the desktop viewport.
- Sign out returns to login. A subsequent direct visit to the product directory redirects to login.

## Review data retained

The local database retains the existing TEST President plus these browser-created records:

- `TEST-UI-C001` — TEST Browser Customer
- `TEST-UI-S001` — TEST Browser Supplier
- `TEST-UI-P001` — TEST Browser Wire

No pre-existing work or records were deleted. No workbook data was imported. Workbook SHA-256 remains `d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19`, matching the original.

## Remaining environment verification

Hosted PostgreSQL/Supabase connection, provider backup/restore and HTTPS production cookies require the actual deployment environment. Role behavior was tested in the service integration suite; separate browser sessions for each role were not performed. Stage 2+ transaction behavior is outside this implementation.
