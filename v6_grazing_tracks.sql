-- =====================================================================
-- v6_grazing_tracks.sql
-- Migración: Verdad Única + Planificaciones Paralelas (Sugerida vs Manual)
-- Agrega plan_type, source_origin y cycle_id a grazing_plans
-- para soportar el doble Gantt (Motor Sugerido + Gestión Operativa)
-- y el benchmarking histórico.
-- =====================================================================

BEGIN;

-- 1. Columnas de clasificación del plan
ALTER TABLE grazing_plans
  ADD COLUMN IF NOT EXISTS plan_type     VARCHAR(20)  DEFAULT 'manual'
    CHECK (plan_type IN ('manual', 'suggested')),
  ADD COLUMN IF NOT EXISTS source_origin VARCHAR(50)  DEFAULT 'human'
    CHECK (source_origin IN ('human', 'algorithm')),
  ADD COLUMN IF NOT EXISTS cycle_id      UUID;

-- 2. Índices para filtrado eficiente por pestaña activa
CREATE INDEX IF NOT EXISTS idx_grazing_plans_plan_type    ON grazing_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_source_origin ON grazing_plans(source_origin);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_cycle_id     ON grazing_plans(cycle_id);

-- 3. Retrocompatibilidad: marcar planes existentes generados por algoritmo
--    (detectados por ai_analysis->>'plan_source' = 'season_plan')
UPDATE grazing_plans
SET
  plan_type     = 'suggested',
  source_origin = 'algorithm'
WHERE
  ai_analysis ->> 'plan_source' = 'season_plan'
  AND plan_type = 'manual'; -- solo si aún no fue clasificado

-- 4. Comentarios descriptivos
COMMENT ON COLUMN grazing_plans.plan_type IS
  'Clasifica el bloque: "suggested" = generado por el Motor de Optimización, "manual" = ingresado por el operador.';
COMMENT ON COLUMN grazing_plans.source_origin IS
  'Origen del dato: "algorithm" = calculado automáticamente (Savory-holístico), "human" = decisión operativa del usuario.';
COMMENT ON COLUMN grazing_plans.cycle_id IS
  'UUID compartido entre bloques de un ciclo de pastoreo cerrado. Permite comparar el track manual vs sugerido en el Benchmarking.';

COMMIT;
