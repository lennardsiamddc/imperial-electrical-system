SET search_path TO imperial, public;
ALTER TABLE products ADD COLUMN selling_prices jsonb CHECK(selling_prices IS NULL OR jsonb_typeof(selling_prices)='object');
ALTER TABLE customers ADD COLUMN default_price_list text CHECK(default_price_list IN ('Retail','Contractor'));
ALTER TABLE commercial_documents ADD COLUMN price_list text CHECK(price_list IN ('Retail','Contractor')), ADD COLUMN document_flow text CHECK(document_flow IN ('SI','DR Only'));
ALTER TABLE sales ADD COLUMN price_list text CHECK(price_list IN ('Retail','Contractor')), ADD COLUMN document_flow text CHECK(document_flow IN ('SI','DR Only'));
-- No UPDATE, DELETE, seed, or reinterpretation of historical rows.
