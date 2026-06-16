/**
 * add_missing_columns.js
 * Agrega columnas faltantes a las tablas de producción y staging.
 * Las columnas en el código difieren de las que existen en la DB.
 * 
 * Uso: node add_missing_columns.js <DATABASE_URL>
 */
const { Client } = require('pg')

const DB_URL = process.argv[2] || process.env.DB_URL
if (!DB_URL) {
  console.error('Uso: node add_missing_columns.js <DATABASE_URL>')
  process.exit(1)
}

const MIGRATIONS = `
-- ──────────────────────────────────────────────────────────────────────────────
-- tasks: renombrar assignee_id → assigned_to + agregar columnas faltantes
-- El código usa: assigned_to, task_type, paddock_id, priority, created_by
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='tasks' AND column_name='assignee_id' AND table_schema='public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='tasks' AND column_name='assigned_to' AND table_schema='public'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN assignee_id TO assigned_to;
    RAISE NOTICE 'tasks.assignee_id → tasks.assigned_to renombrada';
  END IF;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_type    TEXT DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS paddock_id   UUID REFERENCES paddocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority     TEXT DEFAULT 'MEDIA';

-- Asegurar índice en assigned_to
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_org_id_idx ON tasks(org_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- herds: agregar columnas faltantes
-- El código usa: age_years, age_months, admission_date, bcs_score, bcs_label,
--   bcs_data, photo_url, parent_herd_id, herd_notes, exit_date,
--   lactancia_range, estadio_gestacion, custom_racion_kg,
--   grupo_manejo_id, grupo_manejo_nombre
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS age_years            INTEGER,
  ADD COLUMN IF NOT EXISTS age_months           INTEGER,
  ADD COLUMN IF NOT EXISTS admission_date       DATE,
  ADD COLUMN IF NOT EXISTS bcs_score            NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS bcs_label            TEXT,
  ADD COLUMN IF NOT EXISTS bcs_data             JSONB,
  ADD COLUMN IF NOT EXISTS photo_url            TEXT,
  ADD COLUMN IF NOT EXISTS parent_herd_id       UUID REFERENCES herds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS herd_notes           TEXT,
  ADD COLUMN IF NOT EXISTS exit_date            DATE,
  ADD COLUMN IF NOT EXISTS lactancia_range      TEXT,
  ADD COLUMN IF NOT EXISTS estadio_gestacion    TEXT,
  ADD COLUMN IF NOT EXISTS custom_racion_kg     NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS grupo_manejo_id      UUID,
  ADD COLUMN IF NOT EXISTS grupo_manejo_nombre  TEXT,
  ADD COLUMN IF NOT EXISTS categoria            TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- paddocks: agregar columnas faltantes
-- El código usa: is_active, dry_matter_kg_ha, current_ndvi,
--   previous_dry_matter_kg_ha, previous_ndvi_date, technical_data, geom
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE paddocks
  ADD COLUMN IF NOT EXISTS is_active                    BOOLEAN      DEFAULT true,
  ADD COLUMN IF NOT EXISTS dry_matter_kg_ha             NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS current_ndvi                 NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS previous_dry_matter_kg_ha   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS previous_ndvi_date           DATE,
  ADD COLUMN IF NOT EXISTS technical_data               JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS location                     GEOMETRY(Point, 4326),
  ADD COLUMN IF NOT EXISTS geom                         GEOMETRY(MultiPolygon, 4326);

CREATE INDEX IF NOT EXISTS paddocks_geom_idx     ON paddocks USING GIST(geom);
CREATE INDEX IF NOT EXISTS paddocks_location_idx ON paddocks USING GIST(location);

-- ──────────────────────────────────────────────────────────────────────────────
-- grazing_plans: agregar columnas faltantes
-- El código usa: org_id, is_locked, closing_stock, adjusted_entry_date,
--   adjusted_exit_date, plan_type, source_origin, cycle_id
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE grazing_plans
  ADD COLUMN IF NOT EXISTS org_id               UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_locked            BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS closing_stock        JSONB,
  ADD COLUMN IF NOT EXISTS adjusted_entry_date  DATE,
  ADD COLUMN IF NOT EXISTS adjusted_exit_date   DATE,
  ADD COLUMN IF NOT EXISTS plan_type            TEXT         DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_origin        TEXT         DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS cycle_id             UUID,
  ADD COLUMN IF NOT EXISTS season_plan_id       UUID;

-- Poblar org_id desde paddocks para registros existentes
UPDATE grazing_plans gp
SET org_id = p.org_id
FROM paddocks p
WHERE gp.paddock_id = p.id
AND gp.org_id IS NULL;

CREATE INDEX IF NOT EXISTS grazing_plans_org_id_idx ON grazing_plans(org_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- farm_events: agregar columnas faltantes
-- El código usa: category, all_day, recurrence, notes, metadata
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE farm_events
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS all_day        BOOLEAN   DEFAULT true,
  ADD COLUMN IF NOT EXISTS recurrence     TEXT,
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS metadata       JSONB,
  ADD COLUMN IF NOT EXISTS photo_url      TEXT,
  ADD COLUMN IF NOT EXISTS audio_url      TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to    UUID;

-- ──────────────────────────────────────────────────────────────────────────────
-- organizations: asegurar todas las columnas que usa el código
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS location      GEOMETRY(Point, 4326),
  ADD COLUMN IF NOT EXISTS boundaries    GEOMETRY(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS region_id     UUID;

CREATE INDEX IF NOT EXISTS organizations_location_idx  ON organizations USING GIST(location);
CREATE INDEX IF NOT EXISTS organizations_boundaries_idx ON organizations USING GIST(boundaries);

-- ──────────────────────────────────────────────────────────────────────────────
-- profiles: asegurar columnas de onboarding y preferencias
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name                  TEXT,
  ADD COLUMN IF NOT EXISTS last_name                   TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url                  TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_step             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS team_role                   TEXT,
  ADD COLUMN IF NOT EXISTS permissions                 JSONB,
  ADD COLUMN IF NOT EXISTS notification_preferences    JSONB,
  ADD COLUMN IF NOT EXISTS country_code                TEXT,
  ADD COLUMN IF NOT EXISTS role                        TEXT    DEFAULT 'OWNER',
  ADD COLUMN IF NOT EXISTS phone                       TEXT,
  ADD COLUMN IF NOT EXISTS is_first_login              BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active                   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS system_role                 TEXT,
  ADD COLUMN IF NOT EXISTS country                     TEXT;
`

