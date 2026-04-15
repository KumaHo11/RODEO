-- ============================================================
-- RODEO — Migración: columnas is_active y active_from en paddocks
-- Safe to re-run (usa ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE paddocks
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS active_from DATE;

-- Todos los potreros existentes quedan activos por defecto
UPDATE paddocks SET is_active = true WHERE is_active IS NULL;

SELECT 'Paddocks is_active migration complete' AS status;
