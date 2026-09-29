# Stage 4 — staff and Owner operating guide

## Enter products once

1. Open **Quotations → New Quotation**. Search products by name, SKU or brand; search for an existing customer. Authorized customer creation opens a separate tab so the document form remains open.
2. Choose quantity, configured UOM, entered price, EX/INC and percentage discount. Add validity, terms, company, agent and notes. Save Draft & Review.
3. Submit for approval or approve with the appropriate permission. Mark sent/accepted as needed. An Approved or Accepted quotation can **Convert to Sales Order** once. Converted quotations retain their original snapshots.
4. Review and **Confirm Sales Order**. Neither quotation nor order confirmation deducts stock.
5. On the order, select Delivery Receipt, Sales Invoice or Release Goods (no DR), enter only the quantities for this document, and create its Draft. Ordered/delivered/invoiced/remaining quantities are shown per line and unit.

## When stock changes

- **Finalize DR & Release Goods** posts only that delivery’s quantities.
- If no physical DR is required, **Finalize Release Goods** does the same controlled posting.
- Each release creates one linked posted Sale using the existing weighted-average COGS engine. The previous system did not use FIFO; Stage 4 does not change costing methods.
- Creating/finalizing an SI does **not** post inventory or another Sale. An SI may precede delivery.
- Remaining undelivered quantities remain open. Draft documents do not reserve quantities. Competing drafts are rechecked when finalized; one may be rejected if another employee used the remaining quantity first.
- The details page links the quotation, order, deliveries, invoices and release Sales. Invoiced quantities are matched to releases through the original order lines, including advance invoices.

## Physical numbers

Internal Q-/SO-/DR-/SI-/REL- numbers are separate from physical numbers. Internal sequence numbers may have gaps and are never reused.

For DR and SI, enter the actual pre-printed number and select its series before finalizing. Leading zeros are retained. SI and DR series are independent. Numbers are reserved across both legacy and Stage 4 documents, even when a Draft is cancelled. A spoiled numbered Draft must be cancelled with a reason and replaced using a new physical number.

## Invoices and partial deliveries

Create an invoice from the order for all or part of its remaining uninvoiced quantities. Alternatively use **Create Invoice for this delivery** on a finalized DR/release.

The system bills quantities in order-line sequence. A delivery-specific invoice cannot bill an advance-invoiced quantity again. If earlier order quantities are still uninvoiced, invoice them from the order first. After a partial invoice, use the order quantity form for its remaining balance; the delivery shortcut requests the full delivery and will reject quantities already billed.

Splitting a document preserves its frozen VAT and monetary totals. Centavos are allocated cumulatively so the final partial conserves the agreed amount. A later Product Master or Tax Settings change does not rewrite existing document snapshots.

## Changes, cancellations and Returns

- Independent Draft quotations and independently created Draft orders can be edited with optimistic version checking.
- Converted order snapshots are locked. Correct the commercial agreement before conversion; an amendment/version workflow is not implemented in this stage.
- Draft/eligible unfinalized documents can be cancelled with a reason; linked documents must be resolved first.
- Finalized releases cannot be silently voided. Follow **Posted Sale / Returns** and use the existing controlled Return/Cancellation workflow. Original movements, costs and audit remain; authorized return restocking creates separate movements.
- Returns do not automatically reopen the order’s historical delivered quantity or cancel its invoice. This prevents unapproved replacement shipments or billing corrections.
- Finalized invoice credit/correction/void accounting is not automated. These documents are locked pending an approved accounting correction workflow.
- No over-delivery or over-invoicing override is provided. Increased quantities need a separately agreed new order; confirmed-order amendments are a remaining limitation.

## Employee access

Owner/Admin has access. Existing employee grants were not automatically expanded. Use **Administration → Employees & access** to grant the new module permissions to individual employees.

Grant **commercial.read** plus the relevant quotations/orders/deliveries/invoices read and action permissions. Named customers also require Customer access. Creating priced quotations/orders requires **commercial.prices**, Sales price access and Product access. Existing price-override/discount permissions continue to apply. Goods finalization additionally requires **sales.post**, **sales.prices** and **inventory.issue** through the existing engine. Cost/COGS/profit access remains separate and protected.

Approval, conversion, confirmation, physical-number assignment, finalization and cancellation are separately controlled. Every request reloads the employee’s active account and current permissions. Disabling an account blocks its session without removing its historical documents.

## Search, printing and audit

New sidebar listings show one document per row, searchable by internal number, physical number, customer or salesperson, with date and stored-status filters. Order delivery/invoice progress is also shown; those derived progress labels are not standalone status-filter values.

Dashboard Recent Quotations uses actual authorized records. Global Search includes the new document references.

Use **Printable view**, then the browser’s Print command. Print content excludes acquisition cost, COGS and profit. Final printer/pre-printed alignment and physical form acceptance remain later work. Do not treat this layout as calibrated to Imperial’s paper forms.

Owner audit history includes commercial_documents and commercial_lines, with actor, timestamp and before/after snapshots. Release Sales, inventory movements and Return records retain their existing audits and source references.

## Independence and deployment

No AI service, API key or subscription is used for normal operations. Startup remains `sh scripts/start-local.sh` with standalone Node installed. The existing PostgreSQL deployment/backup requirements still apply. Local embedded-database concurrent tests are not a production multi-worker PostgreSQL load certification.

Stage 5 AR/Collections, full commissions and printer calibration were not started.
