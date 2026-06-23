-- ============================================================
-- v20_security_fixes.sql
-- Correcciones de seguridad críticas detectadas en auditoría QA
-- Fecha: 2026-06-20
-- Ejecutar en Cloud SQL como usuario con permisos de ALTER POLICY
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Función get_user_org_id() rota
-- Problema: usaba gen_random_uuid() → UUID aleatorio en cada
--           llamada, nunca coincide con un perfil real.
--           Todas las RLS policies basadas en esta función eran
--           inoperantes — cualquier query podía filtrar sin RLS.
-- Fix: usar current_setting('request.jwt.claim.sub') que contiene
--      el Firebase UID inyectado por db.ts vía SET LOCAL.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM profiles
    WHERE firebase_uid = current_setting('request.jwt.claim.sub', true)
    LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Verificación: confirmar que la función ahora referencia firebase_uid
-- SELECT get_user_org_id(); -- debe retornar el org_id del usuario autenticado

-- ─────────────────────────────────────────────────────────────
-- FIX 2: Audit Logs — Policy SELECT abierta para todos
-- Problema: USING (true) permitía que cualquier rol autenticado
--           leyera todos los registros de audit_logs, incluyendo
--           old_data/new_data con información sensible de usuarios.
-- Fix: restringir SELECT solo a OWNER de la org o SUPER_ADMIN.
-- ─────────────────────────────────────────────────────────────

-- Eliminar policy insegura existente
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

-- Crear policy segura: solo OWNER de su org o SUPER_ADMIN del sistema
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT
    USING (
        current_setting('request.jwt.claim.sub', true) IN (
            SELECT firebase_uid
            FROM profiles
            WHERE role = 'OWNER'
               OR system_role = 'SUPER_ADMIN'
        )
    );

-- Verificación de políticas activas en audit_logs:
-- SELECT policyname, permissive, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'audit_logs';

-- ─────────────────────────────────────────────────────────────
-- FIN DE MIGRACION v20_security_fixes.sql
-- ─────────────────────────────────────────────────────────────
