CREATE SCHEMA IF NOT EXISTS imperial;
SET search_path TO imperial, public;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL,
 name text NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 roles text[] NOT NULL CHECK (cardinality(roles)>0 AND roles <@ ARRAY['PRESIDENT_ADMIN','SALES','WAREHOUSE','ACCOUNTING','PURCHASING']::text[]),
 created_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX users_email_unique ON users(lower(email));
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL);
CREATE TABLE login_attempts (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 1, window_start timestamptz NOT NULL DEFAULT now());
CREATE TABLE suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL, name text NOT NULL,
 contact_person text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 tin text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', payment_terms text NOT NULL DEFAULT 'COD',
 notes text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX suppliers_code_unique ON suppliers(lower(code));
CREATE TABLE customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL, name text NOT NULL,
 customer_type text NOT NULL DEFAULT 'Retail', contact_person text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 tin text NOT NULL DEFAULT '', billing_address text NOT NULL DEFAULT '', delivery_addresses jsonb NOT NULL DEFAULT '[]',
 salesperson_id uuid REFERENCES users(id), payment_terms text NOT NULL DEFAULT 'COD', credit_limit numeric(18,2) NOT NULL DEFAULT 0 CHECK(credit_limit>=0),
 credit_notes text NOT NULL DEFAULT '', account_status text NOT NULL DEFAULT 'Active' CHECK(account_status IN ('Active','On hold','Closed')),
 notes text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_code_unique ON customers(lower(code));
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL, name text NOT NULL, brand text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
 primary_uom text NOT NULL CHECK(primary_uom IN ('PCS','ROLL','BOX','METER')),
 secondary_uom text CHECK(secondary_uom IN ('PCS','ROLL','BOX','METER')),
 conversion numeric(18,6),
 base_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(base_price>=0), supplier_adjustment numeric(9,6) NOT NULL DEFAULT 0 CHECK(supplier_adjustment>=-1),
 standard_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK(standard_cost>=0), vat_status text NOT NULL DEFAULT 'VAT' CHECK(vat_status IN ('VAT','Exempt','Zero rated')),
 vat_rate numeric(9,6) NOT NULL DEFAULT 0.12 CHECK(vat_rate BETWEEN 0 AND 1),
 retail_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(retail_price>=0), contractor_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(contractor_price>=0), wholesale_price numeric(18,2) NOT NULL DEFAULT 0 CHECK(wholesale_price>=0),
 meter_price numeric(18,2) CHECK(meter_price>=0), reorder_level numeric(18,6) NOT NULL DEFAULT 0 CHECK(reorder_level>=0),
 supplier_id uuid REFERENCES suppliers(id), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((secondary_uom IS NULL AND conversion IS NULL) OR (secondary_uom IS NOT NULL AND conversion>0 AND secondary_uom<>primary_uom))
);
CREATE UNIQUE INDEX products_sku_unique ON products(lower(sku));
CREATE TABLE audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id), entity text NOT NULL,
 record_id uuid NOT NULL, action text NOT NULL, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_record_idx ON audit_log(entity,record_id,created_at DESC);
CREATE FUNCTION audit_master() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor := nullif(current_setting('imperial.actor_id',true),'')::uuid;
 IF actor IS NULL THEN RAISE EXCEPTION 'Audited writes require an actor'; END IF;
 INSERT INTO audit_log(actor_id,entity,record_id,action,before_data,after_data)
 VALUES(actor,TG_TABLE_NAME,NEW.id,CASE WHEN TG_OP='INSERT' THEN 'CREATE' WHEN OLD.active AND NOT NEW.active THEN 'DEACTIVATE' ELSE 'UPDATE' END,
 CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)-'password_hash' END,to_jsonb(NEW)-'password_hash');
 RETURN NEW;
END $$;
CREATE FUNCTION reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Hard deletion is disabled; deactivate the record'; END $$;
CREATE TRIGGER customers_audit AFTER INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION audit_master();
CREATE TRIGGER products_audit AFTER INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION audit_master();
CREATE TRIGGER suppliers_audit AFTER INSERT OR UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION audit_master();
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION audit_master();
CREATE TRIGGER customers_no_delete BEFORE DELETE ON customers FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER products_no_delete BEFORE DELETE ON products FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER suppliers_no_delete BEFORE DELETE ON suppliers FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER users_no_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_delete();
-- Private schema: browsers/Supabase Data API receive no table access.
REVOKE ALL ON SCHEMA imperial FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA imperial FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA imperial FROM PUBLIC;
