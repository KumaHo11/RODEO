/**
 * run-v5-tables.js — Crea tablas de climate_adjustment_snapshots y weather_cache.
 * USO: DATABASE_URL=... DATABASE_URL_PROD=... node run-v5-tables.js
 */
require('dotenv').config({ path: '.env.prod.local' });
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const stagingUrl = process.env.DATABASE_URL;
const prodUrl = process.env.DATABASE_URL_PROD;

const sql = `
CREATE TABLE IF NOT EXISTS climate_adjustment_snapshots (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL,
  paddock_id              UUID        NOT NULL,
  ndvi                    NUMERIC(5,3),
  rainfall_7d_mm          NUMERIC(8,2),
  humidity_pct            NUMERIC(5,1),
  drought_index           VARCHAR(10)  CHECK (drought_index IN ('NONE','MILD','MODERATE','SEVERE')),
  forage_ms_ha            NUMERIC(10,2),
  total_ev                NUMERIC(10,2),
  grass_growth_rate       NUMERIC(8,2),
  climate_multiplier      NUMERIC(6,3),
  base_remaining_days     INTEGER,
  adjusted_remaining_days INTEGER,
  alert_level             VARCHAR(10)  CHECK (alert_level IN ('ok','warning','critical')),
  alert_message           TEXT,
  delta_from_plan         INTEGER,
  multiplier_breakdown    JSONB,
  calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cas_org_paddock     ON climate_adjustment_snapshots (org_id, paddock_id);
CREATE INDEX IF NOT EXISTS idx_cas_calculated_at   ON climate_adjustment_snapshots (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cas_alert_level     ON climate_adjustment_snapshots (alert_level) WHERE alert_level != 'ok';

CREATE TABLE IF NOT EXISTS weather_cache (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL,
  latitude            NUMERIC(9,6),
  longitude           NUMERIC(9,6),
  temperature_c       NUMERIC(5,1),
  humidity            NUMERIC(5,1),
  wind_speed          NUMERIC(6,1),
  precipitation_sum   NUMERIC(8,2),
  forecast_mm_14d     NUMERIC(8,2),
  drought_index       VARCHAR(10)     DEFAULT 'NONE',
  condition_code      INTEGER,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_cache_org ON weather_cache (org_id, fetched_at DESC);
`;

async function runMigration(url, envName) {
  if (!url) {
    console.warn(`⚠️  ${envName}: URL no configurada, saltando.`);
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    console.log(`\n▶ Running tables on ${envName}...`);
    await pool.query(sql);
    console.log(`✔ Successfully ran on ${envName}`);
  } catch (error) {
    console.error(`✖ Failed on ${envName}:`, error.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await runMigration(stagingUrl, 'STAGING');
  await runMigration(prodUrl, 'PRODUCTION');
}

main();
