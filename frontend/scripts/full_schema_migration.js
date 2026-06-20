#!/usr/bin/env node
/**
 * RODEO — Full Schema Migration (Master Script)
 * ============================================================
 * Aplica TODA la estructura de la base de datos en orden correcto.
 * Idempotente: seguro para ejecutar en DBs nuevas O existentes.
 * Reemplaza: migrate-db.js + add_missing_columns.js + create_missing_tables.js
 *
 * Uso:
 *   node scripts/full_schema_migration.js "$DATABASE_URL"
 *   node scripts/full_schema_migration.js "$DATABASE_URL" --verify-only
 *
 * Orden de aplicación:
 *   1. Extensions
 *   2. Core tables (subscriptions_plans, organizations, profiles, paddocks, herds, grazing_plans, etc.)
 *   3. Additive column migrations (IF NOT EXISTS)
 *   4. Auxiliary tables (notifications, farm_events, tasks, field_notes, audit_logs, etc.)
 *   5. Subscription plans seed data
 *   6. RLS & indexes
 *   7. Verification report
 */

const { Client } = require('pg')

const DB_URL = process.argv[2] || process.env.DATABASE_URL || process.env.DB_URL
const VERIFY_ONLY = process.argv.includes('--verify-only')

if (!DB_URL) {
  console.error('❌ ERROR: Proveer DATABASE_URL como argumento o variable de entorno.')
  console.error('  Uso: node scripts/full_schema_migration.js "$DATABASE_URL"')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// STEP 0: Extensions
// ═══════════════════════════════════════════════════════════════
const STEP_0_EXTENSIONS = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
`

// ═══════════════════════════════════════════════════════════════
// STEP 1: Core Tables (CREATE IF NOT EXISTS)
// ═══════════════════════════════════════════════════════════════
const STEP_1_CORE_TABLES = `
-- subscriptions_plans (must be first — organizations references it)
CREATE TABLE IF NOT EXISTS subscriptions_plans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  slug             TEXT        UNIQUE,
  price            DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_ars        DECIMAL(10,2),
  price_usd        DECIMAL(10,2),
  price_yearly     DECIMAL(10,2) DEFAULT 0,
  description      TEXT,
  color            TEXT        DEFAULT '#22C55E',
  is_popular       BOOLEAN     DEFAULT false,
  is_active        BOOLEAN     DEFAULT true,
  sort_order       INT         DEFAULT 0,
  trial_days       INT         DEFAULT 0,
  paddocks_limit   INT         DEFAULT 5,
  herds_limit      INT         DEFAULT 1,
  has_ai_analysis  BOOLEAN     DEFAULT false,
  billing_period   VARCHAR(255) DEFAULT 'monthly',
  stripe_price_id  VARCHAR(255),
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  mp_plan_id       VARCHAR(255),
  mp_preapproval_plan_id  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- organizations (the "farm" / "establishment")
CREATE TABLE IF NOT EXISTS organizations (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                      VARCHAR(255),
  name                          VARCHAR(255) NOT NULL,
  field_name                    TEXT,
  total_area_ha                 DECIMAL(10,2),
  total_area                    DECIMAL(10,2),
  boundaries                    GEOMETRY(MultiPolygon, 4326),
  location                      GEOMETRY(Point, 4326),
  address                       TEXT,
  location_label                TEXT,
  region_id                     TEXT,
  drought_plan_buffer           INT         DEFAULT 20,
  subscription_plan_id          UUID        REFERENCES subscriptions_plans(id),
  plan_status                   TEXT        DEFAULT 'active'
    CHECK (plan_status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  trial_ends_at                 TIMESTAMPTZ,
  plan_expires_at               TIMESTAMPTZ,
  stripe_customer_id            TEXT,
  stripe_subscription_id        TEXT,
  mp_subscription_id            TEXT,
  default_daily_allocation_kg   NUMERIC(8,2)  DEFAULT 12,
  default_target_remnant_kg_ha  NUMERIC(10,2) DEFAULT 600,
  technical_data                JSONB        DEFAULT '{}',
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- profiles (users — linked to Firebase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid              TEXT        UNIQUE,
  email                     TEXT        UNIQUE,
  organization_id           UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  role                      VARCHAR(50) CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')),
  is_active                 BOOLEAN     DEFAULT true,
  first_name                TEXT,
  last_name                 TEXT,
  phone                     TEXT,
  avatar_url                TEXT,
  team_role                 TEXT,
  permissions               JSONB,
  notification_preferences  JSONB       DEFAULT '{"reminders": true, "weekly_summary": true}'::jsonb,
  country_code              VARCHAR(2),
  country                   TEXT,
  onboarding_step           INT         DEFAULT 0,
  is_first_login            BOOLEAN     DEFAULT true,
  system_role               TEXT        CHECK (system_role IN ('SUPER_ADMIN', 'SUPPORT_AGENT')),
  completed_tours           TEXT[]      DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- paddocks (potreros)
CREATE TABLE IF NOT EXISTS paddocks (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name                        VARCHAR(255) NOT NULL,
  area_ha                     DECIMAL(10,2),
  geom                        GEOMETRY(MultiPolygon, 4326),
  location                    GEOMETRY(Point, 4326),
  is_grazable                 BOOLEAN     DEFAULT true,
  is_active                   BOOLEAN     DEFAULT true,
  active_from                 DATE,
  current_status              VARCHAR(50) DEFAULT 'RESTING'
    CHECK (current_status IN ('RESTING', 'GRAZING')),
  estimated_adh               DECIMAL(10,2) DEFAULT 0,
  dry_matter_kg_ha            DECIMAL(10,2),
  current_ndvi                DECIMAL(6,4),
  previous_dry_matter_kg_ha   DECIMAL(10,2),
  previous_ndvi_date          DATE,
  technical_data              JSONB       DEFAULT '{}',
  version                     INT         DEFAULT 1,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- herds (rodeos)
CREATE TABLE IF NOT EXISTS herds (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name                    VARCHAR(255) NOT NULL,
  species                 VARCHAR(100) DEFAULT 'Bovine',
  breed                   VARCHAR(100),
  category                VARCHAR(100),
  categoria               TEXT,
  head_count              INT         NOT NULL DEFAULT 0,
  avg_weight_kg           DECIMAL(10,2),
  total_ev                DECIMAL(10,2),
  age_years               DECIMAL(5,2),
  age_months              INT,
  admission_date          DATE,
  exit_date               DATE,
  physiological_category  VARCHAR(50),
  last_weigh_date         DATE,
  daily_gain_kg           DECIMAL(8,3),
  lactancia_range         TEXT,
  estadio_gestacion       TEXT,
  custom_racion_kg        DECIMAL(8,2),
  grupo_manejo_id         UUID,
  grupo_manejo_nombre     TEXT,
  bcs_score               DECIMAL(3,1),
  bcs_label               TEXT,
  bcs_data                JSONB,
  photo_url               TEXT,
  parent_herd_id          UUID        REFERENCES herds(id) ON DELETE SET NULL,
  herd_notes              TEXT,
  version                 INT         DEFAULT 1,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- grazing_plans
CREATE TABLE IF NOT EXISTS grazing_plans (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  paddock_id              UUID        REFERENCES paddocks(id) ON DELETE CASCADE,
  herd_id                 UUID        REFERENCES herds(id) ON DELETE CASCADE,
  herd_ids                JSONB,
  entry_date              DATE        NOT NULL,
  exit_date               DATE,
  actual_entry_date       DATE,
  actual_exit_date        DATE,
  adjusted_entry_date     DATE,
  adjusted_exit_date      DATE,
  planned_recovery_days   INT,
  status                  VARCHAR(50) DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'HISTORY')),
  actual_adh_consumed     DECIMAL(10,2) DEFAULT 0,
  temporary_animals       JSONB,
  notes                   TEXT,
  exit_notes              TEXT,
  exit_dry_matter_kg_ha   DECIMAL(10,2),
  target_remnant          DECIMAL(10,2),
  grace_days              INT,
  ai_analysis             JSONB,
  is_locked               BOOLEAN     DEFAULT false,
  closing_stock           JSONB,
  plan_type               TEXT        DEFAULT 'manual'
    CHECK (plan_type IN ('manual', 'suggested')),
  source_origin           TEXT        DEFAULT 'human'
    CHECK (source_origin IN ('human', 'algorithm')),
  cycle_id                UUID,
  season_plan_id          UUID,
  version                 INT         DEFAULT 1,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- biological_monitoring
CREATE TABLE IF NOT EXISTS biological_monitoring (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paddock_id                UUID        REFERENCES paddocks(id) ON DELETE CASCADE,
  observer_id               UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  photo_url                 TEXT,
  audio_url                 TEXT,
  ground_cover_pct          DECIMAL(5,2),
  grass_height_cm           DECIMAL(10,2),
  dry_matter_estimate_kg    DECIMAL(10,2),
  ai_analysis               JSONB,
  recorded_at               TIMESTAMPTZ DEFAULT NOW(),
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- rainfall_logs
CREATE TABLE IF NOT EXISTS rainfall_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  recorder_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  date        DATE        NOT NULL,
  mm_count    DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                   UUID        REFERENCES subscriptions_plans(id),
  provider                  VARCHAR(20) NOT NULL,
  provider_customer_id      VARCHAR(255),
  provider_sub_id           VARCHAR(255),
  provider_payment_id       VARCHAR(255),
  status                    VARCHAR(50) DEFAULT 'pending',
  amount                    DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency                  VARCHAR(3)  DEFAULT 'USD',
  billing_period_start      TIMESTAMPTZ,
  billing_period_end        TIMESTAMPTZ,
  next_billing_date         TIMESTAMPTZ,
  card_brand                VARCHAR(20),
  card_last_four            VARCHAR(4),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
`

// ═══════════════════════════════════════════════════════════════
// STEP 2: Auxiliary Tables
// ═══════════════════════════════════════════════════════════════
const STEP_2_AUXILIARY_TABLES = `
-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id  UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'INFO',
  title       TEXT        NOT NULL,
  message     TEXT,
  body        TEXT,
  data        JSONB,
  entity_type TEXT,
  entity_id   UUID,
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- farm_events (agenda)
CREATE TABLE IF NOT EXISTS farm_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  event_date       DATE,
  event_type       TEXT,
  category         TEXT,
  all_day          BOOLEAN     DEFAULT true,
  recurrence       TEXT,
  notes            TEXT,
  description      TEXT,
  metadata         JSONB,
  status           TEXT        DEFAULT 'SCHEDULED',
  herd_id          UUID        REFERENCES herds(id) ON DELETE SET NULL,
  herd_ids         JSONB,
  paddock_id       UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
  assigned_to      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  bulls_count      INT,
  bulls_weight     NUMERIC(8,2),
  photo_url        TEXT,
  audio_url        TEXT,
  source           TEXT        DEFAULT 'agenda',
  idempotency_key  TEXT,
  end_date         DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farm_events_org_id_early      ON farm_events(org_id);
CREATE INDEX IF NOT EXISTS idx_farm_events_idempotency_early ON farm_events(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  paddock_id  UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  task_type   TEXT        NOT NULL DEFAULT 'GENERAL',
  priority    TEXT        NOT NULL DEFAULT 'MEDIA',
  status      TEXT        NOT NULL DEFAULT 'PENDIENTE',
  due_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- field_notes (bitácora)
CREATE TABLE IF NOT EXISTS field_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  paddock_id      UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
  tags            TEXT[],
  category        TEXT,
  title           TEXT,
  content         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  photo_url       TEXT,
  photo_urls      TEXT[],
  audio_url       TEXT,
  analysis_result JSONB,
  source          TEXT        NOT NULL DEFAULT 'APP',
  status          TEXT        NOT NULL DEFAULT 'APPROVED',
  whatsapp_from   TEXT,
  raw_message     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- grazing_plan_entries
CREATE TABLE IF NOT EXISTS grazing_plan_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID        NOT NULL REFERENCES grazing_plans(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date  DATE,
  exit_date   DATE,
  herd_id     UUID        REFERENCES herds(id) ON DELETE SET NULL,
  herd_ids    JSONB,
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'PLANNED',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- plan_feature_flags
CREATE TABLE IF NOT EXISTS plan_feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID        NOT NULL REFERENCES subscriptions_plans(id) ON DELETE CASCADE,
  flag_key    TEXT        NOT NULL,
  flag_value  JSONB       NOT NULL,
  label       TEXT,
  flag_type   TEXT        DEFAULT 'boolean'
    CHECK (flag_type IN ('boolean', 'number', 'string')),
  UNIQUE (plan_id, flag_key)
);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  actor_email TEXT,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- system_config
CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT        NOT NULL PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  label       TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general',
  is_secret   BOOLEAN     NOT NULL DEFAULT false,
  updated_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- terms_and_conditions_versions
CREATE TABLE IF NOT EXISTS terms_and_conditions_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number VARCHAR(20) NOT NULL UNIQUE,
  content_url    TEXT,
  effective_date DATE,
  is_current     BOOLEAN     DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- user_terms_acceptances
CREATE TABLE IF NOT EXISTS user_terms_acceptances (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  version_id  UUID        REFERENCES terms_and_conditions_versions(id),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT,
  UNIQUE (profile_id, version_id)
);

-- invitations (team invitations)
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'MEMBER',
  team_role   TEXT,
  permissions JSONB,
  status      TEXT        NOT NULL DEFAULT 'PENDING',
  token       TEXT        UNIQUE,
  expires_at  TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- team_invitations (used by /api/invitations — extended invitation model with name fields)
CREATE TABLE IF NOT EXISTS team_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        DEFAULT 'OPERATOR',
  team_role   TEXT        DEFAULT 'CAPATAZ',
  permissions JSONB       DEFAULT '{}',
  status      TEXT        DEFAULT 'PENDING',
  token       TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ,
  invited_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  first_name  TEXT,
  last_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id    ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email     ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token     ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_inv_org_status        ON team_invitations(org_id, status);


-- custom_roles (RBAC)
CREATE TABLE IF NOT EXISTS custom_roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  permissions JSONB,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, name)
);

-- historial_potrero
CREATE TABLE IF NOT EXISTS historial_potrero (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  paddock_id      UUID        REFERENCES paddocks(id) ON DELETE CASCADE,
  fecha           DATE        NOT NULL,
  dm_kg_ha        DECIMAL(10,2),
  ndvi            DECIMAL(6,4),
  precipitacion   DECIMAL(8,2),
  estado_pastoreo TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (paddock_id, fecha)
);

-- system_feature_flags
CREATE TABLE IF NOT EXISTS system_feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    TEXT        NOT NULL UNIQUE,
  flag_value  JSONB       NOT NULL,
  description TEXT,
  updated_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- whatsapp_links
CREATE TABLE IF NOT EXISTS whatsapp_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL UNIQUE,
  is_active   BOOLEAN     DEFAULT true,
  linked_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- movements
CREATE TABLE IF NOT EXISTS movements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  type        TEXT,
  description TEXT,
  date        DATE,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- climate_projections
CREATE TABLE IF NOT EXISTS climate_projections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  forecast_date   DATE,
  data            JSONB,
  source          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- impersonation_sessions (admin)
CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID        NOT NULL REFERENCES profiles(id),
  admin_email     TEXT        NOT NULL,
  target_user_id  UUID        NOT NULL REFERENCES profiles(id),
  target_email    TEXT        NOT NULL,
  reason          TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);
`

// ═══════════════════════════════════════════════════════════════
// STEP 3: Seed Data
// ═══════════════════════════════════════════════════════════════
const STEP_3_SEED_DATA = `
-- Desactivar planes viejos si existen
UPDATE subscriptions_plans
  SET is_active = false
  WHERE slug IN ('campo_libre', 'pro_ganadero', 'pro_ganadero+', 'Free', 'Starter', 'Pro', 'Enterprise')
    AND is_active = true;

-- Insertar los 4 planes definitivos (idempotente)
INSERT INTO subscriptions_plans
  (name, slug, price, price_yearly, description, color, is_popular, sort_order,
   paddocks_limit, herds_limit, has_ai_analysis, trial_days, is_active)
VALUES
  ('Brote',       'brote',       0,   0,   'Para empezar a digitalizar tu campo. Gratis para siempre.',                        '#6B7280', false, 1, 5,  1,  false, 0,  true),
  ('Planificador','planificador', 79,  65,  'Para el productor comercial que quiere digitalizar su gestión diaria.',            '#22C55E', false, 2, -1, -1, false, 45, true),
  ('Holístico',   'holistico',   199, 165, 'Para el productor regenerativo con IA, Savory y satélite.',                       '#16A34A', true,  3, -1, -1, true,  45, true),
  ('Latifundio',  'latifundio',  0,   0,   'Para grupos inversores y campos corporativos. Precio a medida.',                   '#111827', false, 4, -1, -1, true,  45, true)
ON CONFLICT (slug) DO UPDATE SET
  name            = EXCLUDED.name,
  price           = EXCLUDED.price,
  price_yearly    = EXCLUDED.price_yearly,
  description     = EXCLUDED.description,
  color           = EXCLUDED.color,
  is_popular      = EXCLUDED.is_popular,
  sort_order      = EXCLUDED.sort_order,
  paddocks_limit  = EXCLUDED.paddocks_limit,
  herds_limit     = EXCLUDED.herds_limit,
  has_ai_analysis = EXCLUDED.has_ai_analysis,
  trial_days      = EXCLUDED.trial_days,
  is_active       = EXCLUDED.is_active,
  updated_at      = NOW();

-- Feature flags por plan
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '20',    'Máx. potreros',             'number'),
  ('max_herds',        '1',     'Máx. rodeos',               'number'),
  ('max_team_members', '1',     'Miembros de equipo',        'number'),
  ('map',              'true',  'Mapa de campo + potreros',  'boolean'),
  ('clima',            'true',  'Módulo clima y alertas',    'boolean'),
  ('agenda',           'true',  'Agenda / eventos',          'boolean'),
  ('grazing_planner',  'false', 'Planificador de pastoreo',  'boolean'),
  ('tareas',           'false', 'Gestión de tareas',         'boolean'),
  ('equipo',           'false', 'Gestión de equipo',         'boolean'),
  ('voice_bitacora',   'false', 'Bitácora de voz + IA',      'boolean'),
  ('ai_insights',      'false', 'Insights IA (Gemini)',      'boolean'),
  ('ndvi_access',      'false', 'NDVI satelital (Sentinel)', 'boolean'),
  ('api_access',       'false', 'Acceso API corporativa',    'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'brote'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value;

INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',   'Máx. potreros (ilimitado)', 'number'),
  ('max_herds',        '5',    'Máx. rodeos',               'number'),
  ('max_team_members', '3',    'Miembros de equipo',        'number'),
  ('map',              'true', 'Mapa de campo + potreros',  'boolean'),
  ('clima',            'true', 'Módulo clima y alertas',    'boolean'),
  ('agenda',           'true', 'Agenda / eventos',          'boolean'),
  ('grazing_planner',  'true', 'Planificador de pastoreo',  'boolean'),
  ('tareas',           'true', 'Gestión de tareas',         'boolean'),
  ('equipo',           'true', 'Gestión de equipo',         'boolean'),
  ('voice_bitacora',   'false','Bitácora de voz + IA',      'boolean'),
  ('ai_insights',      'false','Insights IA (Gemini)',      'boolean'),
  ('ndvi_access',      'false','NDVI satelital (Sentinel)', 'boolean'),
  ('api_access',       'false','Acceso API corporativa',    'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'planificador'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value;

INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',  'Máx. potreros (ilimitado)', 'number'),
  ('max_herds',        '-1',  'Máx. rodeos (ilimitado)',   'number'),
  ('max_team_members', '-1',  'Miembros de equipo',        'number'),
  ('map',              'true','Mapa de campo + potreros',  'boolean'),
  ('clima',            'true','Módulo clima y alertas',    'boolean'),
  ('agenda',           'true','Agenda / eventos',          'boolean'),
  ('grazing_planner',  'true','Planificador de pastoreo',  'boolean'),
  ('tareas',           'true','Gestión de tareas',         'boolean'),
  ('equipo',           'true','Gestión de equipo',         'boolean'),
  ('voice_bitacora',   'true','Bitácora de voz + IA',      'boolean'),
  ('ai_insights',      'true','Insights IA (Gemini)',      'boolean'),
  ('ndvi_access',      'true','NDVI satelital (Sentinel)', 'boolean'),
  ('api_access',       'false','Acceso API corporativa',   'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'holistico'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value;

INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
FROM subscriptions_plans p,
(VALUES
  ('max_paddocks',     '-1',  'Máx. potreros (ilimitado)', 'number'),
  ('max_herds',        '-1',  'Máx. rodeos (ilimitado)',   'number'),
  ('max_team_members', '-1',  'Miembros de equipo',        'number'),
  ('map',              'true','Mapa de campo + potreros',  'boolean'),
  ('clima',            'true','Módulo clima y alertas',    'boolean'),
  ('agenda',           'true','Agenda / eventos',          'boolean'),
  ('grazing_planner',  'true','Planificador de pastoreo',  'boolean'),
  ('tareas',           'true','Gestión de tareas',         'boolean'),
  ('equipo',           'true','Gestión de equipo',         'boolean'),
  ('voice_bitacora',   'true','Bitácora de voz + IA',      'boolean'),
  ('ai_insights',      'true','Insights IA (Gemini)',      'boolean'),
  ('ndvi_access',      'true','NDVI satelital (Sentinel)', 'boolean'),
  ('api_access',       'true','Acceso API corporativa',    'boolean')
) AS unnested(flag_key, flag_value, label, flag_type)
WHERE p.slug = 'latifundio'
ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value;

-- system_config defaults (menú y configuraciones base)
INSERT INTO system_config (key, value, label, category) VALUES
  ('show_herds',          'true', 'Mostrar Rodeos',              'menu'),
  ('show_paddocks',       'true', 'Mostrar Potreros',            'menu'),
  ('show_grazing_plans',  'true', 'Mostrar Planes de Pastoreo',  'menu'),
  ('show_field_notes',    'true', 'Mostrar Notas de Campo',      'menu'),
  ('show_tasks',          'true', 'Mostrar Tareas',              'menu'),
  ('show_farm_events',    'true', 'Mostrar Eventos',             'menu'),
  ('show_rainfall',       'true', 'Mostrar Lluvia',              'menu'),
  ('show_climate',        'true', 'Mostrar Clima',               'menu')
ON CONFLICT (key) DO NOTHING;
`

// ═══════════════════════════════════════════════════════════════
// STEP 4: Indexes
// ═══════════════════════════════════════════════════════════════
const STEP_4_INDEXES = `
-- Core performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid    ON profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_email           ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id          ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_system_role     ON profiles(system_role) WHERE system_role IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_paddocks_org_id          ON paddocks(org_id);
CREATE INDEX IF NOT EXISTS idx_paddocks_is_active       ON paddocks(is_active);
CREATE INDEX IF NOT EXISTS idx_paddocks_geom            ON paddocks USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_paddocks_location        ON paddocks USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_herds_org_id             ON herds(org_id);
CREATE INDEX IF NOT EXISTS idx_herds_physio             ON herds(org_id, physiological_category);

CREATE INDEX IF NOT EXISTS idx_grazing_plans_org_id     ON grazing_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_paddock    ON grazing_plans(paddock_id);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_herd       ON grazing_plans(herd_id);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_status     ON grazing_plans(org_id, status);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_cycle      ON grazing_plans(cycle_id);

CREATE INDEX IF NOT EXISTS idx_farm_events_org_id       ON farm_events(org_id);
CREATE INDEX IF NOT EXISTS idx_farm_events_idempotency  ON farm_events(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_profile    ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id     ON notifications(org_id);

CREATE INDEX IF NOT EXISTS idx_tasks_org_id             ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to        ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status             ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_field_notes_org_id       ON field_notes(org_id);
CREATE INDEX IF NOT EXISTS idx_field_notes_paddock      ON field_notes(paddock_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor         ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created       ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity        ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_plan_flags_plan          ON plan_feature_flags(plan_id);

CREATE INDEX IF NOT EXISTS idx_invitations_org          ON invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email        ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token        ON invitations(token);

CREATE INDEX IF NOT EXISTS idx_orgs_location            ON organizations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_orgs_boundaries          ON organizations USING GIST(boundaries);
CREATE INDEX IF NOT EXISTS idx_historial_paddock_fecha  ON historial_potrero(paddock_id, fecha);
`

// ═══════════════════════════════════════════════════════════════
// STEP 5: Ensure gen_random_uuid() defaults on all UUID PKs
// ═══════════════════════════════════════════════════════════════
const STEP_5_UUID_DEFAULTS = `
DO $$ DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'audit_logs','biological_monitoring','climate_projections','farm_events',
    'field_notes','grazing_plan_entries','grazing_plans','herds','invitations',
    'movements','notifications','organizations','paddocks','payments',
    'plan_feature_flags','profiles','rainfall_logs','subscriptions_plans',
    'system_feature_flags','tasks','terms_and_conditions_versions',
    'user_terms_acceptances'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=tbl
        AND column_name='id' AND data_type='uuid'
        AND column_default IS NULL
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT gen_random_uuid()', tbl);
      RAISE NOTICE 'UUID default set on: %', tbl;
    END IF;
  END LOOP;
END $$;
`

// ═══════════════════════════════════════════════════════════════
// VERIFICATION QUERIES
// ═══════════════════════════════════════════════════════════════
const CRITICAL_CHECKS = [
  {
    name: 'profiles.firebase_uid',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='firebase_uid' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'profiles.onboarding_step',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='onboarding_step' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'organizations.plan_status',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='plan_status' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'organizations.trial_ends_at',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='trial_ends_at' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'subscriptions_plans.slug (holistico)',
    sql: `SELECT 1 FROM subscriptions_plans WHERE slug='holistico' AND is_active=true`,
    critical: true
  },
  {
    name: 'plan_feature_flags table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='plan_feature_flags' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'terms_and_conditions_versions table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='terms_and_conditions_versions' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'system_config table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='system_config' AND table_schema='public'`,
    critical: true
  },
  {
    name: 'notifications table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='notifications' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'farm_events table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='farm_events' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'field_notes table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='field_notes' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'tasks table',
    sql: `SELECT 1 FROM information_schema.tables WHERE table_name='tasks' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'herds.physiological_category',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='herds' AND column_name='physiological_category' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'paddocks.dry_matter_kg_ha',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='paddocks' AND column_name='dry_matter_kg_ha' AND table_schema='public'`,
    critical: false
  },
  {
    name: 'grazing_plans.org_id',
    sql: `SELECT 1 FROM information_schema.columns WHERE table_name='grazing_plans' AND column_name='org_id' AND table_schema='public'`,
    critical: false
  },
]

async function runStep(client, name, sql) {
  try {
    await client.query(sql)
    console.log(`  ✅ ${name}`)
    return true
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`)
    return false
  }
}

async function verify(client) {
  console.log('\n📋 Verificación de integridad del esquema:')
  let criticalFails = 0
  let warnFails = 0

  for (const check of CRITICAL_CHECKS) {
    const result = await client.query(check.sql)
    const ok = result.rows.length > 0
    const icon = ok ? '✅' : (check.critical ? '❌' : '⚠️')
    console.log(`  ${icon} ${check.name}`)
    if (!ok && check.critical) criticalFails++
    if (!ok && !check.critical) warnFails++
  }

  // Count plans
  const plansResult = await client.query(
    `SELECT slug, trial_days FROM subscriptions_plans WHERE is_active=true ORDER BY sort_order`
  )
  console.log(`\n  📦 Planes activos (${plansResult.rows.length}):`)
  plansResult.rows.forEach(p => console.log(`     - ${p.slug} (trial: ${p.trial_days} días)`))

  // Count tables
  const tablesResult = await client.query(
    `SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  )
  console.log(`\n  📊 Total tablas en public schema: ${tablesResult.rows[0].cnt}`)

  if (criticalFails > 0) {
    console.error(`\n❌ ${criticalFails} verificaciones CRÍTICAS fallaron — revisar output arriba.`)
    return false
  }
  if (warnFails > 0) {
    console.warn(`\n⚠️  ${warnFails} verificaciones no críticas fallaron — revisar si es necesario.`)
  }
  console.log(`\n✅ Esquema verificado correctamente.`)
  return true
}

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })

  const dbLabel = DB_URL.includes('34.95') ? 'PROD' : DB_URL.includes('35.247') ? 'STAGING' : 'DB'
  console.log(`🐄 RODEO — Full Schema Migration`)
  console.log(`🔗 Conectando a ${dbLabel}: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`)

  await client.connect()
  console.log(`✅ Conexión exitosa\n`)

  if (VERIFY_ONLY) {
    await verify(client)
    await client.end()
    return
  }

  console.log('📋 Aplicando migraciones...\n')

  const steps = [
    ['Extensions (PostGIS, uuid-ossp, pgcrypto)', STEP_0_EXTENSIONS],
    ['Core tables (organizations, profiles, paddocks, herds, grazing_plans, ...)', STEP_1_CORE_TABLES],
    ['Auxiliary tables (notifications, tasks, field_notes, audit_logs, ...)', STEP_2_AUXILIARY_TABLES],
    ['Seed data (subscription plans, feature flags, system_config)', STEP_3_SEED_DATA],
    ['Indexes de performance', STEP_4_INDEXES],
    ['UUID defaults (gen_random_uuid)', STEP_5_UUID_DEFAULTS],
  ]

  for (const [name, sql] of steps) {
    console.log(`🔄 ${name}`)
    await runStep(client, name, sql)
  }

  const ok = await verify(client)

  await client.end()

  if (!ok) {
    process.exit(1)
  }

  console.log('\n🎉 Migración completada. La DB está lista para recibir usuarios.')
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message)
  process.exit(1)
})
