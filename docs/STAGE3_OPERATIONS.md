# Stage 3 — Sales and Returns operating guide

Updated 16 September 2026. Use with [independent operation and backups](OWNER_AND_OPERATIONS.md) and the [completion report](STAGE3_COMPLETION_REPORT.md). The local app remains at `http://127.0.0.1:3000`. Stage 4 has not begun.

## Enter and post a Sale

1. Sign in with your own employee account. Open **Sales → New Sale**.
2. Choose Wholesale, Retail or Online. Wholesale requires an active Customer Master record; Retail and Online can use Walk-in. Online also records the platform and order reference.
3. Search products by name/code and add each as its own line. Check quantity, UOM, entered selling price, EX/INC and any authorized percentage discount. There is no ten-line limit. The list shows one row per Sale, with actual product names and a link to all lines.
4. Select terms and payment information. Record only money actually received. A payment method or Paid label does not substitute for the received amount. Conditional check/bank fields appear when applicable. SI and DR requirements are independent.
5. Save the Draft. Saving does not deduct stock. Review the complete Sale before choosing **Post**.
6. Posting checks current permissions and available stock again. All lines post together, or none do. Repeating a completed posting does not deduct stock again. If another employee changed the Draft, reload and review it instead of overwriting their work.

Posted Sales preserve their original customer/product names, prices, VAT, discounts, units and cost snapshots. Later master-data changes do not rewrite them. Use a Return or controlled cancellation to correct a Posted Sale; do not edit its original stock-out.

## Entered price and VAT

Buying and selling VAT modes remain independent. Always check the selling dropdown; do not assume INC. The primary price remains exactly the entered price in its selected mode. Percentage discount applies first.

| Entered unit price | Discount | Net amount | VAT at 12% | Customer payable |
|---|---:|---:|---:|---:|
| ₱700 EX | 0% | ₱700 | ₱84 | ₱784 |
| ₱784 INC | 0% | ₱700 | ₱84 | ₱784 |
| ₱700 EX | 10% | ₱630 | ₱75.60 | ₱705.60 |
| ₱784 INC | 10% | ₱630 | ₱75.60 | ₱705.60 |

The examples are the Owner-approved standard VATable calculation. Other product tax treatments use their configured rules. Product defaults do not authorize an employee to change prices or discounts. Legacy products without a selling VAT mode require an explicit selection by an authorized user.

## SI and DR control

The internal `S-` number is separate from the actual SI and DR numbers. Mark a document required, then an authorized employee assigns its actual series and number. Leading zeros are preserved. A number cannot be reused within its document type/series, including after voiding. Voiding retains history; assign a replacement through the document controls. A late document requirement or assignment does not post stock again.

The preview is a layout foundation. It is not a calibrated pre-printed form or certification of a compliant tax document. Test actual stationery and printer alignment before relying on it for official issuance. SI and DR permissions are separate; a DR does not disclose COGS or profit.

## Returns and cancellations

### Draft cancellation

Use the cancellation action on the Draft and give a reason. The record remains visible. It creates no stock-out, revenue or COGS posting.

### Return against a Posted Sale

1. Open the original Sale and choose **Return**. Select original lines and quantities; enter the reason. Use the online case/reference field for marketplace returns.
2. An authorized employee approves it. In Transit is optional.
3. Record actual receipt. Received quantities are reserved against the original Sale so two employees cannot receive more than was sold. Receipt alone does not restore stock or accept a financial adjustment.
4. Inspect each line: Sellable, Damaged, Defective, For Inspection or Other. Record condition notes. A received/inspected claim can still be rejected before acceptance/restocking. Resolve For Inspection before completion.
5. Restock only inspected Sellable items. This creates new linked stock-in entries using the original Sale's unit conversion and historical economic COGS. Damaged, Defective and Other never automatically become available stock.
6. Complete the Return after required restocking. Accepted quantities and historical net/VAT/COGS allocations remain immutable. Multiple partial Returns cannot exceed the original quantity.

