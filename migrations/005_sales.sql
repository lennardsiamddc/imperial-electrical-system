SET search_path TO imperial, public;
-- Additive Sales foundation. Existing business rows and immutable ledger remain unchanged.
CREATE TABLE sales_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('platform','payment_method','bank','si_series','dr_series')),
 code text NOT NULL, name text NOT NULL, behavior text NOT NULL DEFAULT 'Other', active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,code)
);
INSERT INTO sales_options(kind,code,name,behavior) VALUES
 ('platform','shopee','Shopee','Other'),('platform','lazada','Lazada','Other'),('platform','direct','Direct Online','Other'),('platform','website','Website','Other'),('platform','other','Other','Other'),
 ('payment_method','cash','Cash','Cash'),('payment_method','gcash','GCash','Wallet'),('payment_method','maya','Maya','Wallet'),('payment_method','bank','Bank Transfer','Bank'),('payment_method','check','Check','Check'),('payment_method','card','Credit/Debit Card','Card'),('payment_method','platform','Online Platform Settlement','Platform'),('payment_method','unpaid','To Be Collected / Unpaid','Unpaid'),('payment_method','other','Other','Other'),
 ('si_series','default','Default SI series','SI'),('dr_series','default','Default DR series','DR');
CREATE FUNCTION business_document_number(prefix text, value bigint) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT prefix || lpad(value::text,greatest(6,length(value::text)),'0') $$;
REVOKE ALL ON FUNCTION business_document_number(text,bigint) FROM PUBLIC;
CREATE SEQUENCE sales_number_seq;
CREATE TABLE sales (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 number text NOT NULL UNIQUE DEFAULT business_document_number('S-',nextval('sales_number_seq')),
 status text NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Posted','Cancelled','Reversed')),
 version integer NOT NULL DEFAULT 1, channel text NOT NULL CHECK(channel IN ('Wholesale','Retail','Online')),
 occurred_at timestamptz NOT NULL, customer_id uuid REFERENCES customers(id), customer_snapshot jsonb NOT NULL,
 platform_id uuid REFERENCES sales_options(id), platform_snapshot jsonb,
 reference text NOT NULL DEFAULT '', online_reference text NOT NULL DEFAULT '', creation_hash text NOT NULL, terms text NOT NULL, custom_terms text NOT NULL DEFAULT '', due_date date,
 salesperson_id uuid REFERENCES users(id), salesperson_snapshot jsonb,
 payment_status text NOT NULL DEFAULT 'Unpaid' CHECK(payment_status IN ('Unpaid','Partially Paid','Paid')),
 payment_intent jsonb NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '',
 tax_config jsonb NOT NULL, line_count integer NOT NULL DEFAULT 0, quantities jsonb NOT NULL DEFAULT '{}',
 subtotal numeric(36,2) NOT NULL DEFAULT 0, discount_total numeric(36,2) NOT NULL DEFAULT 0,
 entered_total numeric(36,2) NOT NULL DEFAULT 0, net_total numeric(36,2) NOT NULL DEFAULT 0, vat_total numeric(36,2) NOT NULL DEFAULT 0, gross_total numeric(36,2) NOT NULL DEFAULT 0,
 cogs numeric(36,6), profit numeric(36,6), gross_margin numeric(24,6),
 created_by uuid NOT NULL REFERENCES users(id), actor_name text NOT NULL, posted_by uuid REFERENCES users(id), posted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), cancelled_reason text,
 reversal_of uuid REFERENCES sales(id), CHECK(channel<>'Online' OR platform_id IS NOT NULL)
);
CREATE TABLE sale_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id), position integer NOT NULL,
 product_id uuid NOT NULL REFERENCES products(id), product_name text NOT NULL, sku text NOT NULL, brand text NOT NULL, category text NOT NULL,
 quantity numeric(24,6) NOT NULL CHECK(quantity>0), uom text NOT NULL CHECK(uom IN ('PCS','BOX','ROLL','METER')),
 stock_quantity numeric(30,6) NOT NULL, stock_uom text NOT NULL, conversion numeric(18,6) NOT NULL,
 entered_price numeric(24,6) NOT NULL CHECK(entered_price>=0), vat_mode text NOT NULL, tax_treatment text NOT NULL,
 discount_percent numeric(9,6) NOT NULL CHECK(discount_percent BETWEEN 0 AND 100), discount_rules jsonb NOT NULL DEFAULT '[]',
 subtotal numeric(36,2) NOT NULL, discount_amount numeric(36,2) NOT NULL, entered_amount numeric(36,2) NOT NULL,
 vat_snapshot jsonb NOT NULL, net_amount numeric(36,2) NOT NULL, vat_amount numeric(36,2) NOT NULL, gross_amount numeric(36,2) NOT NULL,
 movement_id uuid UNIQUE REFERENCES inventory_movements(id), cogs numeric(36,6), profit numeric(36,6), cost_snapshot jsonb,
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE sale_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id), request_id uuid NOT NULL UNIQUE,
 method_id uuid NOT NULL REFERENCES sales_options(id), method_snapshot jsonb NOT NULL,
 amount numeric(36,2) NOT NULL CHECK(amount>0), received_at timestamptz NOT NULL,
 account_id uuid REFERENCES sales_options(id), account_snapshot jsonb,
 reference text NOT NULL DEFAULT '', check_bank text NOT NULL DEFAULT '', check_number text NOT NULL DEFAULT '', check_date date,
 actor_id uuid NOT NULL REFERENCES users(id), actor_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), reversal_of uuid REFERENCES sale_payments(id)
);
CREATE TABLE sales_document_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('SI','DR')), name text NOT NULL,
 version integer NOT NULL DEFAULT 1, paper_width_mm numeric, paper_height_mm numeric, layout jsonb NOT NULL DEFAULT '{}',
 calibration jsonb NOT NULL DEFAULT '{}', active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO sales_document_templates(kind,name) VALUES('SI','Sales Invoice — awaiting physical form measurements'),('DR','Delivery Receipt — awaiting physical form measurements');