async function run() {
  const client = new Client(DB_URL)
  await client.connect()
  const dbName = DB_URL.includes('34.95') ? 'PROD' : DB_URL.includes('35.247') ? 'STAGING' : 'DB'
  console.log(`✅ Conectado a ${dbName}: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`)

  try {
    await client.query('BEGIN')
    await client.query(MIGRATIONS)
    await client.query('COMMIT')
    console.log(`✅ ${dbName}: Todas las columnas agregadas correctamente`)
    
    // Verify key fixes
    const tasksCheck = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'tasks' AND column_name = 'assigned_to' AND table_schema = 'public'`)
    console.log(`   tasks.assigned_to: ${tasksCheck.rows.length > 0 ? '✅' : '❌'}`)
    
    const gpCheck = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'grazing_plans' AND column_name = 'org_id' AND table_schema = 'public'`)
    console.log(`   grazing_plans.org_id: ${gpCheck.rows.length > 0 ? '✅' : '❌'}`)
    
    const herdsCheck = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'herds' AND column_name = 'age_years' AND table_schema = 'public'`)
    console.log(`   herds.age_years: ${herdsCheck.rows.length > 0 ? '✅' : '❌'}`)
    
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`❌ ${dbName} ERROR:`, err.message)
    throw err
  } finally {
    await client.end()
  }
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
