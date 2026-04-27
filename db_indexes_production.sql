-- ══════════════════════════════════════════════════════════════════
-- RODEO — Script de Índices para Producción
-- Auditoría QA — 26 Abril 2026
--
-- INSTRUCCIONES:
--   Aplicar en Cloud SQL con CONCURRENTLY para no bloquear tablas.
--   Puede ejecutarse en producción sin downtime.
--   Tiempo estimado: 1-5 min según tamaño de datos.
-- ══════════════════════════════════════════════════════════════════

-- ── ÍNDICE 1 (CRÍTICO): firebase_uid
-- Usado en CADA request autenticado. Sin este índice = full table scan por request.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_firebase_uid
  ON profiles(firebase_uid);

-- ── ÍNDICE 2: paddocks por org_id
-- Dashboard + Mi Campo → query más frecuente del sistema.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paddocks_org_id
  ON paddocks(org_id);

-- ── ÍNDICE 3: herds por org_id
-- Dashboard + Rodeos → segunda query más frecuente.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_herds_org_id
  ON herds(org_id);

-- ── ÍNDICE 4: grazing_plans por paddock + status
-- Planificador → filtros frecuentes por estado del plan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grazing_plans_paddock_status
  ON grazing_plans(paddock_id, status);

-- ── ÍNDICE 5: grazing_plans por org_id + entry_date (parcial)
-- Dashboard → "Próximos movimientos" solo necesita PLANNED y ACTIVE.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grazing_plans_entry_date_active
  ON grazing_plans(org_id, entry_date ASC)
  WHERE status IN ('PLANNED', 'ACTIVE');

-- ── ÍNDICE 6: notifications por user + is_read + fecha
-- Layout del dashboard → se carga en cada render del sidebar.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read_date
  ON notifications(user_id, is_read, created_at DESC);

-- ── ÍNDICE 7: tasks por org + status + fecha
-- Panel de tareas → filtro por pendientes y fecha de vencimiento.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_org_status_date
  ON tasks(org_id, status, scheduled_date ASC);

-- ── ÍNDICE 8: biological_monitoring → last_monitoring_date por potrero
-- Usado en el SELECT de paddocks para calcular last_monitoring_date.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bio_monitoring_paddock_date
  ON biological_monitoring(paddock_id, recorded_at DESC);

-- ── ÍNDICE 9: farm_events pendientes por org + fecha
-- Dashboard agenda → solo muestra events con status = 'pendiente'.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_farm_events_org_pending_date
  ON farm_events(org_id, event_date ASC)
  WHERE status = 'pendiente';

-- ── ÍNDICE 10: grazing_plans por herd_id
-- Planificador → join con herds, acceso frecuente por herd_id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grazing_plans_herd_id
  ON grazing_plans(herd_id);

-- ══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-APLICACIÓN
-- Ejecutar para confirmar que los índices fueron creados:
-- ══════════════════════════════════════════════════════════════════
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
FROM pg_indexes
WHERE tablename IN (
  'profiles', 'paddocks', 'herds', 'grazing_plans',
  'notifications', 'tasks', 'biological_monitoring', 'farm_events'
)
  AND schemaname = 'public'
ORDER BY tablename, indexname;
