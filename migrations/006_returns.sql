SET search_path TO imperial, public;
-- Additive return history. No rewrites to existing Sales, stock-outs or documents.
CREATE SEQUENCE return_number_seq;
CREATE TABLE sale_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE, payload_hash text NOT NULL,
 number text NOT NULL UNIQUE DEFAULT business_document_number('RTN-',nextval('return_number_seq')),
 sale_id uuid NOT NULL REFERENCES sales(id), kind text NOT NULL DEFAULT 'Return' CHECK(kind IN ('Return','Cancellation')),
 status text NOT NULL DEFAULT 'Return Requested' CHECK(status IN ('Return Requested','Approved','In Transit','Received','Inspected','Restocked','Rejected','Completed','Cancelled')),
 reason text NOT NULL CHECK(length(btrim(reason))>=3), requested_at timestamptz NOT NULL, received_at timestamptz,
 platform_snapshot jsonb, platform_order_reference text NOT NULL DEFAULT '', platform_case_reference text NOT NULL DEFAULT '',
 return_policy_snapshot jsonb, notes text NOT NULL DEFAULT '',
 refund_status text NOT NULL DEFAULT 'Not recorded' CHECK(refund_status IN ('Not recorded','Refund Pending','Partially Refunded','Refunded')),
 actor_id uuid NOT NULL REFERENCES users(id), actor_name text NOT NULL,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,sale_id)
);
CREATE TABLE sale_return_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), return_id uuid NOT NULL REFERENCES sale_returns(id), sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
 quantity numeric(24,6) NOT NULL CHECK(quantity>0), uom text NOT NULL,
 condition text NOT NULL DEFAULT 'For Inspection' CHECK(condition IN ('Sellable','Damaged','Defective','For Inspection','Other')),
 condition_notes text NOT NULL DEFAULT '', accepted boolean NOT NULL DEFAULT false,
 stock_quantity numeric(30,6) CHECK(stock_quantity>0), historical_cogs numeric(36,6) CHECK(historical_cogs>=0),
 entered_amount numeric(36,2),discount_amount numeric(36,2),net_amount numeric(36,2),vat_amount numeric(36,2),gross_amount numeric(36,2),
 original_vat_snapshot jsonb, original_cost_snapshot jsonb,
 movement_id uuid UNIQUE REFERENCES inventory_movements(id), inspected_by uuid REFERENCES users(id), inspected_at timestamptz,
 UNIQUE(return_id,sale_line_id), CHECK(movement_id IS NULL OR (accepted AND condition='Sellable')),
 CHECK(NOT accepted OR (stock_quantity IS NOT NULL AND historical_cogs IS NOT NULL AND original_vat_snapshot IS NOT NULL AND net_amount IS NOT NULL AND vat_amount IS NOT NULL AND gross_amount IS NOT NULL))
);
CREATE TABLE sale_return_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),return_id uuid NOT NULL REFERENCES sale_returns(id),request_id uuid NOT NULL UNIQUE,
 payload_hash text NOT NULL, action text NOT NULL,from_status text,to_status text,reason text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL REFERENCES users(id),actor_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
