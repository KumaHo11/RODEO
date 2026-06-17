#!/usr/bin/env node
/**
 * RODEO — Full Schema Bootstrap (for empty databases)
 * Creates ALL tables in correct FK dependency order.
 * 100% idempotent.
 * Usage: DATABASE_URL=... node full_schema_bootstrap.js
 */
const { Pool } = require('pg')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('❌ DATABASE_URL required'); process.exit(1) }

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
})

// Each step is a single query string (no splitting)
const STEPS = [
  {
    name: '1. Extensions',
    sql: `CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  },
  {
    name: '2. subscriptions_plans',
    sql: `CREATE TABLE IF NOT EXISTS subscriptions_plans (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            TEXT        NOT NULL,
      slug            TEXT        UNIQUE,
      price           DECIMAL(10,2) NOT NULL DEFAULT 0,
      price_yearly    DECIMAL(10,2),
      description     TEXT,
      color           TEXT,
      is_popular      BOOLEAN     DEFAULT false,
      sort_order      INTEGER     DEFAULT 0,
      paddocks_limit  INTEGER     DEFAULT 5,
      herds_limit     INTEGER     DEFAULT 1,
      has_ai_analysis BOOLEAN     DEFAULT false,
      trial_days      INTEGER     DEFAULT 0,
      is_active       BOOLEAN     DEFAULT true,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '3. organizations',
    sql: `CREATE TABLE IF NOT EXISTS organizations (
      id                            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      name                          TEXT        NOT NULL,
      slug                          TEXT        UNIQUE,
      plan_id                       UUID        REFERENCES subscriptions_plans(id) ON DELETE SET NULL,
      plan_status                   TEXT        DEFAULT 'ACTIVE',
      trial_ends_at                 TIMESTAMPTZ,
      stripe_customer_id            TEXT,
      field_name                    TEXT,
      total_hectares                DECIMAL(10,2),
      country                       TEXT        DEFAULT 'AR',
      region                        TEXT,
      lat                           DOUBLE PRECISION,
      lng                           DOUBLE PRECISION,
      address                       TEXT,
      location_label                TEXT,
      total_area                    DECIMAL(10,2),
      region_id                     UUID,
      default_daily_allocation_kg   DECIMAL(10,2) DEFAULT 25.00,
      default_target_remnant_kg_ha  DECIMAL(10,2) DEFAULT 1500.00,
      technical_data                JSONB       DEFAULT '{}',
      photo_url                     TEXT,
      location                      GEOMETRY(Point, 4326),
      boundaries                    GEOMETRY(MultiPolygon, 4326),
      created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '4. profiles',
    sql: `CREATE TABLE IF NOT EXISTS profiles (
      id                         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      firebase_uid               TEXT        UNIQUE NOT NULL,
      email                      TEXT        NOT NULL,
      name                       TEXT,
      first_name                 TEXT,
      last_name                  TEXT,
      avatar_url                 TEXT,
      phone                      TEXT,
      country                    TEXT,
      country_code               TEXT,
      role                       TEXT        DEFAULT 'OWNER',
      team_role                  TEXT,
      system_role                TEXT,
      org_id                     UUID        REFERENCES organizations(id) ON DELETE SET NULL,
      onboarding_step            INTEGER     DEFAULT 0,
      completed_tours            JSONB       DEFAULT '{}',
      is_first_login             BOOLEAN     DEFAULT true,
      is_active                  BOOLEAN     DEFAULT true,
      permissions                JSONB,
      notification_preferences   JSONB,
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '5. paddocks',
    sql: `CREATE TABLE IF NOT EXISTS paddocks (
      id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id                      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name                        TEXT        NOT NULL,
      area_hectares               DECIMAL(10,2),
      is_active                   BOOLEAN     DEFAULT true,
      current_ndvi                NUMERIC(6,4),
      dry_matter_kg_ha            NUMERIC(10,2),
      previous_dry_matter_kg_ha   NUMERIC(10,2),
      previous_ndvi_date          DATE,
      coordinates                 JSONB,
      technical_data              JSONB       DEFAULT '{}',
      version                     INTEGER     DEFAULT 1,
      location                    GEOMETRY(Point, 4326),
      geom                        GEOMETRY(MultiPolygon, 4326),
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '6. herds',
    sql: `CREATE TABLE IF NOT EXISTS herds (
      id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id                  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name                    TEXT        NOT NULL,
      breed                   TEXT,
      head_count              INTEGER     DEFAULT 0,
      average_weight_kg       DECIMAL(10,2),
      daily_consumption_kg    DECIMAL(10,2),
      paddock_id              UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      physiological_category  TEXT,
      age_years               INTEGER,
      age_months              INTEGER,
      admission_date          DATE,
      bcs_score               NUMERIC(3,1),
      bcs_label               TEXT,
      bcs_data                JSONB,
      photo_url               TEXT,
      parent_herd_id          UUID        REFERENCES herds(id) ON DELETE SET NULL,
      herd_notes              TEXT,
      exit_date               DATE,
      lactancia_range         TEXT,
      estadio_gestacion       TEXT,
      custom_racion_kg        NUMERIC(8,2),
      grupo_manejo_id         UUID,
      grupo_manejo_nombre     TEXT,
      categoria               TEXT,
      version                 INTEGER     DEFAULT 1,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '7. grazing_plans',
    sql: `CREATE TABLE IF NOT EXISTS grazing_plans (
      id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id                UUID        REFERENCES organizations(id) ON DELETE CASCADE,
      paddock_id            UUID        NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
      herd_id               UUID        REFERENCES herds(id) ON DELETE SET NULL,
      herd_ids              JSONB,
      entry_date            DATE        NOT NULL,
      exit_date             DATE        NOT NULL,
      status                TEXT        DEFAULT 'PLANNED',
      notes                 TEXT,
      is_locked             BOOLEAN     DEFAULT false,
      closing_stock         JSONB,
      adjusted_entry_date   DATE,
      adjusted_exit_date    DATE,
      plan_type             TEXT        DEFAULT 'manual',
      source_origin         TEXT        DEFAULT 'human',
      cycle_id              UUID,
      season_plan_id        UUID,
      target_remnant        DECIMAL(10,2),
      grace_days            INT,
      version               INTEGER     DEFAULT 1,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '8. biological_monitoring',
    sql: `CREATE TABLE IF NOT EXISTS biological_monitoring (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      paddock_id      UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      monitoring_date DATE        NOT NULL,
      grass_height_cm DECIMAL(6,2),
      ground_cover_pct DECIMAL(5,2),
      biodiversity_index DECIMAL(5,2),
      notes           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '9. rainfall_logs',
    sql: `CREATE TABLE IF NOT EXISTS rainfall_logs (
      id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      paddock_id  UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      date        DATE        NOT NULL,
      mm          DECIMAL(8,2) NOT NULL,
      source      TEXT        DEFAULT 'MANUAL',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '10. payments',
    sql: `CREATE TABLE IF NOT EXISTS payments (
      id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      plan_id             UUID        REFERENCES subscriptions_plans(id),
      amount              DECIMAL(12,2) NOT NULL,
      currency            TEXT        DEFAULT 'ARS',
      status              TEXT        DEFAULT 'PENDING',
      payment_method      TEXT,
      external_id         TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '11. farm_events',
    sql: `CREATE TABLE IF NOT EXISTS farm_events (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title           TEXT        NOT NULL,
      description     TEXT,
      event_date      DATE        NOT NULL,
      end_date        DATE,
      event_type      TEXT        NOT NULL DEFAULT 'GENERAL',
      category        TEXT,
      all_day         BOOLEAN     DEFAULT true,
      recurrence      TEXT,
      notes           TEXT,
      metadata        JSONB,
      photo_url       TEXT,
      audio_url       TEXT,
      assigned_to     UUID,
      source          TEXT        DEFAULT 'APP',
      idempotency_key TEXT,
      version         INTEGER     DEFAULT 1,
      created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '12. tasks',
    sql: `CREATE TABLE IF NOT EXISTS tasks (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title           TEXT        NOT NULL,
      description     TEXT,
      status          TEXT        DEFAULT 'PENDING',
      due_date        DATE,
      assigned_to     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      task_type       TEXT        DEFAULT 'GENERAL',
      paddock_id      UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      priority        TEXT        DEFAULT 'MEDIA',
      version         INTEGER     DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '13. field_notes',
    sql: `CREATE TABLE IF NOT EXISTS field_notes (
      id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      paddock_id       UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      tags             TEXT[],
      category         TEXT,
      title            TEXT,
      content          TEXT,
      lat              DOUBLE PRECISION,
      lng              DOUBLE PRECISION,
      photo_url        TEXT,
      photo_urls       TEXT[],
      audio_url        TEXT,
      analysis_result  JSONB,
      source           TEXT        NOT NULL DEFAULT 'APP',
      status           TEXT        NOT NULL DEFAULT 'APPROVED',
      whatsapp_from    TEXT,
      raw_message      TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '14. notifications',
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id       UUID        REFERENCES organizations(id) ON DELETE CASCADE,
      profile_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE,
      user_id      UUID        REFERENCES profiles(id) ON DELETE CASCADE,
      type         TEXT        NOT NULL DEFAULT 'INFO',
      title        TEXT        NOT NULL,
      message      TEXT,
      body         TEXT,
      data         JSONB,
      entity_type  TEXT,
      entity_id    UUID,
      is_read      BOOLEAN     NOT NULL DEFAULT false,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '15. invitations',
    sql: `CREATE TABLE IF NOT EXISTS invitations (
      id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invited_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      email            TEXT        NOT NULL,
      role             TEXT        NOT NULL DEFAULT 'MEMBER',
      team_role        TEXT,
      permissions      JSONB,
      status           TEXT        NOT NULL DEFAULT 'PENDING',
      token            TEXT        UNIQUE,
      expires_at       TIMESTAMPTZ,
      accepted_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '16. grazing_plan_entries',
    sql: `CREATE TABLE IF NOT EXISTS grazing_plan_entries (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      plan_id         UUID        NOT NULL REFERENCES grazing_plans(id) ON DELETE CASCADE,
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entry_date      DATE,
      exit_date       DATE,
      herd_id         UUID        REFERENCES herds(id) ON DELETE SET NULL,
      herd_ids        JSONB,
      notes           TEXT,
      status          TEXT        NOT NULL DEFAULT 'PLANNED',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '17. weather_events + weather_event_paddocks',
    sql: `CREATE TABLE IF NOT EXISTS weather_events (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      event_type      TEXT        NOT NULL,
      severity        TEXT        DEFAULT 'MODERATE',
      started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at        TIMESTAMPTZ,
      data            JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS weather_event_paddocks (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      event_id        UUID        NOT NULL REFERENCES weather_events(id) ON DELETE CASCADE,
      paddock_id      UUID        NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
      impact_data     JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '18. movements',
    sql: `CREATE TABLE IF NOT EXISTS movements (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      herd_id         UUID        REFERENCES herds(id) ON DELETE SET NULL,
      from_paddock_id UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      to_paddock_id   UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      moved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      head_count      INTEGER,
      notes           TEXT,
      created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '19. climate_projections',
    sql: `CREATE TABLE IF NOT EXISTS climate_projections (
      id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      paddock_id      UUID        REFERENCES paddocks(id) ON DELETE SET NULL,
      projection_date DATE        NOT NULL,
      temperature_c   NUMERIC(5,1),
      rainfall_mm     NUMERIC(8,2),
      humidity_pct    NUMERIC(5,1),
      forecast_data   JSONB,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  },
  {
    name: '20. terms_and_conditions',
    sql: `CREATE TABLE IF NOT EXISTS terms_and_conditions_versions (
      id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      version     TEXT        NOT NULL UNIQUE,
      title       TEXT        NOT NULL DEFAULT 'Términos y Condiciones',
      content     TEXT        NOT NULL,
      is_current  BOOLEAN     NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_terms_acceptances (
      id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
      profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      version_id  UUID        NOT NULL REFERENCES terms_and_conditions_versions(id),
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address  TEXT,
      user_agent  TEXT,
      UNIQUE(profile_id, version_id)
    );`
  },
]

async function run() {
  const client = await pool.connect()
  const masked = DB_URL.replace(/:[^:@]+@/, ':***@')
  console.log(`\n🐄 RODEO — Full Schema Bootstrap`)
  console.log(`📍 Target: ${masked}\n`)

  let ok = 0, fail = 0
  for (const step of STEPS) {
    try {
      await client.query(step.sql)
      console.log(`   ✅ ${step.name}`)
      ok++
    } catch (err) {
      console.log(`   ❌ ${step.name}: ${err.message.substring(0, 120)}`)
      fail++
    }
  }

  // Verify
  const { rows } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)
  console.log(`\n📦 Tables created: ${rows.length}`)
  rows.forEach(r => console.log(`   ✅ ${r.table_name}`))
  console.log(`\n✅ Bootstrap: ${ok} OK, ${fail} failed\n`)

  client.release()
  await pool.end()
}

run().catch(e => { console.error('❌', e.message); process.exit(1) })
