-- ============================================================
-- RODEO — Super Admin Migration v4
-- No-destructive: reutiliza subscriptions_plans existente
-- Ejecutar en Cloud SQL (PostgreSQL)
-- ============================================================

-- ── 1. Columna system_role en profiles (distingue Super Admin) ─────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS system_role TEXT
  CHECK (system_role IN ('SUPER_ADMIN', 'SUPPORT_AGENT')) DEFAULT NULL;

-- ── 2. Ampliar subscriptions_plans existente ──────────────────────────────
ALTER TABLE subscriptions_plans
  ADD COLUMN IF NOT EXISTS slug         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS price_yearly DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly  TEXT,
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id   TEXT,
  ADD COLUMN IF NOT EXISTS color        TEXT DEFAULT '#22C55E',
  ADD COLUMN IF NOT EXISTS is_popular   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- Asignar slugs a los planes existentes si los hay
UPDATE subscriptions_plans SET slug = LOWER(REPLACE(name, ' ', '_'))
  WHERE slug IS NULL;

-- Hacer slug NOT NULL después de poblar datos
-- ALTER TABLE subscriptions_plans ALTER COLUMN slug SET NOT NULL;

-- ── 3. Feature Flags por plan ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id     UUID NOT NULL REFERENCES subscriptions_plans(id) ON DELETE CASCADE,
  flag_key    TEXT NOT NULL,
  flag_value  JSONB NOT NULL,  -- boolean | number | string
  label       TEXT,            -- descripción legible para el admin
  flag_type   TEXT DEFAULT 'boolean' CHECK (flag_type IN ('boolean', 'number', 'string')),
  UNIQUE(plan_id, flag_key)
);

-- ── 4. Ampliar organizations para tracking de plan + suscripciones ────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS mp_subscription_id      TEXT,
  ADD COLUMN IF NOT EXISTS plan_status             TEXT DEFAULT 'active'
    CHECK (plan_status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  ADD COLUMN IF NOT EXISTS trial_ends_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at         TIMESTAMPTZ;

-- ── 5. Audit Logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_email  TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Impersonation Sessions ─────────────────────────────────────────────
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

-- ── 7. System Config (API Keys encriptadas en la app) ─────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  label      TEXT,
  category   TEXT DEFAULT 'general',
  is_secret  BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Indexes de performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_plan_flags_plan_id    ON plan_feature_flags(plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_system_role  ON profiles(system_role) WHERE system_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ── 9. Trigger: updated_at en subscriptions_plans ────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_subscription_plans_updated_at ON subscriptions_plans;
CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON subscriptions_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 10. Seed: Planes base + Feature Flags ─────────────────────────────────
-- Insertar planes si no existen
INSERT INTO subscriptions_plans (name, slug, price, price_yearly, description, color, is_popular, sort_order, paddocks_limit, herds_limit, has_ai_analysis)
VALUES
  ('Campo Libre',   'campo_libre',   0,     0,     'Para empezar a digitalizar tu campo',          '#6B7280', false, 1, 5,   1,  false),
  ('Pro Ganadero',  'pro_ganadero',  0.60,  0.50,  'Para ganaderos que quieren precisión total',   '#22C55E', true,  2, 50,  10, true),
  ('Pro Ganadero+', 'pro_ganadero+', 0.45,  0.38,  'Para operaciones que escalan rápido',          '#111827', false, 3, 999, 50, true)
ON CONFLICT (slug) DO NOTHING;

-- Feature flags por plan
INSERT INTO plan_feature_flags (plan_id, flag_key, flag_value, label, flag_type)
SELECT p.id, 'max_paddocks',       '5'::jsonb,     'Máximo de potreros',         'number' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'max_herds',          '1'::jsonb,     'Máximo de rodeos',            'number' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'ndvi_access',        'false'::jsonb, 'Acceso NDVI satelital',       'boolean' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'ai_insights',        'false'::jsonb, 'Insights IA',                 'boolean' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'offline_mode',       'false'::jsonb, 'Modo offline completo',       'boolean' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'voice_bitacora',     'false'::jsonb, 'Bitácora de voz',             'boolean' FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'max_team_members',   '1'::jsonb,     'Máximo de miembros de equipo','number'  FROM subscriptions_plans p WHERE p.slug='campo_libre'
UNION ALL
SELECT p.id, 'max_paddocks',       '50'::jsonb,    'Máximo de potreros',          'number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'max_herds',          '10'::jsonb,    'Máximo de rodeos',            'number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'ndvi_access',        'true'::jsonb,  'Acceso NDVI satelital',       'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'ai_insights',        'true'::jsonb,  'Insights IA',                 'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'offline_mode',       'true'::jsonb,  'Modo offline completo',       'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'voice_bitacora',     'true'::jsonb,  'Bitácora de voz',             'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'max_team_members',   '5'::jsonb,     'Máximo de miembros de equipo','number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero'
UNION ALL
SELECT p.id, 'max_paddocks',       '999'::jsonb,   'Máximo de potreros',          'number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'max_herds',          '50'::jsonb,    'Máximo de rodeos',            'number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'ndvi_access',        'true'::jsonb,  'Acceso NDVI satelital',       'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'ai_insights',        'true'::jsonb,  'Insights IA',                 'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'offline_mode',       'true'::jsonb,  'Modo offline completo',       'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'voice_bitacora',     'true'::jsonb,  'Bitácora de voz',             'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'max_team_members',   '20'::jsonb,    'Máximo de miembros de equipo','number'  FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'advanced_reports',   'true'::jsonb,  'Reportes avanzados',          'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
UNION ALL
SELECT p.id, 'api_access',         'true'::jsonb,  'Acceso API',                  'boolean' FROM subscriptions_plans p WHERE p.slug='pro_ganadero+'
ON CONFLICT (plan_id, flag_key) DO NOTHING;

-- ── 11. System Config defaults ────────────────────────────────────────────
INSERT INTO system_config (key, value, label, category, is_secret) VALUES
  ('stripe_publishable_key',    '', 'Stripe Publishable Key',         'payments', false),
  ('stripe_secret_key',         '', 'Stripe Secret Key',              'payments', true),
  ('stripe_webhook_secret',     '', 'Stripe Webhook Secret',          'payments', true),
  ('mp_public_key',             '', 'MercadoPago Public Key',         'payments', false),
  ('mp_access_token',           '', 'MercadoPago Access Token',       'payments', true),
  ('google_maps_api_key',       '', 'Google Maps API Key',            'integrations', true),
  ('openweather_api_key',       '', 'OpenWeather API Key',            'integrations', true),
  ('firebase_service_account',  '', 'Firebase Service Account JSON',  'auth', true)
ON CONFLICT (key) DO NOTHING;
