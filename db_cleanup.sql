-- ══════════════════════════════════════════════════════════════
-- RODEO — Limpieza de base de datos (sin borrar usuarios)
-- Ejecutar con: psql $DATABASE_URL -f db_cleanup.sql
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Grazing plans: eliminar planes con paddock o herd no existente (orphans)
DELETE FROM grazing_plans
WHERE paddock_id NOT IN (SELECT id FROM paddocks)
   OR herd_id    NOT IN (SELECT id FROM herds);

-- ── 2. Grazing plans: limpiar entry_date o exit_date inválidos (null entry_date)
DELETE FROM grazing_plans
WHERE entry_date IS NULL;

-- ── 3. Farm Events: eliminar eventos con event_date nulo
DELETE FROM farm_events
WHERE event_date IS NULL;

-- ── 4. Tasks: eliminar tareas con org_id no existente (orphans)
DELETE FROM tasks
WHERE org_id NOT IN (SELECT id FROM organizations);

-- ── 5. Grazing plans: normalizar status a mayúsculas (sanity fix)
UPDATE grazing_plans
SET status = UPPER(status)
WHERE status != UPPER(status);

-- ── 6. Tasks: normalizar status
UPDATE tasks
SET status = UPPER(status)
WHERE status IS NOT NULL AND status != UPPER(status);

-- ── 7. Limpiar notificaciones viejas (> 90 días)
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days';

-- ── 8. Reporte de lo que quedó
SELECT 'grazing_plans' AS tabla, COUNT(*) AS registros FROM grazing_plans
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'farm_events', COUNT(*) FROM farm_events
UNION ALL SELECT 'paddocks', COUNT(*) FROM paddocks
UNION ALL SELECT 'herds', COUNT(*) FROM herds
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations;

COMMIT;
