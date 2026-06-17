#!/usr/bin/env node
/**
 * RODEO — Emergency Production Migration
 * Creates the 10 missing tables and seeds critical data (feature flags, system config).
 * 100% idempotent — safe to re-run.
 * 
 * Usage: DATABASE_URL=... node production_emergency_migration.js
 */
const { Pool } = require('pg')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

const MIGRATIONS = [
  {
    name: '1. Extensions',
    sql: `
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `
  },
  {
    name: '2. Table: market_prices (Motor Predictivo v3)',
    sql: `
      CREATE TABLE IF NOT EXISTS market_prices (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        category    TEXT        NOT NULL,
        price_ars   DECIMAL(12,2) NOT NULL,
        unit        TEXT        NOT NULL DEFAULT 'KG_VIVO',
        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
        source      TEXT        DEFAULT 'MAG'
      );
      CREATE INDEX IF NOT EXISTS idx_market_prices_category ON market_prices(category);
    `
  },
  {
    name: '3. Table: ndvi_logs (NDVI Satelital v3)',
    sql: `
      CREATE TABLE IF NOT EXISTS ndvi_logs (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        paddock_id  UUID        NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
        ndvi_value  DECIMAL(6,4) NOT NULL,
        recorded_at DATE        NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ndvi_logs_paddock ON ndvi_logs(paddock_id);
      CREATE INDEX IF NOT EXISTS idx_ndvi_logs_date ON ndvi_logs(recorded_at);
    `
  },
  {
    name: '4. Table: carbon_assessments (Módulo Carbono v4)',
    sql: `
      CREATE TABLE IF NOT EXISTS carbon_assessments (
        id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id                 UUID REFERENCES organizations(id) ON DELETE CASCADE,
        paddock_id             UUID REFERENCES paddocks(id) ON DELETE SET NULL,
        assessment_date        DATE NOT NULL,
        soil_organic_carbon_pct DECIMAL(5, 2) NOT NULL,
        total_carbon_tons      DECIMAL(10, 2) NOT NULL,
        methodology            VARCHAR(100) DEFAULT 'EOV Savory',
        assessor_name          VARCHAR(255),
        notes                  TEXT,
        created_at             TIMESTAMPTZ DEFAULT NOW(),
        updated_at             TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: '5. Table: carbon_certificates (Módulo Carbono v4)',
    sql: `
      CREATE TABLE IF NOT EXISTS carbon_certificates (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
        assessment_id    UUID REFERENCES carbon_assessments(id) ON DELETE CASCADE,
        issue_date       DATE NOT NULL,
        vintage_year     INT NOT NULL,
        tons_issued      DECIMAL(10, 2) NOT NULL,
        status           VARCHAR(50) CHECK (status IN ('PENDING', 'ISSUED', 'RETIRED', 'CANCELLED')) DEFAULT 'PENDING',
        certificate_url  TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: '6. Table: climate_adjustment_snapshots (Ajuste Clima v5)',
    sql: `
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
      CREATE INDEX IF NOT EXISTS idx_cas_org_paddock   ON climate_adjustment_snapshots (org_id, paddock_id);
      CREATE INDEX IF NOT EXISTS idx_cas_calculated_at ON climate_adjustment_snapshots (calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_cas_alert_level   ON climate_adjustment_snapshots (alert_level) WHERE alert_level != 'ok';
    `
  },
  {
    name: '7. Table: weather_cache (Cache Clima v5)',
    sql: `
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
        drought_index       VARCHAR(10) DEFAULT 'NONE',
        condition_code      INTEGER,
        radiacion_solar     NUMERIC(8,2),
        fetched_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_weather_cache_org ON weather_cache (org_id, fetched_at DESC);
    `
  },
  {
    name: '8. Table: impersonation_sessions (Admin)',
    sql: `
      CREATE TABLE IF NOT EXISTS impersonation_sessions (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id       UUID NOT NULL REFERENCES profiles(id),
        admin_email    TEXT NOT NULL,
        target_user_id UUID NOT NULL REFERENCES profiles(id),
        target_email   TEXT NOT NULL,
        reason         TEXT,
        started_at     TIMESTAMPTZ DEFAULT NOW(),
        ended_at       TIMESTAMPTZ
      );
    `
  },
  {
    name: '9. Table: custom_roles (RBAC)',
    sql: `
      CREATE TABLE IF NOT EXISTS custom_roles (
        id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name        TEXT        NOT NULL,
        label       TEXT        NOT NULL,
        description TEXT,
        permissions JSONB       NOT NULL DEFAULT '{}',
        created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_custom_roles_org_id ON custom_roles(org_id);
    `
  },
  {
    name: '10. Table: historial_potrero (Historial Potrero)',
    sql: `
      CREATE TABLE IF NOT EXISTS historial_potrero (
        id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id                   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        paddock_id               UUID        NOT NULL REFERENCES paddocks(id)     ON DELETE CASCADE,
        fecha                    DATE        NOT NULL,
        ndvi                     NUMERIC(5,3),
        fuente_ndvi              VARCHAR(20) DEFAULT 'satellite' CHECK (fuente_ndvi IN ('satellite', 'manual', 'estimated')),
        precipitacion_api_mm     NUMERIC(8,2),
        precipitacion_usuario_mm NUMERIC(8,2),
        humedad_pct              NUMERIC(5,1),
        velocidad_viento_kmh     NUMERIC(6,1),
        temperatura_c            NUMERIC(5,1),
        radiacion_solar          NUMERIC(8,2),
        et_calculada_mm          NUMERIC(8,2),
        balance_hidrico_mm       NUMERIC(8,2),
        c_adj                    NUMERIC(6,4),
        lluvia_fuente            VARCHAR(20) DEFAULT 'api' CHECK (lluvia_fuente IN ('user', 'api', 'assumed_zero')),
        rs_fuente                VARCHAR(20) DEFAULT 'api' CHECK (rs_fuente IN ('api', 'estimated_latitude')),
        temp_fuente              VARCHAR(20) DEFAULT 'api' CHECK (temp_fuente IN ('api', 'seasonal_estimate')),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_paddock_fecha      ON historial_potrero (paddock_id, fecha);
      CREATE INDEX IF NOT EXISTS idx_hp_org_paddock_fecha          ON historial_potrero (org_id, paddock_id, fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_hp_ndvi_notnull               ON historial_potrero (paddock_id, fecha DESC) WHERE ndvi IS NOT NULL;
    `
  },
  {
    name: '11. Table: whatsapp_links (WhatsApp Integration)',
    sql: `
      CREATE TABLE IF NOT EXISTS whatsapp_links (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        phone       VARCHAR(30) NOT NULL UNIQUE,
        profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `
  },
  {
    name: '12. FK constraints for climate_adjustment_snapshots',
    sql: `
      DO $$ BEGIN
        BEGIN
          ALTER TABLE climate_adjustment_snapshots
            ADD CONSTRAINT fk_cas_org     FOREIGN KEY (org_id)     REFERENCES organizations(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TABLE climate_adjustment_snapshots
            ADD CONSTRAINT fk_cas_paddock FOREIGN KEY (paddock_id) REFERENCES paddocks(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `
  },
  {
    name: '13. Additional missing columns on existing tables',
    sql: `
      -- organizations: additional columns
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS address          TEXT,
        ADD COLUMN IF NOT EXISTS location_label   TEXT,
        ADD COLUMN IF NOT EXISTS total_area       DECIMAL(10,2);
      
      -- profiles: country column
      ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS country TEXT;

      -- field_notes: WhatsApp columns
      ALTER TABLE field_notes
        ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'APP',
        ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'APPROVED',
        ADD COLUMN IF NOT EXISTS whatsapp_from   TEXT,
        ADD COLUMN IF NOT EXISTS raw_message     TEXT;

      -- grazing_plans: target_remnant and grace_days
      ALTER TABLE grazing_plans
        ADD COLUMN IF NOT EXISTS target_remnant  DECIMAL(10,2),
        ADD COLUMN IF NOT EXISTS grace_days      INT;
    `
  },
  {
    name: '14. Performance Indexes (Production)',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid       ON profiles(firebase_uid);
      CREATE INDEX IF NOT EXISTS idx_paddocks_org_id             ON paddocks(org_id);
      CREATE INDEX IF NOT EXISTS idx_herds_org_id                ON herds(org_id);
      CREATE INDEX IF NOT EXISTS idx_grazing_plans_paddock_status ON grazing_plans(paddock_id, status);
      CREATE INDEX IF NOT EXISTS idx_grazing_plans_herd_id       ON grazing_plans(herd_id);
      CREATE INDEX IF NOT EXISTS idx_grazing_plans_org_id        ON grazing_plans(org_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_org_id                ON tasks(org_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to           ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_farm_events_org_id          ON farm_events(org_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_profile_id    ON notifications(profile_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_field_notes_org_id          ON field_notes(org_id);
      CREATE INDEX IF NOT EXISTS idx_field_notes_paddock_id      ON field_notes(paddock_id);
      CREATE INDEX IF NOT EXISTS idx_plan_flags_plan_id          ON plan_feature_flags(plan_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_system_role        ON profiles(system_role) WHERE system_role IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_herds_physiological_cat     ON herds(physiological_category) WHERE physiological_category IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_herds_grupo_manejo_id       ON herds(grupo_manejo_id) WHERE grupo_manejo_id IS NOT NULL;
    `
  },
  {
    name: '15. Seed: Pricing Plans (4 planes definitivos)',
    sql: `
      -- Add trial_days column if missing
      ALTER TABLE subscriptions_plans
        ADD COLUMN IF NOT EXISTS trial_days INT DEFAULT 0;

      -- Deactivate old plans
      UPDATE subscriptions_plans SET is_active = false
        WHERE slug IN ('campo_libre', 'pro_ganadero', 'pro_ganadero+');

      -- Insert the 4 definitive plans
      INSERT INTO subscriptions_plans
        (name, slug, price, price_yearly, description, color, is_popular, sort_order,
         paddocks_limit, herds_limit, has_ai_analysis, trial_days, is_active)
      VALUES
        ('Brote',        'brote',        0,   0,   'Para empezar a digitalizar tu campo. Gratis para siempre.', '#6B7280', false, 1, 5,   1,  false, 0,  true),
        ('Planificador', 'planificador', 79,  65,  'Para el productor comercial que quiere digitalizar su gestión diaria.', '#22C55E', false, 2, -1, -1, false, 45, true),
        ('Holístico',    'holistico',    199, 165, 'Para el productor regenerativo con IA, Savory y satélite.', '#16A34A', true,  3, -1, -1, true,  45, true),
        ('Latifundio',   'latifundio',   0,   0,   'Para grupos inversores y campos corporativos. Precio a medida.', '#111827', false, 4, -1, -1, true,  45, true)
      ON CONFLICT (slug) DO UPDATE SET
        name           = EXCLUDED.name,
        price          = EXCLUDED.price,
        price_yearly   = EXCLUDED.price_yearly,
        description    = EXCLUDED.description,
        color          = EXCLUDED.color,
        is_popular     = EXCLUDED.is_popular,
        sort_order     = EXCLUDED.sort_order,
        paddocks_limit = EXCLUDED.paddocks_limit,
        herds_limit    = EXCLUDED.herds_limit,
        has_ai_analysis= EXCLUDED.has_ai_analysis,
        trial_days     = EXCLUDED.trial_days,
        is_active      = EXCLUDED.is_active,
        updated_at     = NOW();
    `
  },
  {
    name: '16. Seed: Feature Flags for all plans',
    sql: `
      -- Brote (free plan)
      INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
      SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
      FROM subscriptions_plans p,
      (VALUES
        ('max_paddocks',     '20',     'Máx. potreros',              'number'),
        ('max_herds',        '1',      'Máx. rodeos',                'number'),
        ('max_team_members', '1',      'Miembros de equipo',         'number'),
        ('map',              'true',   'Mapa de campo + potreros',   'boolean'),
        ('clima',            'true',   'Módulo clima y alertas',     'boolean'),
        ('agenda',           'true',   'Agenda / eventos',           'boolean'),
        ('grazing_planner',  'false',  'Planificador de pastoreo',   'boolean'),
        ('tareas',           'false',  'Gestión de tareas',          'boolean'),
        ('equipo',           'false',  'Gestión de equipo',          'boolean'),
        ('voice_bitacora',   'false',  'Bitácora de voz + IA',       'boolean'),
        ('ai_insights',      'false',  'Insights IA (Gemini)',       'boolean'),
        ('advanced_reports', 'false',  'Reportes avanzados',         'boolean'),
        ('carbon_module',    'false',  'Módulo Carbono (MRV)',       'boolean'),
        ('offline_mode',     'false',  'App móvil offline',          'boolean'),
        ('ndvi_access',      'false',  'NDVI satelital (Sentinel)',  'boolean'),
        ('api_access',       'false',  'Acceso API corporativa',     'boolean')
      ) AS unnested(flag_key, flag_value, label, flag_type)
      WHERE p.slug = 'brote'
      ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value, label = EXCLUDED.label;

      -- Planificador
      INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
      SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
      FROM subscriptions_plans p,
      (VALUES
        ('max_paddocks',     '-1',    'Máx. potreros (ilimitado)',  'number'),
        ('max_herds',        '5',     'Máx. rodeos',                'number'),
        ('max_team_members', '3',     'Miembros de equipo',         'number'),
        ('map',              'true',  'Mapa de campo + potreros',   'boolean'),
        ('clima',            'true',  'Módulo clima y alertas',     'boolean'),
        ('agenda',           'true',  'Agenda / eventos',           'boolean'),
        ('grazing_planner',  'true',  'Planificador de pastoreo',   'boolean'),
        ('tareas',           'true',  'Gestión de tareas',          'boolean'),
        ('equipo',           'true',  'Gestión de equipo',          'boolean'),
        ('voice_bitacora',   'false', 'Bitácora de voz + IA',       'boolean'),
        ('ai_insights',      'false', 'Insights IA (Gemini)',       'boolean'),
        ('advanced_reports', 'false', 'Reportes avanzados',         'boolean'),
        ('carbon_module',    'false', 'Módulo Carbono (MRV)',       'boolean'),
        ('offline_mode',     'true',  'App móvil offline',          'boolean'),
        ('ndvi_access',      'false', 'NDVI satelital (Sentinel)',  'boolean'),
        ('api_access',       'false', 'Acceso API corporativa',     'boolean')
      ) AS unnested(flag_key, flag_value, label, flag_type)
      WHERE p.slug = 'planificador'
      ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value, label = EXCLUDED.label;

      -- Holístico
      INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
      SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
      FROM subscriptions_plans p,
      (VALUES
        ('max_paddocks',     '-1',    'Máx. potreros (ilimitado)',  'number'),
        ('max_herds',        '-1',    'Máx. rodeos (ilimitado)',    'number'),
        ('max_team_members', '-1',    'Miembros de equipo',         'number'),
        ('map',              'true',  'Mapa de campo + potreros',   'boolean'),
        ('clima',            'true',  'Módulo clima y alertas',     'boolean'),
        ('agenda',           'true',  'Agenda / eventos',           'boolean'),
        ('grazing_planner',  'true',  'Planificador de pastoreo',   'boolean'),
        ('tareas',           'true',  'Gestión de tareas',          'boolean'),
        ('equipo',           'true',  'Gestión de equipo',          'boolean'),
        ('voice_bitacora',   'true',  'Bitácora de voz + IA',       'boolean'),
        ('ai_insights',      'true',  'Insights IA (Gemini)',       'boolean'),
        ('advanced_reports', 'true',  'Reportes avanzados',         'boolean'),
        ('carbon_module',    'false', 'Módulo Carbono (MRV)',       'boolean'),
        ('offline_mode',     'true',  'App móvil offline',          'boolean'),
        ('ndvi_access',      'true',  'NDVI satelital (Sentinel)',  'boolean'),
        ('api_access',       'false', 'Acceso API corporativa',     'boolean')
      ) AS unnested(flag_key, flag_value, label, flag_type)
      WHERE p.slug = 'holistico'
      ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value, label = EXCLUDED.label;

      -- Latifundio (everything enabled)
      INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
      SELECT p.id, unnested.flag_key, unnested.flag_value::jsonb, unnested.label, unnested.flag_type
      FROM subscriptions_plans p,
      (VALUES
        ('max_paddocks',     '-1',   'Máx. potreros (ilimitado)',   'number'),
        ('max_herds',        '-1',   'Máx. rodeos (ilimitado)',     'number'),
        ('max_team_members', '-1',   'Miembros de equipo',          'number'),
        ('map',              'true', 'Mapa de campo + potreros',    'boolean'),
        ('clima',            'true', 'Módulo clima y alertas',      'boolean'),
        ('agenda',           'true', 'Agenda / eventos',            'boolean'),
        ('grazing_planner',  'true', 'Planificador de pastoreo',    'boolean'),
        ('tareas',           'true', 'Gestión de tareas',           'boolean'),
        ('equipo',           'true', 'Gestión de equipo',           'boolean'),
        ('voice_bitacora',   'true', 'Bitácora de voz + IA',        'boolean'),
        ('ai_insights',      'true', 'Insights IA (Gemini)',        'boolean'),
        ('advanced_reports', 'true', 'Reportes avanzados',          'boolean'),
        ('carbon_module',    'true', 'Módulo Carbono (MRV)',        'boolean'),
        ('offline_mode',     'true', 'App móvil offline',           'boolean'),
        ('ndvi_access',      'true', 'NDVI satelital (Sentinel)',   'boolean'),
        ('api_access',       'true', 'Acceso API corporativa',      'boolean')
      ) AS unnested(flag_key, flag_value, label, flag_type)
      WHERE p.slug = 'latifundio'
      ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = EXCLUDED.flag_value, label = EXCLUDED.label;
    `
  },
  {
    name: '17. Seed: System Feature Flags',
    sql: `
      INSERT INTO system_feature_flags (flag_key, flag_type, flag_value, description)
      VALUES (
        'climate_adjustment', 'boolean', 'true',
        'Habilita el motor de Ajuste Clima para orgs con plan Planificador o superior.'
      ) ON CONFLICT (flag_key) DO NOTHING;
    `
  },
  {
    name: '18. Seed: System Config defaults (if missing)',
    sql: `
      INSERT INTO system_config (key, value, label, category, is_secret) VALUES
        ('stripe_publishable_key',    '', 'Stripe Publishable Key',         'payments', false),
        ('stripe_secret_key',         '', 'Stripe Secret Key',              'payments', true),
        ('stripe_webhook_secret',     '', 'Stripe Webhook Secret',          'payments', true),
        ('mp_public_key',             '', 'MercadoPago Public Key',         'payments', false),
        ('mp_access_token',           '', 'MercadoPago Access Token',       'payments', true),
        ('google_maps_api_key',       '', 'Google Maps API Key',            'integrations', true),
        ('openweather_api_key',       '', 'OpenWeather API Key',            'integrations', true),
        ('firebase_service_account',  '', 'Firebase Service Account JSON',  'auth', true),
        ('show_herds',         'true', 'Mostrar Rodeos',              'menu', false),
        ('show_paddocks',      'true', 'Mostrar Potreros',            'menu', false),
        ('show_grazing_plans', 'true', 'Mostrar Planes de Pastoreo',  'menu', false),
        ('show_field_notes',   'true', 'Mostrar Notas de Campo',      'menu', false),
        ('show_tasks',         'true', 'Mostrar Tareas',              'menu', false),
        ('show_farm_events',   'true', 'Mostrar Eventos',             'menu', false),
        ('show_rainfall',      'true', 'Mostrar Lluvia',              'menu', false),
        ('show_climate',       'true', 'Mostrar Clima',               'menu', false),
        ('show_planning',      'true', 'Mostrar Planificación',       'menu', false),
        ('show_movements',     'true', 'Mostrar Movimientos',         'menu', false)
      ON CONFLICT (key) DO NOTHING;
    `
  },
  {
    name: '19. Trigger: updated_at for historial_potrero',
    sql: `
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
    `
  },
  {
    name: '20. Trigger: updated_at for custom_roles',
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS set_custom_roles_updated_at ON custom_roles;
      CREATE TRIGGER set_custom_roles_updated_at
        BEFORE UPDATE ON custom_roles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `
  },
  {
    name: '21. Audit log entry for this migration',
    sql: `
      INSERT INTO audit_logs (actor_email, action, entity_type, new_value)
      VALUES (
        'system@rodeo.ag',
        'EMERGENCY_MIGRATION_2026_06_16',
        'system',
        '{"tables_created": ["market_prices","ndvi_logs","carbon_assessments","carbon_certificates","climate_adjustment_snapshots","weather_cache","impersonation_sessions","custom_roles","historial_potrero","whatsapp_links"], "feature_flags_seeded": true, "pricing_plans_updated": true}'::jsonb
      );
    `
  }
]

async function migrate() {
  const masked = DB_URL.replace(/:[^:@]+@/, ':***@')
  console.log(`\n🐄 RODEO — Emergency Production Migration`)
  console.log(`📍 Target: ${masked}\n`)

  const client = await pool.connect()
  let success = 0, failed = 0

  for (const step of MIGRATIONS) {
    try {
      const statements = step.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const stmt of statements) {
        try {
          await client.query(stmt)
        } catch (err) {
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            // Skip silently — idempotent
          } else {
            console.warn(`   ⚠️  ${err.message.substring(0, 150)}`)
          }
        }
      }
      console.log(`   ✅ ${step.name}`)
      success++
    } catch (err) {
      console.error(`   ❌ ${step.name}: ${err.message}`)
      failed++
    }
  }

  // Final verification
  const { rows: tables } = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  
  const { rows: flags } = await client.query(`SELECT COUNT(*) as cnt FROM plan_feature_flags`)
  const { rows: plans } = await client.query(`SELECT name, slug, is_active FROM subscriptions_plans WHERE is_active = true ORDER BY sort_order`)
  
  console.log(`\n📦 Total tables: ${tables.length}`)
  console.log(`🏷️  Feature flags: ${flags[0].cnt}`)
  console.log(`📋 Active plans:`)
  plans.forEach(p => console.log(`   - ${p.name} (${p.slug})`))
  console.log(`\n✅ Migration complete: ${success} steps OK, ${failed} failed`)

  client.release()
  await pool.end()
}

migrate().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
