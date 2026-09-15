-- v13: Agregar photo_urls y analysis_result a farm_events
-- Permite guardar todas las fotos subidas en análisis de IA y
-- el objeto completo de resultado para mostrarlo en Registros/Historial.

ALTER TABLE farm_events
  ADD COLUMN IF NOT EXISTS photo_urls JSONB,
  ADD COLUMN IF NOT EXISTS analysis_result JSONB;

-- Comentarios descriptivos
COMMENT ON COLUMN farm_events.photo_urls IS 'Array JSON de URLs de todas las fotos subidas en el análisis IA';
COMMENT ON COLUMN farm_events.analysis_result IS 'Objeto JSON con el resultado completo del análisis IA (CC, peso, recomendación, etc.)';
