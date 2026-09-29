SET search_path TO imperial, public;
CREATE TABLE tax_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton),
 standard_rate numeric(7,6) NOT NULL CHECK(standard_rate BETWEEN 0 AND 1),
 version integer NOT NULL DEFAULT 1, effective_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id),
 reason text NOT NULL
);
-- Initial configuration only: no existing business rows are updated or reinterpreted.
INSERT INTO tax_settings(standard_rate,reason) VALUES(0.12,'Initial Philippine standard VAT configuration');
CREATE FUNCTION audit_tax_settings() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor := nullif(current_setting('imperial.actor_id',true),'')::uuid;
 IF actor IS NULL THEN RAISE EXCEPTION 'Tax settings changes require an actor'; END IF;
 INSERT INTO audit_log(actor_id,entity,record_id,action,before_data,after_data)
 VALUES(actor,'tax_settings',NEW.id,'UPDATE',to_jsonb(OLD),to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER tax_settings_audit AFTER UPDATE ON tax_settings FOR EACH ROW EXECUTE FUNCTION audit_tax_settings();
CREATE TRIGGER tax_settings_no_delete BEFORE DELETE ON tax_settings FOR EACH ROW EXECUTE FUNCTION reject_delete();
ALTER TABLE products
 ADD COLUMN selling_tax_treatment text CHECK(selling_tax_treatment IN ('VATable','Zero-Rated','VAT-Exempt')),
 ADD COLUMN selling_entry_mode text CHECK(selling_entry_mode IN ('VAT Inclusive','VAT Exclusive')),
 ADD COLUMN cost_tax_treatment text CHECK(cost_tax_treatment IN ('VATable','Zero-Rated','VAT-Exempt')),
 ADD COLUMN cost_entry_mode text CHECK(cost_entry_mode IN ('VAT Inclusive','VAT Exclusive')),
 ADD COLUMN cost_input_vat_recoverable boolean,
 ADD COLUMN selling_vat jsonb CHECK(selling_vat IS NULL OR jsonb_typeof(selling_vat)='object'),
 ADD COLUMN cost_vat jsonb CHECK(cost_vat IS NULL OR jsonb_typeof(cost_vat)='object');
ALTER TABLE inventory_movements ADD COLUMN cost_vat jsonb CHECK(cost_vat IS NULL OR jsonb_typeof(cost_vat)='object');
REVOKE ALL ON tax_settings FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_tax_settings() FROM PUBLIC;
