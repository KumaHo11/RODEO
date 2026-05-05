#!/usr/bin/env node
/**
 * RODEO — Migration script: esquema a GCP Cloud SQL
 * Usa pg (node-postgres) directo
 */
const { Pool } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:Rodeo2026%21Secure%23@35.247.199.183:5432/rodeo'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
})

const schema = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Subscription Plans
CREATE TABLE IF NOT EXISTS subscriptions_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    price_ars DECIMAL(10, 2),
    price_usd DECIMAL(10, 2),
    paddocks_limit INT DEFAULT 5,
    herds_limit INT DEFAULT 1,
    has_ai_analysis BOOLEAN DEFAULT false,
    billing_period VARCHAR(20) DEFAULT 'monthly',
    stripe_price_id VARCHAR(255),
    mp_plan_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_area_ha DECIMAL(10, 2),
    boundaries GEOMETRY(POLYGON, 4326),
    location GEOMETRY(POINT, 4326),
    region_id VARCHAR(50),
    drought_plan_buffer INT DEFAULT 20,
    subscription_plan_id UUID REFERENCES subscriptions_plans(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles (firebase_uid para Firebase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')),
    is_active BOOLEAN DEFAULT true,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    onboarding_step INT DEFAULT 0,
    country_code VARCHAR(2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Paddocks
CREATE TABLE IF NOT EXISTS paddocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    area_ha DECIMAL(10, 2),
    geom GEOMETRY(POLYGON, 4326),
    is_grazable BOOLEAN DEFAULT true,
    current_status VARCHAR(50) CHECK (current_status IN ('RESTING', 'GRAZING')) DEFAULT 'RESTING',
    estimated_adh DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Herds
CREATE TABLE IF NOT EXISTS herds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    species VARCHAR(100) DEFAULT 'Bovine',
    breed VARCHAR(100),
    category VARCHAR(100),
    categoria VARCHAR(100),
    head_count INT NOT NULL DEFAULT 0,
    avg_weight_kg DECIMAL(10, 2),
    total_ev DECIMAL(10, 2),
    admission_date DATE,
    age_months INT,
    parent_herd_id UUID REFERENCES herds(id) ON DELETE SET NULL,
    herd_notes JSONB DEFAULT '[]',
    bcs_score INT,
    bcs_label VARCHAR(50),
    bcs_data JSONB,
    photo_url TEXT,
    age_years DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Grazing Plans
CREATE TABLE IF NOT EXISTS grazing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paddock_id UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    herd_id UUID REFERENCES herds(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    exit_date DATE,
    planned_recovery_days INT,
    status VARCHAR(50) CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')) DEFAULT 'PLANNED',
    actual_adh_consumed DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Biological Monitoring
CREATE TABLE IF NOT EXISTS biological_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paddock_id UUID REFERENCES paddocks(id) ON DELETE CASCADE,
    observer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    photo_url TEXT,
    audio_url TEXT,
    ground_cover_pct DECIMAL(5, 2),
    grass_height_cm DECIMAL(10, 2),
    dry_matter_estimate_kg DECIMAL(10, 2),
    ai_analysis JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Rainfall Logs
CREATE TABLE IF NOT EXISTS rainfall_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    recorder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    mm_count DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_customer_id VARCHAR(255),
    provider_sub_id VARCHAR(255),
    provider_payment_id VARCHAR(255),
    plan_id UUID REFERENCES subscriptions_plans(id),
    status VARCHAR(50) DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    next_billing_date TIMESTAMPTZ,
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_paddocks_org ON paddocks(org_id);
CREATE INDEX IF NOT EXISTS idx_herds_org ON herds(org_id);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_paddock ON grazing_plans(paddock_id);
CREATE INDEX IF NOT EXISTS idx_grazing_plans_herd ON grazing_plans(herd_id);
CREATE INDEX IF NOT EXISTS idx_profiles_firebase ON profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_bio_monitoring_paddock ON biological_monitoring(paddock_id);
CREATE INDEX IF NOT EXISTS idx_rainfall_org ON rainfall_logs(org_id);

-- Additive migrations (safe on existing DBs — all columns are nullable)
ALTER TABLE herds ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE herds ADD COLUMN IF NOT EXISTS admission_date DATE;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS age_months INT;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS parent_herd_id UUID REFERENCES herds(id) ON DELETE SET NULL;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS herd_notes JSONB DEFAULT '[]';
ALTER TABLE herds ADD COLUMN IF NOT EXISTS bcs_score INT;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS bcs_label VARCHAR(50);
ALTER TABLE herds ADD COLUMN IF NOT EXISTS bcs_data JSONB;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE herds ADD COLUMN IF NOT EXISTS age_years DECIMAL(5,2);
ALTER TABLE herds ADD COLUMN IF NOT EXISTS exit_date DATE;

-- farm_events: assigned_to for team member tasks
ALTER TABLE farm_events ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Default subscription plans
INSERT INTO subscriptions_plans (name, price, price_ars, price_usd, paddocks_limit, herds_limit, has_ai_analysis, billing_period)
VALUES 
  ('Free', 0, 0, 0, 3, 1, false, 'monthly'),
  ('Starter', 29, 29000, 29, 10, 3, false, 'monthly'),
  ('Pro', 79, 79000, 79, 50, 10, true, 'monthly'),
  ('Enterprise', 199, 199000, 199, 999, 99, true, 'monthly')
ON CONFLICT DO NOTHING;
`

async function migrate() {
  console.log('🐄 RODEO — Cloud SQL Migration')
  console.log('📍 Conectando a:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'))
  
  try {
    const client = await pool.connect()
    console.log('✅ Conexión exitosa a Cloud SQL PostgreSQL')
    
    // Verificar PostGIS
    try {
      await client.query("SELECT PostGIS_Version()")
      console.log('✅ PostGIS disponible')
    } catch {
      console.log('⚠️  PostGIS no disponible, continuando sin geometrías...')
    }
    
    console.log('📋 Aplicando schema...')
    
    // Ejecutar en statements separados
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    let ok = 0, skipped = 0
    for (const stmt of statements) {
      if (!stmt) continue
      try {
        await client.query(stmt)
        ok++
      } catch (err) {
        if (err.message.includes('already exists')) {
          skipped++
        } else {
          console.warn('  ⚠️ ', err.message.substring(0, 120))
        }
      }
    }
    
    console.log(`✅ Schema aplicado: ${ok} statements OK, ${skipped} ya existían`)
    
    // Verificar tablas
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    console.log('📦 Tablas en Cloud SQL:', rows.map(r => r.table_name).join(', '))
    
    client.release()
    console.log('\n🎉 Migración completada!')
    
  } catch (err) {
    console.error('❌ Error de conexión:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
