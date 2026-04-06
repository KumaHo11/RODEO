-- ============================================================
-- RODEO — LIMPIEZA COMPLETA PARA TESTING v3
-- ⚠️  SOLO USAR EN ENTORNO DE DESARROLLO
-- Usa IF EXISTS para no fallar si alguna tabla no existe aún.
-- ============================================================

-- ── DIAGNÓSTICO: correlo primero para ver qué hay ───────────────────────────
--
-- SELECT email, firebase_uid, role, team_role, created_at
-- FROM profiles
-- ORDER BY created_at DESC;
--
-- ── Si solo querés borrar un email puntual: ─────────────────────────────────
--
-- DELETE FROM profiles WHERE email = 'josorio@rodeoagtech.com';
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── LIMPIEZA TOTAL (el orden importa por las FK) ────────────────────────────

DO $$
BEGIN
  -- Dependientes de paddocks / orgs / profiles
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

  -- Raíce
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
-- ✅  DESPUÉS DE CORRER ESTE SCRIPT:
--
--   1. Firebase Console → Authentication → borrar usuarios
--      https://console.firebase.google.com → Authentication → Users
--
--   2. Registrate en /register → Owner → Onboarding (4 pasos)
--
--   3. Para probar invitación: Dashboard → Equipo → Invitar
--      Usar otro email y abrir el link en incógnito
-- ============================================================
