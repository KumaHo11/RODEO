-- ============================================================
-- RODEO V2.0 — Reset COMPLETO de datos operativos para pruebas
-- ⚠️  Borra: planes, tareas, eventos, notas de campo, notificaciones.
-- ✅  Conserva: organizations, profiles, paddocks, herds, fields.
-- ============================================================

-- Notas de campo (Bitácora)
DELETE FROM field_notes;

-- Planes de pastoreo
DELETE FROM grazing_plans;

-- Tareas
DELETE FROM tasks;

-- Eventos de agenda
DELETE FROM farm_events;

-- Notificaciones (si existe la tabla)
DELETE FROM notifications WHERE TRUE;

-- Restaurar estado de todos los potreros a RESTING
UPDATE paddocks SET current_status = 'RESTING', dry_matter_kg_ha = NULL;

-- Reset de datos de biomasa en herds (ev acumulado)
UPDATE herds SET notes = NULL WHERE notes IS NOT NULL;

-- Confirmar conteos finales
SELECT 
  (SELECT COUNT(*) FROM grazing_plans)                       AS grazing_plans,
  (SELECT COUNT(*) FROM tasks)                               AS tasks,
  (SELECT COUNT(*) FROM farm_events)                         AS farm_events,
  (SELECT COUNT(*) FROM field_notes)                         AS field_notes,
  (SELECT COUNT(*) FROM paddocks WHERE current_status = 'RESTING') AS paddocks_resting;
