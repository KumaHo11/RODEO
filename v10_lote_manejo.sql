-- ─────────────────────────────────────────────────────────────────────────────
-- v10_lote_manejo.sql
-- Migración: Agregar soporte de Lotes de Manejo a la tabla herds.
--
-- Contexto:
--   Permite agrupar sub-rodeos (estados fisiológicos) bajo un "Lote de Manejo"
--   padre. El grupo_manejo_id se asigna automáticamente cuando un evento
--   fisiológico (Parición, Destete) divide un rodeo en sub-rodeos.
--
-- Estrategia: ADD COLUMN IF NOT EXISTS — idempotente, seguro de re-ejecutar.
-- Compatible con PostgreSQL 9.6+.
--
-- Campos nuevos:
--   grupo_manejo_id      UUID        — identificador único del lote de manejo
--   grupo_manejo_nombre  VARCHAR(100) — nombre legible del lote (ej: "Vacas Jero")
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. ID del grupo de manejo (UUID compartido entre sub-rodeos del mismo lote)
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS grupo_manejo_id UUID DEFAULT NULL;

-- 2. Nombre del lote de manejo (se propaga a todos los sub-rodeos del grupo)
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS grupo_manejo_nombre VARCHAR(100) DEFAULT NULL;

-- 3. Índice para consultas agrupadas eficientes (tablero + planificador)
CREATE INDEX IF NOT EXISTS idx_herds_grupo_manejo_id
  ON herds (grupo_manejo_id)
  WHERE grupo_manejo_id IS NOT NULL;

-- 4. Índice compuesto para el tablero (filtra por org + agrupa por lote)
CREATE INDEX IF NOT EXISTS idx_herds_org_grupo
  ON herds (org_id, grupo_manejo_id)
  WHERE grupo_manejo_id IS NOT NULL;

-- 5. Comentarios de columna
COMMENT ON COLUMN herds.grupo_manejo_id IS
  'UUID compartido entre todos los sub-rodeos del mismo Lote de Manejo. '
  'Se genera automáticamente cuando un evento fisiológico (Parición, Destete) '
  'divide un rodeo. NULL = rodeo sin grupo (se muestra como tarjeta individual).';

COMMENT ON COLUMN herds.grupo_manejo_nombre IS
  'Nombre legible del Lote de Manejo (ej: "Vacas Jero"). '
  'Se propaga a todos los sub-rodeos con el mismo grupo_manejo_id.';

COMMIT;
