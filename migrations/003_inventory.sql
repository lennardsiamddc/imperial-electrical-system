SET search_path TO imperial, public;
ALTER TABLE products ADD COLUMN notes text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value) <> 'object' THEN false ELSE NOT EXISTS (
 SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN
 ('customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value')
 OR entry.value IS NULL OR entry.value NOT IN ('allow','deny')) END
$$;
CREATE TABLE inventory_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 product_id uuid NOT NULL REFERENCES products(id),
 kind text NOT NULL CHECK(kind IN ('IN','OUT')),
 occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 quantity numeric(24,6) NOT NULL CHECK(quantity>0),
 uom text NOT NULL CHECK(uom IN ('PCS','BOX','ROLL','METER')),
 stock_quantity numeric(30,6) NOT NULL CHECK(stock_quantity>0),
 stock_uom text NOT NULL CHECK(stock_uom IN ('PCS','BOX','ROLL','METER')),
 conversion numeric(18,6) NOT NULL CHECK(conversion>0),
 unit_cost numeric(24,6) NOT NULL CHECK(unit_cost>=0),
 total_cost numeric(36,6) NOT NULL CHECK(total_cost>=0),
 supplier_id uuid REFERENCES suppliers(id), supplier_name text,
 reference text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
 product_name text NOT NULL, sku text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id), actor_name text NOT NULL
);
CREATE INDEX inventory_product_time ON inventory_movements(product_id,created_at DESC,id);
CREATE INDEX inventory_time ON inventory_movements(created_at DESC,id);
CREATE FUNCTION protect_inventory_units() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.primary_uom,NEW.secondary_uom,NEW.conversion) IS DISTINCT FROM (OLD.primary_uom,OLD.secondary_uom,OLD.conversion)
 AND EXISTS(SELECT 1 FROM inventory_movements WHERE product_id=OLD.id) THEN
 RAISE EXCEPTION 'Units and conversion are locked after inventory history exists';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER products_inventory_units BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION protect_inventory_units();
CREATE FUNCTION audit_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.actor_id IS DISTINCT FROM nullif(current_setting('imperial.actor_id',true),'')::uuid THEN
 RAISE EXCEPTION 'Inventory writes require the current actor'; END IF;
 INSERT INTO audit_log(actor_id,entity,record_id,action,after_data)
 VALUES(NEW.actor_id,'inventory_movements',NEW.id,NEW.kind,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_audit AFTER INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION audit_inventory();
CREATE TRIGGER inventory_immutable BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION reject_delete();
REVOKE ALL ON inventory_movements FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_inventory_units() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_inventory() FROM PUBLIC;
