-- ============================================================
-- RODEO — Migration completa
-- Ejecutar en Cloud SQL (PostgreSQL + PostGIS)
-- Seguro para ejecutar en DB existente (usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- ── 0. Extensiones ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Profiles — columnas adicionales ──────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS firebase_uid  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS team_role     TEXT,
  ADD COLUMN IF NOT EXISTS permissions   JSONB,
  ADD COLUMN IF NOT EXISTS phone         TEXT;

-- ── 2. Paddocks — columnas adicionales ───────────────────────────────────────
ALTER TABLE paddocks
  ADD COLUMN IF NOT EXISTS dry_matter_kg_ha           DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS current_ndvi               DECIMAL(6,4),
  ADD COLUMN IF NOT EXISTS previous_dry_matter_kg_ha  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS previous_ndvi_date         DATE,
  ADD COLUMN IF NOT EXISTS technical_data             JSONB;

-- ── 3. Herds — columnas adicionales ──────────────────────────────────────────
ALTER TABLE herds
  ADD COLUMN IF NOT EXISTS age_years  DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS bcs_score  DECIMAL(3,1),
  ADD COLUMN IF NOT EXISTS bcs_label  TEXT,
  ADD COLUMN IF NOT EXISTS bcs_data   JSONB,
  ADD COLUMN IF NOT EXISTS photo_url  TEXT;

-- ── 4. Field Notes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_notes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  paddock_id       UUID        REFERENCES paddocks(id)  ON DELETE SET NULL,
  category         TEXT        NOT NULL DEFAULT 'GENERAL',
  tags             JSONB,
  title            TEXT        NOT NULL,
  content          TEXT,
  lat              DECIMAL(10,7),
  lng              DECIMAL(10,7),
  photo_url        TEXT,
  audio_url        TEXT,
  analysis_result  JSONB,
  sync_status      TEXT        DEFAULT 'SYNCED',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by   UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to  UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  paddock_id   UUID    REFERENCES paddocks(id)  ON DELETE SET NULL,
  title        TEXT    NOT NULL,
  description  TEXT,
  task_type    TEXT    NOT NULL DEFAULT 'GENERAL',
  priority     TEXT    NOT NULL DEFAULT 'NORMAL',
  status       TEXT    NOT NULL DEFAULT 'PENDIENTE',
  due_date     DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Organizations — columna region_id si falta ────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS region_id          TEXT,
  ADD COLUMN IF NOT EXISTS drought_plan_buffer INT DEFAULT 20;

-- ── 7. Índices de performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_paddocks_org_id     ON paddocks(org_id);
CREATE INDEX IF NOT EXISTS idx_herds_org_id        ON herds(org_id);
CREATE INDEX IF NOT EXISTS idx_field_notes_org_id  ON field_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_field_notes_paddock ON field_notes(paddock_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id        ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_profiles_firebase   ON profiles(firebase_uid);

-- ── 8. Grazing plans — columnas usadas por el planificador ───────────────────
ALTER TABLE grazing_plans
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Rellenar org_id desde el paddock si falta
UPDATE grazing_plans gp
SET org_id = p.org_id
FROM paddocks p
WHERE gp.paddock_id = p.id
  AND gp.org_id IS NULL;

-- Fin de migración ────────────────────────────────────────────────────────────