CREATE TABLE sale_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id), kind text NOT NULL CHECK(kind IN ('SI','DR')),
 status text NOT NULL CHECK(status IN ('Not Required','Required / Pending','Assigned','Printed','Cancelled / Void')),
 series_id uuid REFERENCES sales_options(id), series_snapshot jsonb, number text,
 template_id uuid REFERENCES sales_document_templates(id), template_version integer,
 replaces_id uuid REFERENCES sale_documents(id), reason text NOT NULL DEFAULT '',
 assigned_by uuid REFERENCES users(id), assigned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((number IS NULL AND series_id IS NULL) OR (number IS NOT NULL AND series_id IS NOT NULL))
);
-- Voiding never releases an assigned physical number for reuse.
CREATE UNIQUE INDEX sale_document_number_unique ON sale_documents(series_id,lower(btrim(number))) WHERE number IS NOT NULL;
CREATE TABLE sale_document_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES sale_documents(id), sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
 quantity numeric(24,6) NOT NULL CHECK(quantity>0), UNIQUE(document_id,sale_line_id)
);
-- Separate delivery events and document-line quantities leave room for later partial fulfillment.
CREATE TABLE sale_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id), document_id uuid REFERENCES sale_documents(id),
 occurred_at timestamptz, status text NOT NULL DEFAULT 'Planned', notes text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_date_idx ON sales(occurred_at DESC,id);
