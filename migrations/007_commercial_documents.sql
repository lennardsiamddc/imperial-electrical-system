SET search_path TO imperial, public;
CREATE SEQUENCE commercial_number_seq;
CREATE TABLE commercial_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('Q','SO','DR','SI','RELEASE')),
 number text NOT NULL UNIQUE, source_id uuid REFERENCES commercial_documents(id),
 status text NOT NULL DEFAULT 'Draft', version integer NOT NULL DEFAULT 1,
 occurred_at timestamptz NOT NULL, customer_id uuid REFERENCES customers(id), customer_snapshot jsonb NOT NULL,
 salesperson_id uuid REFERENCES users(id), salesperson_snapshot jsonb, channel text NOT NULL,
 platform_id uuid REFERENCES sales_options(id), platform_snapshot jsonb,
 terms text NOT NULL, custom_terms text NOT NULL DEFAULT '', due_date date,
 company text NOT NULL DEFAULT 'Imperial Electrical and Industrial Supply Corporation', validity date,
 notes text NOT NULL DEFAULT '', tax_config jsonb NOT NULL, payment_method_id uuid REFERENCES sales_options(id),
 si_required boolean NOT NULL DEFAULT false, dr_required boolean NOT NULL DEFAULT false,
 subtotal numeric(36,2) NOT NULL, discount_total numeric(36,2) NOT NULL, entered_total numeric(36,2) NOT NULL,
 net_total numeric(36,2) NOT NULL, vat_total numeric(36,2) NOT NULL, gross_total numeric(36,2) NOT NULL,
 physical_number text, series_id uuid REFERENCES sales_options(id), sale_id uuid UNIQUE REFERENCES sales(id),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL DEFAULT '', finalized_at timestamptz, finalized_by uuid REFERENCES users(id),
 CHECK((physical_number IS NULL AND series_id IS NULL) OR (kind IN ('DR','SI') AND physical_number IS NOT NULL AND series_id IS NOT NULL)),
 CHECK((kind='Q' AND status IN ('Draft','For Approval','Approved','Sent','Accepted','Rejected','Expired','Converted','Cancelled')) OR
 (kind='SO' AND status IN ('Draft','Confirmed','Cancelled')) OR (kind IN ('DR','SI','RELEASE') AND status IN ('Draft','Finalized','Cancelled')))
);
CREATE UNIQUE INDEX commercial_one_conversion ON commercial_documents(source_id) WHERE kind='SO' AND source_id IS NOT NULL;
CREATE INDEX commercial_source_idx ON commercial_documents(source_id,kind,status);
CREATE INDEX commercial_customer_idx ON commercial_documents(customer_id,occurred_at DESC);
CREATE TABLE commercial_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES commercial_documents(id), position integer NOT NULL,
 source_line_id uuid REFERENCES commercial_lines(id), product_id uuid NOT NULL REFERENCES products(id),
 product_name text NOT NULL, sku text NOT NULL, brand text NOT NULL, category text NOT NULL,
 quantity numeric(24,6) NOT NULL CHECK(quantity>0), uom text NOT NULL, stock_quantity numeric(30,6) NOT NULL,
 stock_uom text NOT NULL, conversion numeric(18,6) NOT NULL, entered_price numeric(24,6) NOT NULL,
 vat_mode text NOT NULL, tax_treatment text NOT NULL, discount_percent numeric(9,6) NOT NULL,
 discount_rules jsonb NOT NULL, vat_snapshot jsonb NOT NULL,
 subtotal numeric(36,2) NOT NULL, discount_amount numeric(36,2) NOT NULL, entered_amount numeric(36,2) NOT NULL,
 net_amount numeric(36,2) NOT NULL, vat_amount numeric(36,2) NOT NULL, gross_amount numeric(36,2) NOT NULL,
 active boolean NOT NULL DEFAULT true
);
CREATE INDEX commercial_line_source_idx ON commercial_lines(source_line_id);
CREATE TABLE commercial_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), operation text NOT NULL, payload_hash text NOT NULL,
 document_id uuid NOT NULL REFERENCES commercial_documents(id), created_at timestamptz NOT NULL DEFAULT now()
);
-- A separate registry adds protection across old and new documents without rewriting old rows.
CREATE TABLE physical_document_registry (
 series_id uuid NOT NULL REFERENCES sales_options(id), normalized_number text NOT NULL,
 legacy_id uuid REFERENCES sale_documents(id), commercial_id uuid REFERENCES commercial_documents(id),
 PRIMARY KEY(series_id,normalized_number), CHECK(num_nonnulls(legacy_id,commercial_id)=1)
);
INSERT INTO physical_document_registry(series_id,normalized_number,legacy_id)
 SELECT series_id,lower(btrim(number)),id FROM sale_documents WHERE number IS NOT NULL;
CREATE FUNCTION register_physical_document() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.number IS NOT NULL AND (TG_OP='INSERT' OR OLD.number IS DISTINCT FROM NEW.number OR OLD.series_id IS DISTINCT FROM NEW.series_id) THEN
 INSERT INTO physical_document_registry(series_id,normalized_number,legacy_id) VALUES(NEW.series_id,lower(btrim(NEW.number)),NEW.id);
 END IF; RETURN NEW; END $$;
CREATE TRIGGER legacy_physical_registry AFTER INSERT OR UPDATE ON sale_documents FOR EACH ROW EXECUTE FUNCTION register_physical_document();
CREATE FUNCTION protect_commercial_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='commercial_lines' THEN
 IF (SELECT status FROM commercial_documents WHERE id=OLD.document_id)<>'Draft' THEN RAISE EXCEPTION 'Final document lines are immutable'; END IF;
 ELSE
 IF OLD.status<>'Draft' AND (to_jsonb(NEW)-ARRAY['status','version','updated_at','reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','updated_at','reason']) THEN RAISE EXCEPTION 'Final document snapshots are immutable'; END IF;
 IF OLD.sale_id IS NOT NULL AND NEW.sale_id IS DISTINCT FROM OLD.sale_id THEN RAISE EXCEPTION 'Posting link is permanent'; END IF;
 END IF; RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commercial_documents','commercial_lines'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION protect_commercial_history()',t||'_history',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_no_delete',t);
 EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['commercial_requests','physical_document_registry'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_immutable',t);
 END LOOP;
END $$;
REVOKE ALL ON commercial_documents,commercial_lines,commercial_requests,physical_document_registry FROM PUBLIC;
REVOKE ALL ON SEQUENCE commercial_number_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION register_physical_document(),protect_commercial_history() FROM PUBLIC;

CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'object' THEN false ELSE NOT EXISTS (SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN ('quotations.read','quotations.create','quotations.edit','quotations.approve','quotations.convert','orders.read','orders.create','orders.edit','orders.confirm','orders.cancel','deliveries.read','deliveries.create','deliveries.assign','deliveries.finalize','invoices.read','invoices.create','invoices.assign','invoices.finalize','commercial.read','commercial.prices','commercial.cancel','customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit','returns.read','returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete','returns.financial') OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
ALTER TABLE commercial_documents ADD COLUMN source_delivery_id uuid REFERENCES commercial_documents(id);
CREATE INDEX commercial_invoice_delivery_idx ON commercial_documents(source_delivery_id);
