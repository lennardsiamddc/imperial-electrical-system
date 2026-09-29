# Owner acceptance: request-origin fix — 2026-09-16

## Cause and correction

A real browser request to `http://127.0.0.1:3000/api/sales` carried Origin and Host `127.0.0.1:3000`, but Next reconstructed Request.url as `http://localhost:3000/api/sales`. Comparing Origin to that internal URL incorrectly returned 403. The frontend correctly used a relative request destination. APP_ORIGIN in .env.example is unused and was not the cause.

Added lib/request-origin.ts and connected both lib/sales-api.ts and lib/returns-api.ts. The shared guard compares the exact serialized HTTP(S) origin against incoming Host and the request scheme. Host aliases, different ports/schemes, missing/null/malformed origins are rejected. It does not trust arbitrary forwarded-host values or add an allowed-origin exception. Synthetic Requests without Host retain the previous strict URL comparison. Reverse proxies must preserve public Host and provide the correct scheme through the trusted server adapter; this fix does not configure a proxy deployment.

## Verification

- Full suite: **121 passed, 0 failed** (all 116 existing tests plus 5 new regressions). New files: tests/request-origin.test.ts and tests/request-origin-api.test.ts.
- Authenticated integration test reproduces internal localhost URL/public 127 Host, saves a Sale, concurrently replays the same submission and verifies one Sale/one line, saves a Sales setting and cancels the isolated TEST draft through Returns.
- Cross-origin, localhost alias, wrong port, missing/null origin and forwarded-header attacks rejected. Authenticated forged requests return 403 without audit mutation. Existing forged-role and permission tests remain intact and passed.
- PUT/PATCH/DELETE are not supported mutation methods on these APIs and remain 405; guard unit tests cover those methods for future reuse.
- Type checking: passed. Production webpack build: passed.
- Actual Owner browser at 127.0.0.1:3000: double-click Save Draft & Review succeeded before and after a clean application restart. Both review pages show the exact entered price and correct payable total. Owner session and first draft persisted.
- Preserved TEST drafts: S-000001 (04af9bc2-fec1-4334-818d-7d3913e00d05), reference TEST ORIGIN FIX BEFORE RESTART; S-000034 (a407b560-0804-4320-890b-db915cf2864a), reference TEST ORIGIN FIX AFTER RESTART. Sales list contains exactly these two drafts, no double-click duplicates. Neither was posted; available TEST product stock remained 2 PCS. Sale sequence numbers are not evidence of record counts.
- Products, Stock In, Customers, Suppliers, Administration and Tax Settings use native Next Server Actions, whose guard already checks incoming Origin/Host rather than Request.url. Non-mutating HTTP probes of every route, before and after restart, passed the legitimate origin boundary and rejected the forged origin before action lookup. These probes intentionally used a nonexistent action: valid origin reached action-not-found (404); forged origin produced Invalid Server Actions request. This is origin-boundary verification, not a claim that every business form was manually resubmitted.
- Sales, Returns and Sales & Returns Settings use the shared fixed API guards. No other custom mutation-origin comparisons remain.

## Preservation and scope

No migrations, database reset, record deletion, permission changes or business calculation changes. Existing records retained; only the two clearly labelled browser TEST drafts and their normal audit/request records were added to the existing database. Automated tests used disposable isolated databases. No changes to Sales/VAT/inventory/COGS logic. Excel checksum unchanged: d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19.

One new default-port test initially failed and was corrected before the all-green run. A test-only TypeScript unknown-number comparison was corrected; final typecheck/build and five-regression rerun passed. No unresolved failure for this origin fix. The local app is running at 127.0.0.1:3000 using the existing local startup mode. No next-stage work started.