Each Return has a unique `RTN-` number, employee/time history and a link to the original Sale. Original SI/DR numbers, stock-outs and payments stay intact. Sale activity shows Return Pending, Partially Returned or Fully Returned; original customer payable remains the historical original amount.

**A Return does not issue a refund.** Refund status is initially Not recorded. The system retains references for future refund/credit/settlement integration but does not invent cash payments, tax credit documents or damaged-goods accounting journals. Management/accounting must handle those under the approved business process until that separate module is authorized.

### Posted cancellation

An employee with cancellation permission can create a controlled cancellation covering all remaining unreturned lines. It follows the same receipt, inspection and stock-restoration controls. Completion links a reversal to the original Sale and shows Cancelled/Reversed activity. Already returned quantities are not reversed again. No record or controlled document number is erased.

## Owner controls

Use **Administration → Employees & access** for individual accounts, shared/multiple roles and Allow/Deny exceptions. New permissions use the existing system; there is no hard-coded employee list or five-user limit. Disabling an account revokes its access while retaining its transactions and audit attribution.

Key dependencies:

- Sale posting requires Sales posting and Inventory stock-out permission, plus access to selling prices.
- Sales prices require Product selling-price access. COGS requires Product cost access. Profit/margin require COGS and price access.
- Return actions require Sales/Returns view access plus their individual workflow permission. Return financial access also requires Sales COGS and selling-price access.
- Customer create/edit permissions supplement the existing Customer edit permission; they do not override an explicit denial.
- Price override, percentage discount application, payment editing, SI/DR assignment/printing, cancellation and Return approval/receiving/inspection/restocking/completion can be granted separately.

Permission changes are enforced on the server, including direct API calls. Existing account changes revoke sessions; employees may need to sign in again.

Use **Administration → Sales & Returns settings** for payment methods, receiving-account labels, platforms, SI/DR series and optional platform return-window references. Do not put bank credentials in labels. Return policies are versioned and copied into new Returns; an assumed seven-day limit is not enforced. Owner configuration changes do not rewrite historical snapshots.

## Restart, backup and independent operation

Follow the existing [Owner operating instructions](OWNER_AND_OPERATIONS.md). Stop the local server before copying `.local-db`; never run two processes against it. Start it using standalone Node with `sh scripts/start-local.sh`. Do not reseed or extract a backup over the live directory. Existing sessions can survive a restart until expiry; **Sign out** ends a session.

Core operations require only the application server and database. They do not call ChatGPT, Codex, Astra or OpenAI APIs. This Mac still needs an independently installed Node runtime and a persistent hosting/service arrangement before it can be treated as an unattended system independent of the development tool.

For shared production operation, use PostgreSQL and HTTPS. Apply migrations with the database owner, then use a restricted runtime database account. In addition to the earlier-stage grants, Stage 3 needs schema USAGE, SELECT/INSERT/UPDATE on its mutable Sales/line/document/configuration/Return tables, SELECT/INSERT on immutable request/payment/event/reversal history, and USAGE/SELECT on `sales_number_seq` and `return_number_seq`. No business-history DELETE grants are needed. Grant EXECUTE as required on `business_document_number(text,bigint)`, `audit_sales()`, `protect_sales_history()`, `protect_document_identity()`, `protect_return_lines()`, `protect_return_header()` and the updated existing permission/audit functions. Validate these privileges with the actual runtime account before deployment; do not expose the `imperial` schema through browser-accessible database APIs. The exact hosted deployment has not been tested here.

## Before live use

Owner and representative employees must accept the workflows and permission assignments. Verify the chosen PostgreSQL deployment, backups/restoration, HTTPS, independent runtime and concurrent load. Calibrate official forms if used. Agree on the separate refund/tax-document process. Keep the workbook as the unchanged reference until an approved data migration occurs.
