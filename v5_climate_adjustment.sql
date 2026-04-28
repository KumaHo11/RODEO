-- ═══════════════════════════════════════════════════════════════════════════
-- RODEO — Migración: Ajuste Clima
-- Ejecutar en producción una sola vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Tabla de snapshots históricos de Ajuste Clima
-- Cada vez que se ejecuta el cálculo (API o cron), se guarda un snapshot.
-- Permite el historial tipo "bolsa de valores" y las consultas del chart.
CREATE TABLE IF NOT EXISTS climate_adjustment_snapshots (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL,
  paddock_id              UUID        NOT NULL,

  -- Inputs capturados
  ndvi                    NUMERIC(5,3),
  rainfall_7d_mm          NUMERIC(8,2),
  humidity_pct            NUMERIC(5,1),
  drought_index           VARCHAR(10)  CHECK (drought_index IN ('NONE','MILD','MODERATE','SEVERE')),
  forage_ms_ha            NUMERIC(10,2),
  total_ev                NUMERIC(10,2),

  -- Outputs del motor
  grass_growth_rate       NUMERIC(8,2),    -- kg MS/ha/día
  climate_multiplier      NUMERIC(6,3),
  base_remaining_days     INTEGER,
  adjusted_remaining_days INTEGER,
  alert_level             VARCHAR(10)  CHECK (alert_level IN ('ok','warning','critical')),
  alert_message           TEXT,
  delta_from_plan         INTEGER,         -- positivo = más días, negativo = menos
  multiplier_breakdown    JSONB,

  calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries rápidas del chart y el cron
CREATE INDEX IF NOT EXISTS idx_cas_org_paddock     ON climate_adjustment_snapshots (org_id, paddock_id);
CREATE INDEX IF NOT EXISTS idx_cas_calculated_at   ON climate_adjustment_snapshots (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cas_alert_level     ON climate_adjustment_snapshots (alert_level) WHERE alert_level != 'ok';

-- 2. Tabla de feature flags del sistema (Super Admin global)
-- Permite a los admins de RODEO prender/apagar funcionalidades sin deploy.
CREATE TABLE IF NOT EXISTS system_feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    VARCHAR(80) NOT NULL UNIQUE,
  flag_type   VARCHAR(20) NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean','number','string')),
  flag_value  JSONB       NOT NULL DEFAULT 'true',
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

-- Insertar flag inicial para climate_adjustment (habilitado por defecto)
INSERT INTO system_feature_flags (flag_key, flag_type, flag_value, description)
VALUES (
  'climate_adjustment',
  'boolean',
  'true',
  'Habilita el motor de Ajuste Clima para orgs con plan Planificador o superior. Desactivar apaga el cron y las APIs.'
) ON CONFLICT (flag_key) DO NOTHING;

-- 3. Cache de clima (Open-Meteo API — para evitar rate limits)
-- El worker de clima actualiza esta tabla; el motor de ajuste la consume.
CREATE TABLE IF NOT EXISTS weather_cache (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL,
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  temperature_c       NUMERIC(5,1),
  humidity            NUMERIC(5,1),
  wind_speed          NUMERIC(6,1),
  precipitation_sum   NUMERIC(8,2),   -- últimas 24h
  forecast_mm_14d     NUMERIC(8,2),   -- pronóstico 14 días
  drought_index       VARCHAR(10)     DEFAULT 'NONE',
  condition_code      INTEGER,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_org ON weather_cache (org_id, fetched_at DESC);

-- 4. FK opcional: vincular snapshots a orgs/paddocks (si tablas ya existen)
DO $$
BEGIN
  BEGIN
    ALTER TABLE climate_adjustment_snapshots
      ADD CONSTRAINT fk_cas_org     FOREIGN KEY (org_id)     REFERENCES organizations(id) ON DELETE CASCADE;
    ALTER TABLE climate_adjustment_snapshots
      ADD CONSTRAINT fk_cas_paddock FOREIGN KEY (paddock_id) REFERENCES paddocks(id)     ON DELETE CASCADE;
  EXCEPTION WHEN others THEN
    NULL; -- Ignorar si las constraints ya existen
  END;
END;
$$;

-- 5. Feature flag por plan en plan_feature_flags
-- Agrega el flag "climate_adjustment" a los planes elegibles
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, flag_type)
SELECT sp.id, 'climate_adjustment', true, 'boolean'
FROM subscriptions_plans sp
WHERE sp.slug IN ('planificador', 'pro_ganadero', 'pro_ganadero+', 'holistico', 'latifundio', 'enterprise')
ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- Vercel Cron: agregar en vercel.json
-- {
--   "crons": [
--     { "path": "/api/cron/climate-adjustment", "schedule": "0 9 * * *" }
--   ]
-- }
-- Cloud Scheduler (GCP): target POST https://app.../api/cron/climate-adjustment
--   Authorization: Bearer ${CRON_SECRET}
--   Schedule: "0 9 * * *" (09:00 UTC = 06:00 ART)
-- ═══════════════════════════════════════════════════════════════════════════
