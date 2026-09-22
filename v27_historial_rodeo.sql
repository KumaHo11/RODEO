-- v27_historial_rodeo.sql
-- Crea la tabla historial_rodeo para registros históricos de condición corporal (BCS)
-- simétrica a historial_potrero. Permite graficar la tendencia de CC de cada rodeo
-- con trazabilidad fotográfica a la bitácora.
--
-- Source values: 'BITACORA_AI' | 'WHATSAPP_AI' | 'MANUAL'

SET search_path TO public;

CREATE TABLE IF NOT EXISTS historial_rodeo (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rodeo_id              UUID        NOT NULL REFERENCES herds(id) ON DELETE CASCADE,
  bcs_score             NUMERIC(3,1),            -- escala 1.0–5.0
  bcs_label             TEXT,                    -- 'MUY FLACO' | 'FLACO' | 'MODERADO' | 'BUENO' | 'OBESO'
  estimated_weight_kg   NUMERIC(8,2),
  animal_count_visible  INT,
  alert_level           TEXT,                    -- 'NINGUNA' | 'ATENCION' | 'URGENTE'
  confidence            NUMERIC(4,3),            -- 0.000–1.000
  analysis_data         JSONB,                   -- snapshot completo del resultado IA
  source                TEXT        NOT NULL DEFAULT 'BITACORA_AI',
  entry_id              UUID        REFERENCES field_notes(id) ON DELETE SET NULL,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries de historial y gráficos
CREATE INDEX IF NOT EXISTS idx_historial_rodeo_rodeo_id
  ON historial_rodeo(rodeo_id);

CREATE INDEX IF NOT EXISTS idx_historial_rodeo_rodeo_recorded
  ON historial_rodeo(rodeo_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_historial_rodeo_org_id
  ON historial_rodeo(org_id);

CREATE INDEX IF NOT EXISTS idx_historial_rodeo_entry_id
  ON historial_rodeo(entry_id)
  WHERE entry_id IS NOT NULL;

-- RLS
ALTER TABLE historial_rodeo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view historial_rodeo in their org" ON historial_rodeo
  FOR SELECT USING (org_id = get_user_org_id());

CREATE POLICY "Users manage historial_rodeo in their org" ON historial_rodeo
  FOR ALL USING (org_id = get_user_org_id());

-- Comentarios descriptivos
COMMENT ON TABLE  historial_rodeo                    IS 'Registros históricos de condición corporal (BCS) por rodeo, con trazabilidad a bitácora.';
COMMENT ON COLUMN historial_rodeo.bcs_score          IS 'Condición corporal en escala 1.0–5.0';
COMMENT ON COLUMN historial_rodeo.source             IS 'BITACORA_AI | WHATSAPP_AI | MANUAL';
COMMENT ON COLUMN historial_rodeo.entry_id           IS 'FK a field_notes para trazabilidad fotográfica';
COMMENT ON COLUMN historial_rodeo.analysis_data      IS 'Snapshot completo del JSON devuelto por Gemini';
