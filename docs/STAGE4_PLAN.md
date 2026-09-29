# Stage 4 implementation plan

Owner confirmed actual goods release as the only Stage 4 stock-posting point. Existing weighted-average costing is preserved (there is no existing FIFO engine). Quotation, order confirmation and invoice issue alone never post stock.

- Add normalized commercial documents/lines, source links, quantity allocations and idempotency records. Quotation and SO snapshots retain original product, UOM, discount and VAT details.
- Finalized DR or explicit no-DR Release Goods creates exactly one linked Sale and calls the existing posting engine in the same transaction. The commercial service must not implement another stock-out algorithm.
- Invoice quantity allocations remain independent of deliveries. Invoice-to-release links are derived by shared order lines, including invoices issued first. Cumulative final quantities are locked at the order; draft competing allocations cannot exceed limits when finalized.
- Partial monetary allocations use cumulative rounding of the frozen order amounts to conserve totals across arbitrarily split deliveries/invoices.
- Add Owner-managed document permissions, shared strict origin guard, immutable history/audit and globally protected physical number registry encompassing legacy documents.
- Reuse the Imperial shell and existing search-first controls. Listings show one document per row; details show source and children; customer print views never contain costs/profit.
- Preserve originals: stopped backup, 26-table count/hash baseline plus workbook checksum; isolated migration tests; restore backup to a separate directory; upgrade and compare every old table; ask before original migration.
- Acceptance: existing suite plus document/quantity/concurrency/security/audit/persistence regressions, typecheck/build, browser flows on an isolated upgraded database. No Stage 5, AR engine, commission engine, FIFO conversion or printer alignment.
