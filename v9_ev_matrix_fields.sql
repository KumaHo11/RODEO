-- ============================================================
-- Migración v9: Campos adicionales para EV V2 (Cocimano)
-- ============================================================
-- Agrega las columnas necesarias para el nuevo motor de cálculo
-- de Equivalente Vaca basado en las tablas Cocimano (1975):
--   · lactancia_range      → '1-2', '3-4', '5-6', '7-8'
--   · estadio_gestacion    → '6', '7', '8', '9' (mes de gestación)
--   · custom_racion_kg     → Ración diaria personalizada por el usuario (kg MS/día/cabeza)
--
-- La ración custom se guarda para ser usada en planificaciones
-- del Gantt y reportes forrajeros.
-- ============================================================

ALTER TABLE herds ADD COLUMN IF NOT EXISTS lactancia_range   VARCHAR(10) DEFAULT NULL;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS estadio_gestacion VARCHAR(10) DEFAULT NULL;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS custom_racion_kg  DECIMAL(8,2) DEFAULT NULL;

-- Índice para consultas de planificación por estado fisiológico
CREATE INDEX IF NOT EXISTS idx_herds_physio_full
  ON herds (physiological_category, lactancia_range, estadio_gestacion)
  WHERE physiological_category IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN herds.lactancia_range   IS 'Período de lactancia según tabla Cocimano: 1-2, 3-4, 5-6 o 7-8 (meses)';
COMMENT ON COLUMN herds.estadio_gestacion IS 'Mes de gestación según tabla Cocimano: 6, 7, 8 o 9';
COMMENT ON COLUMN herds.custom_racion_kg  IS 'Ración diaria personalizada en kg MS/día/cabeza. NULL = usar sugerida por categoría';
