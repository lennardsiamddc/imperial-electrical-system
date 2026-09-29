# Stage 2.1 VAT entry correction — 16 September 2026

## Result

Backend inspection confirmed product standard_cost, retail_price and receipt unit_cost already retain entered amounts. VAT snapshots separately store entered, net, VAT and gross. No formulas, services, migrations or stored snapshots required changes.

Updated components/vat-editor.tsx to place the independent EX/INC dropdown beside each amount, retaining existing submitted values and treatment/recovery controls. Updated components/vat-summary.tsx to prioritize entered amount plus mode, show automatic INC extraction, and put additional calculations under View VAT Details. This shared summary covers product previews, saved products and receipt details.

## Verification

- TypeScript check: passed.
- Entire existing Stage 1 / 2 / 2.1 suite plus eight new checks: **67 passed, 0 failed, 0 skipped**.
- tests/stage21.test.ts adds four persisted combinations: buy500EX/sell700EX; buy560INC/sell700EX; buy500EX/sell784INC; buy560INC/sell784INC. Each closes/reopens its isolated database and checks original fields, entered snapshots, independent modes, net/VAT and profit.
- tests/vat-entry-display.test.ts adds four component checks: primary entered amount/mode; EX equivalents inside initially closed details; INC net/VAT extraction visible.
- Existing tests retained: permissions/direct API filtering, disabled users, authentication/logout, audit, immutable history, VAT-rate/version protection, inventory, duplicates, persistence and offline/AI-independent operation.
- Browser verified all four combinations on an unsaved product form. EX500/EX700 displayed those entered amounts. INC560 extracted500+60; INC784 extracted700+84. Switching selling from INC to EX retained input784 and left buying INC unchanged.
- Existing TEST-S21-VAT-001 viewed afterward: cost560INC, retail1000EX, original timestamps retained; saved summaries show entered values and collapsed optional details.

## Preservation and limits

No live records were submitted or changed. No database reset or migration. Tests used separate temporary databases. Existing TEST records and historical VAT snapshots were not rewritten. Original workbook SHA256 remains d5b7130eac006a67036288dfa14ea981ccc47c73250ed0d7a594ebb8bd0dfc19.

No known failure remains for this correction. Database reopening was tested automatically; the live application was not restarted for this display-only correction. Production deployment and the previously documented operational/accounting sign-off prerequisites remain separate. Stage 2.2 and Stage 3 were not started.

Files changed: components/vat-editor.tsx, components/vat-summary.tsx, tests/stage21.test.ts, tests/vat-entry-display.test.ts, docs/STAGE21_VAT.md and this report.
