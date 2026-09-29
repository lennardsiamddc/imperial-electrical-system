# Isolated operational pricing redesign

Owner authorization: entered amounts only; no operational VAT transformations; Retail/Contractor price lists; internal SI/DR Only intent. No original migration, no reapplication of 009/010, no Stage 6.

## Integration plan

1. Add a versioned entered-amount calculation policy. Keep historical VAT functions/snapshots as legacy evidence; remove all runtime calls that transform new amounts. Preserve old posted financial and FIFO values.
2. Store per-UOM Retail/Contractor price maps and optional customer defaults. Add internal price-list/document-flow metadata to saved documents. New additive schema, isolated only; compare every pre-existing column before/after.
3. New editable documents use raw decimal multiplication/cascading factors, with exact intermediate values in snapshots and centavo settlement values. No VAT amount is computed for new transactions.
4. Product and Stock-In retain only purchasing VAT INC/EX tags. Hide obsolete calculation/treatment/recovery controls and tax-settings mutation UI.
5. Price-list changes prompt Update Existing Items / Keep Existing Prices. Existing snapshots never reprice on conversion. Return documents refer to original agreed price; no master-price lookup.
6. Document Flow is an internal classification only. It does not bypass invoice finalization, AR creation or goods-release controls.
7. One consolidated regression/type/build pass after implementation, followed by focused fixes only if failures require them. Preserve old VAT tests as explicit legacy-policy coverage; update operational expectations to the new approved policy.

Historical limitation: old FIFO acquisition amounts and posted invoice/AR balances were calculated under the former rules. Recalculating them would reinterpret history and is not authorized. They remain frozen; the new policy applies to newly entered/revised operational amounts.
