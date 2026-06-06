-- v17_audit_logs.sql
-- 1. Create the Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(255), -- Stores the Firebase UID from RLS context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protect audit_logs: Nobody should update or delete from this table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON audit_logs FOR SELECT USING (true); -- Usually restricted to admins

-- 2. Create the Generic Trigger Function
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_user_id VARCHAR;
BEGIN
    -- Read the user context we injected in Next.js via SET LOCAL
    v_user_id := current_setting('request.jwt.claim.sub', true);

    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME::TEXT, OLD.id, TG_OP, v_old_data, v_new_data, v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME::TEXT, OLD.id, TG_OP, v_old_data, v_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME::TEXT, NEW.id, TG_OP, v_new_data, v_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger to critical tables
DROP TRIGGER IF EXISTS audit_organizations ON organizations;
CREATE TRIGGER audit_organizations
AFTER INSERT OR UPDATE OR DELETE ON organizations
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_profiles ON profiles;
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_paddocks ON paddocks;
CREATE TRIGGER audit_paddocks
AFTER INSERT OR UPDATE OR DELETE ON paddocks
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_grazing_plans ON grazing_plans;
CREATE TRIGGER audit_grazing_plans
AFTER INSERT OR UPDATE OR DELETE ON grazing_plans
FOR EACH ROW EXECUTE FUNCTION process_audit_log();
