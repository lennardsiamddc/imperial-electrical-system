SET search_path TO imperial, public;
CREATE TABLE quotation_families (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL,
 brand text NOT NULL, product_type text NOT NULL, specification text NOT NULL, color text NOT NULL,
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE quotation_family_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL REFERENCES quotation_families(id),
 product_id uuid NOT NULL UNIQUE REFERENCES products(id), reason text NOT NULL,
 approved_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(family_id,product_id)
);
CREATE TABLE quotation_family_routes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL,
 uom text NOT NULL CHECK(uom IN ('PCS','BOX','ROLL','METER')), product_id uuid NOT NULL,
 FOREIGN KEY(family_id,product_id) REFERENCES quotation_family_variants(family_id,product_id),
 UNIQUE(family_id,uom), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION check_quotation_family_route() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM products WHERE id=NEW.product_id AND primary_uom=NEW.uom) THEN
 RAISE EXCEPTION 'Family route must match the inventory SKU primary UOM; no conversion is inferred'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER family_route_unit BEFORE INSERT OR UPDATE ON quotation_family_routes FOR EACH ROW EXECUTE FUNCTION check_quotation_family_route();
CREATE TRIGGER family_audit AFTER INSERT OR UPDATE ON quotation_families FOR EACH ROW EXECUTE FUNCTION audit_sales();
CREATE TRIGGER family_variant_audit AFTER INSERT OR UPDATE ON quotation_family_variants FOR EACH ROW EXECUTE FUNCTION audit_sales();
CREATE TRIGGER family_route_audit AFTER INSERT OR UPDATE ON quotation_family_routes FOR EACH ROW EXECUTE FUNCTION audit_sales();
CREATE TRIGGER family_no_delete BEFORE DELETE ON quotation_families FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER family_variant_no_delete BEFORE DELETE ON quotation_family_variants FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER family_route_no_delete BEFORE DELETE ON quotation_family_routes FOR EACH ROW EXECUTE FUNCTION reject_delete();
REVOKE ALL ON quotation_families,quotation_family_variants,quotation_family_routes FROM PUBLIC;
