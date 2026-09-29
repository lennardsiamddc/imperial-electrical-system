# Stage 5.5 — Owner layout and number-format review

Status: isolated implementation; Owner acceptance pending. No authorization to migrate 009/010 or begin Stage 6.

## Changes

- Direct-edit quotation architecture retained.
- Quantity and UOM have independent 80px/82px columns, borders and alignment. METER and the native dropdown fit. Narrow screens scroll the document horizontally instead of squeezing columns together.
- Product autocomplete uses a wrapping textarea with a matching size element. Short rows remain compact; only long rows expand. Print uses the complete static description. Existing PDF renderer wraps rows and moves complete rows across pages.
- One Contact input. Literal text is stored as `customer_snapshot.quotation_contact`; older snapshots fall back to their existing combined contact information. Customer master and historical phone/email/person values are preserved. No schema migration.
- Quantity presentation removes trailing zeros using decimal strings, with no rounding. Applied to quotation input/print/PDF, downstream commercial listings/detail/print/entry/fulfilment displays, and linked Sale document previews.
- Quotation currency uses ₱, thousands separators, and exactly two decimal places. Editing a price reveals its original precision; focus/blur alone never writes a rounded value. Unit Price, fees, amounts and totals share the same formatter. Calculations and saved numeric precision remain unchanged.

## Verification

- Complete automated suite: 214 passed, 0 failed, 0 skipped. Includes existing Stage 1–5.5 security/concurrency coverage, five authenticated employee sessions, and new Contact/quantity/currency/PDF-row tests.
- Type checking and production build: passed.
- 24 authenticated module routes: HTTP 200 and expected content.
- Browser: saved Q-000201, reopened it, verified single Contact, quantity 1.25 and unit price ₱1,234.57. Actual server snapshot retains quantity 1.250000 and price 1234.567800.
- Desktop 1280px, narrow 621px and 480px: no header overlap or description clipping. Short rows 29px; long rows grow to 65px at desktop and 101px at narrower document width.
- 45-row sample includes 36 consecutive/mixed 170-character descriptions and 9 short descriptions. Four-page PDF inspected page by page. No clipped descriptions or intersecting rows. PDF download event verified in browser.
- Print button invoked; print CSS carries the full descriptions and formatted values and hides controls. Native print-dialog inspection is unavailable in this tool environment. Physical printing remains an Owner acceptance item; it is not reported as passed.
- Restored pre-existing records compare exactly: passed. Additional records are isolated TEST acceptance records. Original database and Excel were not modified. Excel SHA-256: d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19.
- Restart and saved-state checks: passed. Complete isolated system remains at http://127.0.0.1:3002.

## Review

Sample quotation: http://127.0.0.1:3002/quotations?id=133c941c-434e-4157-9263-589f2f623faf

Review all currently implemented modules through the main navigation. No original-database migration is requested during Owner review. Production deployment and physical document calibration remain separate.
