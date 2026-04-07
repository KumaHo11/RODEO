-- ============================================================
-- RODEO — LIMPIEZA COMPLETA PARA TESTING v4
-- ⚠️  SOLO USAR EN ENTORNO DE DESARROLLO / STAGING
-- ============================================================
-- INSTRUCCIONES:
--   1. Correlo en el SQL Editor de Cloud SQL (o via psql)
--   2. Después ir a Firebase Console → Authentication → borrar usuarios
--
-- ── LIMPIEZA TOTAL ────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'notifications')        THEN TRUNCATE notifications        CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'field_notes')           THEN TRUNCATE field_notes           CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tasks')                 THEN TRUNCATE tasks                 CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'grazing_plans')         THEN TRUNCATE grazing_plans         CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'biological_monitoring')  THEN TRUNCATE biological_monitoring  CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'rainfall_logs')          THEN TRUNCATE rainfall_logs          CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'farm_events')            THEN TRUNCATE farm_events            CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'custom_roles')           THEN TRUNCATE custom_roles           CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'team_invitations')       THEN TRUNCATE team_invitations       CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'herds')                  THEN TRUNCATE herds                  CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'paddocks')               THEN TRUNCATE paddocks               CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'profiles')               THEN TRUNCATE profiles               CASCADE; END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'organizations')          THEN TRUNCATE organizations          CASCADE; END IF;
END $$;

-- ── VERIFICACIÓN ─────────────────────────────────────────────────────────────
SELECT 'organizations'    AS tabla, COUNT(*) AS filas FROM organizations
UNION ALL SELECT 'profiles',         COUNT(*) FROM profiles
UNION ALL SELECT 'paddocks',         COUNT(*) FROM paddocks
UNION ALL SELECT 'herds',            COUNT(*) FROM herds
UNION ALL SELECT 'tasks',            COUNT(*) FROM tasks
UNION ALL SELECT 'team_invitations', COUNT(*) FROM team_invitations
UNION ALL SELECT 'notifications',    COUNT(*) FROM notifications;

-- ============================================================
-- ✅  DESPUÉS DE ESTE SCRIPT:
--   → Firebase Console: https://console.firebase.google.com
--   → Authentication → Users → Seleccionar todos → Eliminar
-- ============================================================
