SET search_path TO imperial,public;
CREATE TABLE commercial_preparation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL UNIQUE REFERENCES commercial_documents(id),
 mode text NOT NULL CHECK(mode IN ('Computer','Handwritten')),
 recorded_by uuid NOT NULL REFERENCES users(id), recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE document_print_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('SI','DR')),
 name text NOT NULL, version integer NOT NULL DEFAULT 1, width_mm numeric NOT NULL CHECK(width_mm>0),height_mm numeric NOT NULL CHECK(height_mm>0),
 layout jsonb NOT NULL, approved boolean NOT NULL DEFAULT false,
 actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE commercial_print_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES commercial_documents(id),
 profile_id uuid NOT NULL REFERENCES document_print_profiles(id),profile_version integer NOT NULL,profile_snapshot jsonb NOT NULL,
 request_id uuid NOT NULL UNIQUE, reason text NOT NULL, actor_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commercial_preparation','document_print_profiles','commercial_print_events'] LOOP
 EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION audit_sales()',t||'_audit',t);
 EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_delete()',t||'_immutable',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 END LOOP; END $$;
