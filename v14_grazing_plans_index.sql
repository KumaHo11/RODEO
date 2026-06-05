-- ══════════════════════════════════════════════════════════════════
-- RODEO — Script de Migración v14
-- Agrega índice para acelerar el Planificador Holístico
-- ══════════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grazing_plans_org_id
  ON grazing_plans(org_id);
