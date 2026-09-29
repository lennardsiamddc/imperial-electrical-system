SET search_path TO imperial, public;
CREATE SEQUENCE ar_number_seq;
CREATE SEQUENCE collection_number_seq;
CREATE TABLE receivables (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL UNIQUE DEFAULT ('AR-'||lpad(nextval('ar_number_seq')::text,6,'0')),
 invoice_id uuid UNIQUE REFERENCES commercial_documents(id), sale_id uuid UNIQUE REFERENCES sales(id),
 customer_id uuid REFERENCES customers(id), customer_snapshot jsonb NOT NULL, physical_number text NOT NULL DEFAULT '',
 source_number text NOT NULL, order_id uuid REFERENCES commercial_documents(id), salesperson_id uuid REFERENCES users(id),
 channel text NOT NULL, company text NOT NULL DEFAULT '', invoice_date date NOT NULL, terms text NOT NULL, custom_terms text NOT NULL DEFAULT '', due_date date NOT NULL,
 original_amount numeric(36,2) NOT NULL CHECK(original_amount>=0), actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(invoice_id,sale_id)=1)
);
CREATE TABLE collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL UNIQUE DEFAULT ('COL-'||lpad(nextval('collection_number_seq')::text,6,'0')),
 customer_id uuid REFERENCES customers(id), amount numeric(36,2) NOT NULL CHECK(amount>0), received_date date NOT NULL,
 method_id uuid NOT NULL REFERENCES sales_options(id), method_snapshot jsonb NOT NULL, account_id uuid REFERENCES sales_options(id), account_snapshot jsonb,
 reference text NOT NULL DEFAULT '', check_bank text NOT NULL DEFAULT '', check_number text NOT NULL DEFAULT '', check_date date,
 notes text NOT NULL DEFAULT '', legacy_payment_id uuid UNIQUE REFERENCES sale_payments(id), actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE collection_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES collections(id), ar_id uuid NOT NULL REFERENCES receivables(id),
 amount numeric(36,2) NOT NULL CHECK(amount>0), UNIQUE(collection_id,ar_id)
);
CREATE TABLE check_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES collections(id),
 status text NOT NULL CHECK(status IN ('Received','Deposited','Cleared','Returned / Bounced','Cancelled')),
 effective_date date NOT NULL, reason text NOT NULL DEFAULT '', actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE
);
CREATE TABLE collection_reversals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL UNIQUE REFERENCES collections(id), effective_date date NOT NULL,
 reason text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ar_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ar_id uuid NOT NULL REFERENCES receivables(id), return_id uuid NOT NULL REFERENCES sale_returns(id),
 amount numeric(36,2) NOT NULL CHECK(amount>0), effective_date date NOT NULL, reason text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ar_id,return_id)
);
CREATE TABLE ar_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ar_id uuid NOT NULL REFERENCES receivables(id), followup_date date NOT NULL,
 note text NOT NULL DEFAULT '', promise_date date, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE finance_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES users(id), operation text NOT NULL, payload_hash text NOT NULL, result_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ar_customer_due_idx ON receivables(customer_id,due_date);
CREATE INDEX collection_received_idx ON collections(received_date);
CREATE INDEX allocation_ar_idx ON collection_allocations(ar_id);
CREATE INDEX check_collection_idx ON check_events(collection_id,sequence DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['receivables','collections','collection_allocations','check_events','collection_reversals','ar_adjustments','ar_followups','finance_requests'] LOOP
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_immutable',t);
 IF t<>'finance_requests' THEN EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t); END IF;
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 END LOOP;
END $$;
REVOKE ALL ON SEQUENCE ar_number_seq,collection_number_seq FROM PUBLIC;

CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'object' THEN false ELSE NOT EXISTS (SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN ('ar.read','ar.generate','ar.aging','ar.overdue','ar.due','ar.paid','ar.customer','ar.followups','ar.followup.add','ar.promise','ar.promise.edit','ar.credit','ar.credit.edit','ar.statement','ar.adjust','collections.read','collections.record','collections.details','collections.accounts','collections.reverse','collections.checks','collections.check.update','collections.summary','quotations.read','quotations.create','quotations.edit','quotations.approve','quotations.convert','orders.read','orders.create','orders.edit','orders.confirm','orders.cancel','deliveries.read','deliveries.create','deliveries.assign','deliveries.finalize','invoices.read','invoices.create','invoices.assign','invoices.finalize','commercial.read','commercial.prices','commercial.cancel','customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit','returns.read','returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete','returns.financial') OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
