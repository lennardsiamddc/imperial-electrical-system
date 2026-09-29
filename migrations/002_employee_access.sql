SET search_path TO imperial, public;
-- Additive: existing accounts, password hashes, roles, sessions and audit IDs remain intact.
ALTER TABLE users ADD COLUMN permission_overrides jsonb NOT NULL DEFAULT '{}';
CREATE FUNCTION valid_permission_overrides(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_typeof(value) <> 'object' THEN false ELSE NOT EXISTS (
 SELECT 1 FROM jsonb_each_text(value) AS entry WHERE entry.key NOT IN
 ('customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write')
 OR entry.value NOT IN ('allow','deny')) END
$$;
ALTER TABLE users ADD CONSTRAINT users_valid_permissions CHECK(valid_permission_overrides(permission_overrides));
-- Save the actor's display identity at the time of each new event. Historical rows are untouched.
ALTER TABLE audit_log ADD COLUMN actor_name text;
CREATE FUNCTION stamp_audit_actor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT name INTO NEW.actor_name FROM users WHERE id=NEW.actor_id;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_actor_snapshot BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION stamp_audit_actor();
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX audit_actor_time_idx ON audit_log(actor_id,created_at DESC);
REVOKE ALL ON FUNCTION valid_permission_overrides(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION stamp_audit_actor() FROM PUBLIC;