CREATE INDEX sales_customer_idx ON sales(customer_id,occurred_at DESC);
CREATE INDEX sales_channel_idx ON sales(channel,occurred_at DESC);
CREATE INDEX sales_platform_idx ON sales(platform_id,occurred_at DESC);
CREATE INDEX sales_agent_idx ON sales(salesperson_id,occurred_at DESC);
CREATE INDEX sales_status_idx ON sales(status,occurred_at DESC);
CREATE UNIQUE INDEX sale_lines_position_unique ON sale_lines(sale_id,position) WHERE active;
CREATE INDEX sale_lines_sale_idx ON sale_lines(sale_id,active,position);
CREATE INDEX sale_lines_product_idx ON sale_lines(product_id,sale_id);
CREATE INDEX sale_payments_sale_idx ON sale_payments(sale_id);
CREATE INDEX sale_documents_sale_idx ON sale_documents(sale_id,kind);
CREATE INDEX sale_documents_number_idx ON sale_documents(lower(number));
CREATE FUNCTION audit_sales() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor := nullif(current_setting('imperial.actor_id',true),'')::uuid;
 IF actor IS NULL THEN RAISE EXCEPTION 'Sales changes require an employee'; END IF;
 INSERT INTO audit_log(actor_id,entity,record_id,action,before_data,after_data)
 VALUES(actor,TG_TABLE_NAME,NEW.id,TG_OP,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE FUNCTION protect_sales_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Sales history cannot be deleted'; END IF;
 IF TG_TABLE_NAME='sales' THEN
  IF OLD.status<>'Draft' THEN RAISE EXCEPTION 'Completed sales are immutable; controlled reversal is required'; END IF;
 ELSIF TG_TABLE_NAME='sale_lines' THEN
  SELECT status INTO parent_status FROM sales WHERE id=NEW.sale_id;
  IF parent_status<>'Draft' THEN RAISE EXCEPTION 'Completed sale lines are immutable'; END IF;
  IF TG_OP='UPDATE' AND NEW.sale_id<>OLD.sale_id THEN RAISE EXCEPTION 'Sale line ownership is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION protect_document_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sale_id<>OLD.sale_id OR NEW.kind<>OLD.kind THEN RAISE EXCEPTION 'Document ownership is immutable'; END IF;
 IF OLD.number IS NOT NULL AND (NEW.number,NEW.series_id) IS DISTINCT FROM (OLD.number,OLD.series_id) THEN RAISE EXCEPTION 'Void and replace assigned documents'; END IF;
 IF OLD.status='Cancelled / Void' THEN RAISE EXCEPTION 'Voided documents are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sales_history BEFORE UPDATE OR DELETE ON sales FOR EACH ROW EXECUTE FUNCTION protect_sales_history();
CREATE TRIGGER sale_lines_history BEFORE INSERT OR UPDATE OR DELETE ON sale_lines FOR EACH ROW EXECUTE FUNCTION protect_sales_history();
CREATE TRIGGER sale_document_identity BEFORE UPDATE ON sale_documents FOR EACH ROW EXECUTE FUNCTION protect_document_identity();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sales','sale_lines','sale_payments','sale_documents','sale_document_lines','sale_deliveries','sales_options','sales_document_templates'] LOOP
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t);
  IF t NOT IN ('sales','sale_lines') THEN EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_no_delete',t); END IF;
 END LOOP;
END $$;
CREATE TRIGGER sale_payments_immutable BEFORE UPDATE ON sale_payments FOR EACH ROW EXECUTE FUNCTION reject_delete();
REVOKE ALL ON sales,sale_lines,sale_payments,sale_documents,sale_document_lines,sale_deliveries,sales_options,sales_document_templates FROM PUBLIC;
REVOKE ALL ON SEQUENCE sales_number_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_sales(),protect_sales_history(),protect_document_identity() FROM PUBLIC;

CREATE INDEX sales_payment_status_idx ON sales(payment_status,occurred_at DESC);
CREATE INDEX sales_terms_idx ON sales(terms,occurred_at DESC);
CREATE INDEX sales_mop_idx ON sales((payment_intent->>'method_id'));
CREATE INDEX sale_payments_method_idx ON sale_payments(method_id,sale_id);
CREATE INDEX sales_online_reference_idx ON sales(online_reference);
CREATE TABLE sales_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), operation text NOT NULL,
 payload_hash text NOT NULL, sale_id uuid NOT NULL REFERENCES sales(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sale_reversals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE, sale_id uuid NOT NULL UNIQUE REFERENCES sales(id),
 reason text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), actor_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sale_reversal_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reversal_id uuid NOT NULL REFERENCES sale_reversals(id), sale_line_id uuid NOT NULL UNIQUE REFERENCES sale_lines(id),
 movement_id uuid NOT NULL UNIQUE REFERENCES inventory_movements(id), quantity numeric(24,6) NOT NULL, cogs numeric(36,6) NOT NULL
);
CREATE TABLE sale_online_settlements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id),
 listed_price numeric(36,2),customer_paid numeric(36,2),platform_voucher numeric(36,2),seller_discount numeric(36,2),
 platform_fees numeric(36,2),shipping_adjustment numeric(36,2),withholding_tax numeric(36,2),actual_payout numeric(36,2),
 reference text, status text NOT NULL DEFAULT 'Not reconciled'
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sales_requests','sale_reversals','sale_reversal_lines'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_immutable',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['sale_reversals','sale_reversal_lines','sale_online_settlements'] LOOP
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t);
 END LOOP;
END $$;
REVOKE ALL ON sales_requests,sale_reversals,sale_reversal_lines,sale_online_settlements FROM PUBLIC;
CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'object' THEN false ELSE NOT EXISTS (SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN ('customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit') OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
