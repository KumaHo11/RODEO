-- ─────────────────────────────────────────────────────────────────────────────
-- v8_physiological_herds.sql
-- Migración: Agregar campos de categoría fisiológica, fecha de pesaje y GDP
-- a la tabla herds.
--
-- Estrategia: ADD COLUMN IF NOT EXISTS — idempotente, seguro de re-ejecutar.
-- Compatible con PostgreSQL 9.6+.
--
-- Campos:
--   physiological_category  VARCHAR(50)   — Estado fisiológico/biológico
--   last_weigh_date         DATE          — Fecha del último pesaje real
--   daily_gain_kg           DECIMAL(8,3)  — Ganancia Diaria de Peso en kg/día
--
-- Categorías fisiológicas válidas:
--   VACA_CON_TERNERO | VACA_PRENADA | VACA_VACIA | TERNERO | RECRIA_NOVILLO
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Categoría fisiológica / biológica
--    Governa el cálculo dinámico de EV. Independiente de la categoría comercial.
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS physiological_category VARCHAR(50) DEFAULT NULL;

-- 2. Fecha del último pesaje real
--    Base de referencia para el cálculo de proyección GDP.
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS last_weigh_date DATE DEFAULT NULL;

-- 3. Ganancia Diaria de Peso (GDP) en kg/día
--    Obligatoria para TERNERO y RECRIA_NOVILLO.
--    Opcional para vacas (variación de peso corporal en gestación/post-parto).
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS daily_gain_kg DECIMAL(8, 3) DEFAULT NULL;

-- 4. Índice para filtrar por categoría fisiológica (optimiza el planificador)
CREATE INDEX IF NOT EXISTS idx_herds_physiological_category
  ON herds (physiological_category)
  WHERE physiological_category IS NOT NULL;

-- 5. Comentarios de columna para documentación en BD
COMMENT ON COLUMN herds.physiological_category IS
  'Estado fisiológico/biológico del rodeo. Valores: VACA_CON_TERNERO, VACA_PRENADA, VACA_VACIA, TERNERO, RECRIA_NOVILLO. Governa el cálculo dinámico de EV independientemente de la categoría comercial.';

COMMENT ON COLUMN herds.last_weigh_date IS
  'Fecha del último pesaje real registrado. Sirve como base (t=0) para la proyección de peso mediante GDP lineal.';

COMMENT ON COLUMN herds.daily_gain_kg IS
  'Ganancia Diaria de Peso en kg/día (GDP). Obligatorio para categorías de crecimiento (TERNERO, RECRIA_NOVILLO). Opcional para vacas para proyectar variación de peso corporal.';

COMMIT;
