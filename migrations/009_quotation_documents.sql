SET search_path TO imperial, public;
-- Defaults add no new business events and leave all pre-existing columns untouched.
ALTER TABLE commercial_documents ADD COLUMN fees jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(fees)='array');
ALTER TABLE commercial_documents ADD COLUMN quotation_snapshot jsonb;
ALTER TABLE commercial_documents ADD COLUMN copied_from_id uuid REFERENCES commercial_documents(id);
CREATE TABLE quotation_defaults (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), singleton boolean NOT NULL UNIQUE DEFAULT true CHECK(singleton), version integer NOT NULL DEFAULT 1,
 notes text NOT NULL, disclaimer text NOT NULL, updated_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER quotation_defaults_audit AFTER INSERT OR UPDATE ON quotation_defaults FOR EACH ROW EXECUTE FUNCTION audit_sales();
CREATE TRIGGER quotation_defaults_no_delete BEFORE DELETE ON quotation_defaults FOR EACH ROW EXECUTE FUNCTION reject_delete();
REVOKE ALL ON quotation_defaults FROM PUBLIC;
