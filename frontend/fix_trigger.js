const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const query = `
CREATE OR REPLACE FUNCTION public.process_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_firebase_uid VARCHAR;
    v_actor_id UUID;
    v_actor_email VARCHAR;
BEGIN
    -- Read the user context we injected in Next.js via SET LOCAL
    v_firebase_uid := current_setting('request.jwt.claim.sub', true);
    
    -- Attempt to read email if available, otherwise fallback to unknown
    BEGIN
        v_actor_email := current_setting('request.jwt.claim.email', true);
    EXCEPTION WHEN OTHERS THEN
        v_actor_email := 'unknown@example.com';
    END;
    
    IF v_actor_email IS NULL THEN
        v_actor_email := 'unknown@example.com';
    END IF;

    IF v_firebase_uid IS NOT NULL THEN
        SELECT id INTO v_actor_id FROM profiles WHERE firebase_uid = v_firebase_uid LIMIT 1;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (entity_type, entity_id, action, old_value, new_value, actor_id, actor_email)
        VALUES (TG_TABLE_NAME::TEXT, OLD.id::UUID, TG_OP, v_old_data, v_new_data, v_actor_id, v_actor_email);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        INSERT INTO audit_logs (entity_type, entity_id, action, old_value, actor_id, actor_email)
        VALUES (TG_TABLE_NAME::TEXT, OLD.id::UUID, TG_OP, v_old_data, v_actor_id, v_actor_email);
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (entity_type, entity_id, action, new_value, actor_id, actor_email)
        VALUES (TG_TABLE_NAME::TEXT, NEW.id::UUID, TG_OP, v_new_data, v_actor_id, v_actor_email);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$function$
  `;
  await pool.query(query);
  console.log("Trigger function fixed with actor_email.");
  process.exit(0);
}
main();
