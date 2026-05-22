-- ============================================================
-- RODEO — Migración mínima para corregir el error 500
-- Agrega la columna trial_days a la tabla existente.
-- Ejecutar ANTES de pricing_strategy_migration.sql si aún
-- no se corrió esa migración completa.
-- ============================================================

-- Agregar columna trial_days (no destructivo, no hace nada si ya existe)
ALTER TABLE subscriptions_plans
  ADD COLUMN IF NOT EXISTS trial_days INT DEFAULT 0;

-- Verificación
SELECT name, slug, trial_days
FROM subscriptions_plans
ORDER BY sort_order, created_at;
