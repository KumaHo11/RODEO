-- ═══════════════════════════════════════════════════════════════════════════
-- RODEO — Migración: historial_potrero + radiación solar en weather_cache
-- Ejecutar en producción una sola vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Tabla historial_potrero
-- Fuente canónica de NDVI histórico y variables climáticas por potrero.
-- El cron diario escribe el snapshot de API; el productor puede sobreescribir
-- precipitacion_usuario_mm desde la UI.
-- Los campos calculados (et, bh, c_adj) se persisten para no recalcular en charts.
CREATE TABLE IF NOT EXISTS historial_potrero (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  paddock_id               UUID        NOT NULL REFERENCES paddocks(id)     ON DELETE CASCADE,
  fecha                    DATE        NOT NULL,

  -- Satelital (Sentinel-2, actualización cada ~5 días)
  ndvi                     NUMERIC(5,3),
  fuente_ndvi              VARCHAR(20)  DEFAULT 'satellite'
                             CHECK (fuente_ndvi IN ('satellite', 'manual', 'estimated')),

  -- Precipitación
  precipitacion_api_mm     NUMERIC(8,2),    -- Fuente: Open-Meteo (automático)
  precipitacion_usuario_mm NUMERIC(8,2),    -- Pluviómetro manual (prioridad sobre API)

  -- Clima diario
  humedad_pct              NUMERIC(5,1),
  velocidad_viento_kmh     NUMERIC(6,1),
  temperatura_c            NUMERIC(5,1),    -- Temperatura media diaria (°C)
  radiacion_solar          NUMERIC(8,2),    -- Radiación solar (MJ/m²/día)

  -- Balance hídrico calculado (persistido para gráficos)
  et_calculada_mm          NUMERIC(8,2),    -- Evapotranspiración del día (mm)
  balance_hidrico_mm       NUMERIC(8,2),    -- BH = P_efectiva − ET (mm)

  -- Coeficiente de ajuste resultante
  c_adj                    NUMERIC(6,4),    -- Coeficiente calculado para este día

  -- Flags de fuente de datos (para trazabilidad)
  lluvia_fuente            VARCHAR(20)  DEFAULT 'api'
                             CHECK (lluvia_fuente IN ('user', 'api', 'assumed_zero')),
  rs_fuente                VARCHAR(20)  DEFAULT 'api'
                             CHECK (rs_fuente IN ('api', 'estimated_latitude')),
  temp_fuente              VARCHAR(20)  DEFAULT 'api'
                             CHECK (temp_fuente IN ('api', 'seasonal_estimate')),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un registro por potrero por día (permite upsert del cron)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_paddock_fecha
  ON historial_potrero (paddock_id, fecha);

-- Índice para queries del gráfico (por org, potrero, fecha reciente)
CREATE INDEX IF NOT EXISTS idx_hp_org_paddock_fecha
  ON historial_potrero (org_id, paddock_id, fecha DESC);

-- Índice para detectar últimas mediciones de NDVI (cada ~5 días)
CREATE INDEX IF NOT EXISTS idx_hp_ndvi_notnull
  ON historial_potrero (paddock_id, fecha DESC)
  WHERE ndvi IS NOT NULL;

-- 2. Agregar radiación solar a weather_cache
-- Open-Meteo provee shortwave_radiation en su API daily/hourly.
ALTER TABLE weather_cache ADD COLUMN IF NOT EXISTS
  radiacion_solar NUMERIC(8,2);   -- MJ/m²/día

-- Índice de temperatura (si se agregan queries específicas)
ALTER TABLE weather_cache ADD COLUMN IF NOT EXISTS
  temperatura_c NUMERIC(5,1);    -- Temperatura media del día (°C)

-- 3. Trigger para updated_at automático en historial_potrero
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historial_potrero_updated_at ON historial_potrero;
CREATE TRIGGER trg_historial_potrero_updated_at
  BEFORE UPDATE ON historial_potrero
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación post-migración:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'historial_potrero' ORDER BY ordinal_position;
-- ═══════════════════════════════════════════════════════════════════════════
