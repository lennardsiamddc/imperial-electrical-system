# Stage 2.1 — Philippine VAT foundation

## Scope and reference

Imperial remains the same centralized web application. This stage adds deterministic VAT calculations, Owner-controlled settings, independent product cost/selling controls and permanent receipt VAT snapshots. It adds no sales document workflow, general ledger, tax return, FIFO or AI service dependency.

The initial standard rate is 12.00%, configured once in migration 004. BIR references distinguish regular VAT, zero-rated sales and exempt transactions: [BIR VAT information](https://www.bir.gov.ph/value-addedtax), [BIR published ruling quoting the 12% rate in Section 106](https://bir-cdn.bir.gov.ph/BIR/pdf/BIR%20Ruling%20No.%20ITAD-027-25.pdf), and [RR 10-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2010-2025%20%281%29.pdf). These references support the configuration and distinction; Imperial does not determine whether a particular transaction legally qualifies for exemption, zero-rating or input-tax recovery.

## Owner Tax Settings

Open **Administration → Tax Settings**. Only an active Owner/Admin can read the full settings page or save changes. Enter a standard percentage and a reason. Saving applies immediately, increments the configuration version, records effective/update times and creates an employee-attributed audit event containing before/after values. Stale updates are rejected.

The rate may be 0–100%, with up to four decimal places in the percentage. Business calculations receive this configuration; they do not embed 1.12. Zero-Rated and VAT-Exempt snapshots retain those distinct treatments and use an applied rate of zero, while recording the configured standard rate separately.

A settings change never updates products or existing receipts. Existing product snapshots retain their saved rate until someone explicitly saves configured product monetary fields again. Such a save uses the current configuration and is audited. Open forms include the version used for their preview and must reload if the Owner changes it before saving.

Configuration is effective at save time, not a scheduled rate calendar. Backdated receipts use the configuration displayed at posting, not an automatically reconstructed historical rate. Review applicable rates before entering older purchases; historical-rate selection/scheduling is not included.

## Independent selling and cost controls

Product Master has separate:

- Selling tax treatment and selling entry mode.
- Cost tax treatment, cost entry mode and input VAT recovery choice.

Treatments: **VATable**, **Zero-Rated**, **VAT-Exempt**. Modes: **VAT Inclusive**, **VAT Exclusive**. All four cost/selling mode combinations are supported. Neither side inherits the other's treatment or mode.

The selling controls apply to retail, contractor, wholesale and meter selling prices. Retail and acquisition cost show live previews; saved detail pages also expose separate contractor/wholesale/meter breakdowns. Acquisition cost remains per primary UOM. Base price and supplier adjustment remain existing commercial reference fields; neither automatically determines acquisition cost.

### Entered amounts and the EX / INC dropdown

The dropdown interprets the exact entered amount independently for cost and selling. Entering 500 cost EX and 700 selling EX retains 500 and 700 as the primary amounts. Selecting INC retains the entered amount and displays its extracted net and VAT. Changing either dropdown never converts either input or changes the other dropdown.

Additional calculated equivalents, recoverable VAT, economic cost and snapshot metadata are available under **View VAT Details**. An EX amount's calculated gross is only a tax detail; it never replaces the entered selling price or acquisition cost. Existing economic valuation and recovery rules below remain unchanged.

At configured rate `r`:

- Inclusive: net = entered / (1 + r); VAT = entered − rounded net; gross = entered.
- Exclusive: net = entered; VAT = net × r; gross = net + rounded VAT.
- Zero-Rated and VAT-Exempt: VAT = zero, net = gross = entered; treatment remains distinct.

At 12%, selling 1,120 inclusive or 1,000 exclusive gives net 1,000, output VAT 120 and gross 1,120. Acquisition 560 inclusive or 500 exclusive gives net 500, input VAT 60 and gross 560.

## Recoverable VAT, inventory cost and estimated profit

**Not recoverable** is the default for an unconfigured product's recovery control. The Owner's approved product choice can prefill a receipt and can be changed for that individual receipt. A full-recovery choice stores the VAT separately; a nonrecoverable choice includes it in economic cost. The software does not infer eligibility from the supplier name or from the selling treatment.

| Receipt choice | Inventory/economic cost | Recoverable input VAT | Supplier amount |
| --- | --- | --- | --- |
| 560 inclusive at 12%, recoverable | 500 | 60 | 560 |
| 560 inclusive at 12%, not recoverable | 560 | 0 | 560 |
| 500 exclusive at 12%, recoverable | 500 | 60 | 560 |

Each VAT-configured receipt feeds its **line economic cost** into the existing `total_cost` valuation field. `unit_cost` continues to mean the entered unit amount. The snapshot contains net, input VAT, gross, recoverable VAT and economic amounts separately. Weighted-average stock-out continues to consume available inventory value; it neither creates output VAT nor treats recoverable input VAT as COGS. No historical valuation is rewritten.

Configured product estimated profit = VAT-exclusive retail revenue − economic acquisition cost. Recoverable VAT is excluded from economic cost; nonrecoverable VAT remains in it. Markup divides estimated profit by economic cost; margin divides it by net retail revenue. Zero denominators display no percentage. If only one side has been VAT-configured, profit estimates are withheld until both sides are configured. If neither side is configured, the original estimate remains explicitly labelled as a legacy, unreviewed tax basis. These are estimates, not accounting profit or a VAT return.

## Receipt snapshots and future sales reuse

Every new stock receipt through the web form must select tax treatment, entry mode and recovery. Its own settings may differ from Product Master. The server calculates and stores `cost_vat` with entered/net/VAT/gross unit amounts, applied and configured rates, treatment/mode, recovery amounts, line totals, quantity, configuration version/effective time and rounding policy. Existing ledger fields preserve product/UOM/supplier/reference/time/employee details.

Snapshots are stored in the immutable ledger and appear in the Owner audit event. Product edits and future default-rate changes cannot recalculate them. Replaying a request retains the original snapshot; conflicting details, including an explicitly different configuration version, are rejected.

`lib/vat.ts` exposes pure decimal functions and a sales-only snapshot helper for future quotations/sales/invoices. The sales snapshot omits acquisition-cost and input-VAT fields. No Stage 3 routes or transactions were built.

## Precision policy

`Money` centrally uses Decimal.js, 60 significant digits and **ROUND_HALF_UP**. No financial formula uses native JavaScript floating-point arithmetic.

- Product monetary inputs retain Stage 1's two-decimal limit; product snapshots use two decimals.
- Receipt unit amounts retain six-decimal input/storage support and six-decimal unit breakdowns.
- Authoritative supplier, VAT and economic **line totals round to two decimals (centavos)**. The line calculation uses entered unit amount × quantity before splitting VAT, rather than multiplying rounded unit net/VAT figures.
- Inclusive VAT is the difference between rounded gross and rounded net. Exclusive gross is rounded net plus rounded VAT. Each snapshot reconciles net + VAT = gross.
- Inventory stores the resulting centavo economic line value in its existing six-decimal field. Weighted-average issues retain the existing six-decimal method and full-depletion residual handling.

For 3 units entered at 0.333333 inclusive, gross line total is 1.00; at 12%, net is 0.89 and VAT 0.11. Unit display precision and line rounding can differ by centavos; line totals are authoritative. This rounding convention requires Owner/accountant acceptance before live invoice integration.

## Preservation and legacy handling

Migration 004 only adds configuration and nullable product/receipt VAT fields. It does not UPDATE old business rows, infer inclusion from the old `vat_status`/`vat_rate`, divide historical costs, or recreate tables. Existing Stage 1 fields remain for compatibility, but the separate new snapshots govern configured VAT behavior.

Older receipts have `cost_vat = NULL` and explicitly show that no VAT snapshot was recorded. Their original cost/value remains unchanged. A mixed ledger can therefore contain untouched legacy values and new economic-cost values; review and reconcile opening balances separately before live accounting use.

Old internal service callers remain compatible for legacy/unconfigured records. New browser receipt submissions require complete VAT controls, and a VAT-configured product cannot receive a legacy receipt without VAT details. A configured product's monetary values cannot be updated while silently dropping the associated VAT configuration. Do not use old internal service calls as an import shortcut; reviewed imports need a separately approved mapping.

## Permissions, audit and deployment

Existing permission combinations remain authoritative. Product cost controls/snapshots/input VAT require product cost access; selling controls/output VAT require price access. Profit requires both. Receipt VAT/cost snapshots require inventory value access (which also requires product cost access). Server query projections omit restricted fields before API serialization. Tax Settings administration rechecks the active Owner in the database; forged caller roles do not confer access.

The existing product audit trigger records tax treatment, entry mode, recovery and price/cost changes and their calculated snapshots. Receipt audit includes its complete VAT snapshot. A new Tax Settings audit trigger records configuration updates, reason, employee and timestamps. The initial configuration row is migration data, not a fictitious employee action.

After backup, apply `pnpm db:migrate` with the migration-owner connection and restart normally. For production, extend the restricted runtime login with SELECT/UPDATE on `imperial.tax_settings` and EXECUTE on `imperial.audit_tax_settings()`. Retain all earlier grants and immutable-ledger restrictions; do not expose the private schema to browser/Supabase REST clients.

Stage 2 production prerequisites remain: independent Node/persistent hosting, a current deployment build, HTTPS, real PostgreSQL grants/concurrency verification, off-device backup/restore, and an approved correction workflow. No production build, hosted deployment or record reset was performed in this stage.

## Owner acceptance required for operational sign-off

Confirm transaction tax classification, evidence for recoverable input VAT, full-versus-no recovery policy (partial recovery is not implemented), legacy balance treatment, line-centavo rounding, posting-time rate policy and prospective product repricing. No automatic BIR classification, tax-credit allocation/refund, filing, general ledger, receipt reversal, historical-rate selector or scheduled rate activation is claimed.