-- These are references for later refund/settlement integration, not cash payments.
CREATE TABLE sale_return_refund_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),return_id uuid NOT NULL REFERENCES sale_returns(id),
 kind text NOT NULL CHECK(kind IN ('Platform Refund','Store Refund','Credit / Offset')),
 reference text NOT NULL,notes text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_return_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),platform_id uuid NOT NULL REFERENCES sales_options(id),
 version integer NOT NULL CHECK(version>0),window_days integer CHECK(window_days>=0),
 starts_from text NOT NULL CHECK(starts_from IN ('Delivery','Sale','Platform specified')),
 notes text NOT NULL DEFAULT '',effective_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(platform_id,version)
);
ALTER TABLE sale_reversals ADD COLUMN return_id uuid UNIQUE REFERENCES sale_returns(id);
CREATE INDEX returns_sale_idx ON sale_returns(sale_id,created_at DESC);
CREATE INDEX returns_status_idx ON sale_returns(status,requested_at DESC);
CREATE INDEX returns_case_idx ON sale_returns(platform_case_reference);
CREATE INDEX returns_order_idx ON sale_returns(platform_order_reference);
CREATE INDEX return_lines_original_idx ON sale_return_lines(sale_line_id,accepted);
CREATE INDEX return_events_parent_idx ON sale_return_events(return_id,created_at);
CREATE FUNCTION protect_return_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_sale uuid; original sale_lines%ROWTYPE; used numeric; parent_status text;
BEGIN
 SELECT sale_id,status INTO parent_sale,parent_status FROM sale_returns WHERE id=NEW.return_id;
 -- All acceptance/restock operations share the Sale lock, including concurrent returns.
 PERFORM 1 FROM sales WHERE id=parent_sale AND status='Posted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Returns require a Posted Sale'; END IF;
 SELECT * INTO original FROM sale_lines WHERE id=NEW.sale_line_id AND sale_id=parent_sale AND active;
 IF NOT FOUND OR original.movement_id IS NULL THEN RAISE EXCEPTION 'Return line must belong to the original Posted Sale'; END IF;
 IF NEW.uom<>original.uom OR NEW.quantity>original.quantity OR (NEW.uom<>'METER' AND trunc(NEW.quantity)<>NEW.quantity) THEN RAISE EXCEPTION 'Invalid Return quantity or unit'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.return_id,NEW.sale_line_id,NEW.quantity,NEW.uom) IS DISTINCT FROM (OLD.return_id,OLD.sale_line_id,OLD.quantity,OLD.uom) THEN RAISE EXCEPTION 'Return line identity and requested quantity are immutable'; END IF;
  IF OLD.accepted AND (NEW.accepted,NEW.stock_quantity,NEW.historical_cogs,NEW.entered_amount,NEW.discount_amount,NEW.net_amount,NEW.vat_amount,NEW.gross_amount,NEW.original_vat_snapshot,NEW.original_cost_snapshot) IS DISTINCT FROM (OLD.accepted,OLD.stock_quantity,OLD.historical_cogs,OLD.entered_amount,OLD.discount_amount,OLD.net_amount,OLD.vat_amount,OLD.gross_amount,OLD.original_vat_snapshot,OLD.original_cost_snapshot) THEN RAISE EXCEPTION 'Accepted Return allocations are immutable'; END IF;
  IF OLD.movement_id IS NOT NULL THEN RAISE EXCEPTION 'Restocked Return lines are immutable'; END IF;
 END IF;
 IF parent_status IN ('Rejected','Cancelled','Completed') THEN RAISE EXCEPTION 'Closed Returns are immutable'; END IF;
 IF NEW.accepted OR parent_status IN ('Received','Inspected','Restocked') THEN
  SELECT COALESCE(sum(r.quantity),0) INTO used FROM sale_return_lines r JOIN sale_returns h ON h.id=r.return_id WHERE r.sale_line_id=NEW.sale_line_id AND r.id<>NEW.id AND (r.accepted OR h.status IN ('Received','Inspected','Restocked'));
  IF used+NEW.quantity>original.quantity THEN RAISE EXCEPTION 'Return quantity exceeds remaining quantity sold'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION protect_return_header() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE line record; used numeric;
BEGIN
 IF (NEW.id,NEW.request_id,NEW.payload_hash,NEW.number,NEW.sale_id,NEW.kind,NEW.reason,NEW.requested_at,NEW.platform_snapshot,NEW.platform_order_reference,NEW.platform_case_reference,NEW.return_policy_snapshot,NEW.actor_id,NEW.actor_name) IS DISTINCT FROM (OLD.id,OLD.request_id,OLD.payload_hash,OLD.number,OLD.sale_id,OLD.kind,OLD.reason,OLD.requested_at,OLD.platform_snapshot,OLD.platform_order_reference,OLD.platform_case_reference,OLD.return_policy_snapshot,OLD.actor_id,OLD.actor_name) THEN RAISE EXCEPTION 'Return origin is immutable'; END IF;
 IF NEW.status='Received' AND OLD.status<>'Received' THEN
  PERFORM 1 FROM sales WHERE id=NEW.sale_id FOR UPDATE;
  FOR line IN SELECT r.sale_line_id,r.quantity,l.quantity AS sold FROM sale_return_lines r JOIN sale_lines l ON l.id=r.sale_line_id WHERE r.return_id=NEW.id LOOP
   SELECT COALESCE(sum(r.quantity),0) INTO used FROM sale_return_lines r JOIN sale_returns h ON h.id=r.return_id WHERE r.sale_line_id=line.sale_line_id AND r.return_id<>NEW.id AND (r.accepted OR h.status IN ('Received','Inspected','Restocked'));
   IF used+line.quantity>line.sold THEN RAISE EXCEPTION 'Return quantity exceeds remaining quantity sold'; END IF;
  END LOOP;
 END IF;
 IF OLD.status IN ('Completed','Rejected','Cancelled') THEN RAISE EXCEPTION 'Closed Returns are immutable'; END IF;
 IF NEW.status IN ('Rejected','Cancelled') AND EXISTS(SELECT 1 FROM sale_return_lines WHERE return_id=OLD.id AND accepted) THEN RAISE EXCEPTION 'Received Returns require a controlled correction'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER return_lines_protection BEFORE INSERT OR UPDATE ON sale_return_lines FOR EACH ROW EXECUTE FUNCTION protect_return_lines();
CREATE TRIGGER return_header_protection BEFORE UPDATE ON sale_returns FOR EACH ROW EXECUTE FUNCTION protect_return_header();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sale_returns','sale_return_lines','sale_return_events','sale_return_refund_links','platform_return_policies'] LOOP
  EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t);
  EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_no_delete',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['sale_return_events','sale_return_refund_links','platform_return_policies'] LOOP
  EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_immutable',t);
 END LOOP;
END $$;
REVOKE ALL ON sale_returns,sale_return_lines,sale_return_events,sale_return_refund_links,platform_return_policies FROM PUBLIC;
REVOKE ALL ON SEQUENCE return_number_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_return_lines(),protect_return_header() FROM PUBLIC;

CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value)<>'object' THEN false ELSE NOT EXISTS (SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN ('customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit','returns.read','returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete','returns.financial') OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
