-- Migración: Soporte offline idempotency_key
-- Agregar columna idempotency_key a farm_events para deduplicación de registros offline
-- Ejecutar una sola vez en producción

ALTER TABLE farm_events 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Índice para búsqueda rápida de claves duplicadas
CREATE INDEX IF NOT EXISTS idx_farm_events_idempotency_key 
  ON farm_events (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Verificar
SELECT 
  column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'farm_events' 
  AND column_name = 'idempotency_key';
