SET search_path TO imperial, public;
ALTER TABLE products ADD COLUMN pricing_rules jsonb CHECK(pricing_rules IS NULL OR jsonb_typeof(pricing_rules)='object');
ALTER TABLE sales ADD COLUMN vat_reference_mode text CHECK(vat_reference_mode IN ('Included','Excluded'));
ALTER TABLE commercial_documents ADD COLUMN vat_reference_mode text CHECK(vat_reference_mode IN ('Included','Excluded'));
CREATE TABLE vat_reference_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE,
 direction text NOT NULL CHECK(direction IN ('Input','Output')),
 source_kind text NOT NULL, source_id uuid NOT NULL, source_number text NOT NULL,
 effective_date date NOT NULL, basis_amount numeric(36,6) NOT NULL,
 vat_amount numeric(36,2) NOT NULL, rate_percent numeric(8,4) NOT NULL DEFAULT 12 CHECK(rate_percent=12),
 original_event_id uuid REFERENCES vat_reference_events(id), reason text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((original_event_id IS NULL AND basis_amount>=0 AND vat_amount>=0) OR (original_event_id IS NOT NULL AND basis_amount<=0 AND vat_amount<=0))
);
CREATE INDEX vat_reference_date ON vat_reference_events(effective_date,direction);
CREATE INDEX vat_reference_source ON vat_reference_events(source_kind,source_id);
CREATE TRIGGER vat_reference_immutable BEFORE UPDATE OR DELETE ON vat_reference_events FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER vat_reference_audit AFTER INSERT ON vat_reference_events FOR EACH ROW EXECUTE FUNCTION audit_sales();
REVOKE ALL ON vat_reference_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'object' THEN false ELSE NOT EXISTS (SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN ('vat.reference','ar.read','ar.generate','ar.aging','ar.overdue','ar.due','ar.paid','ar.customer','ar.followups','ar.followup.add','ar.promise','ar.promise.edit','ar.credit','ar.credit.edit','ar.statement','ar.adjust','collections.read','collections.record','collections.details','collections.accounts','collections.reverse','collections.checks','collections.check.update','collections.summary','quotations.read','quotations.create','quotations.fees','quotations.edit','quotations.approve','quotations.convert','orders.read','orders.create','orders.edit','orders.confirm','orders.cancel','deliveries.read','deliveries.create','deliveries.assign','deliveries.finalize','invoices.read','invoices.create','invoices.assign','invoices.finalize','commercial.read','commercial.prices','commercial.cancel','customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit','returns.read','returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete','returns.financial') OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
