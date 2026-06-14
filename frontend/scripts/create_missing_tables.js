/**
 * create_missing_tables.js
 * Crea las tablas que faltan en producción y staging.
 * Uso: DB_URL=postgresql://... node create_missing_tables.js
 */
const { Client } = require('pg')

const DB_URL = process.argv[2] || process.env.DB_URL
if (!DB_URL) {
  console.error('Uso: node create_missing_tables.js <DATABASE_URL>')
  process.exit(1)
}

const SQL = `
-- ──────────────────────────────────────────────────────────────────────────────
-- system_config: Configuraciones del sistema (menu, integraciones, etc.)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT        NOT NULL PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  label       TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT 'general',
  is_secret   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed valores base del menú (si no existen)
INSERT INTO system_config (key, value, label, category) VALUES
  ('show_herds',         'true',  'Mostrar Rodeos',         'menu'),
  ('show_paddocks',      'true',  'Mostrar Potreros',       'menu'),
  ('show_grazing_plans', 'true',  'Mostrar Planes de Pastoreo', 'menu'),
  ('show_field_notes',   'true',  'Mostrar Notas de Campo', 'menu'),
  ('show_tasks',         'true',  'Mostrar Tareas',         'menu'),
  ('show_farm_events',   'true',  'Mostrar Eventos',        'menu'),
  ('show_rainfall',      'true',  'Mostrar Lluvia',         'menu'),
  ('show_climate',       'true',  'Mostrar Clima',          'menu'),
  ('show_planning',      'true',  'Mostrar Planificación',  'menu'),
  ('show_movements',     'true',  'Mostrar Movimientos',    'menu')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- audit_logs: Registro de acciones administrativas
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id     UUID,
  actor_email  TEXT,
  action       TEXT        NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx  ON audit_logs(created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- field_notes: Notas de campo (texto, audio, foto, WhatsApp)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_notes (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  source           TEXT        NOT NULL DEFAULT 'APP',   -- 'APP' | 'WHATSAPP'
  status           TEXT        NOT NULL DEFAULT 'APPROVED', -- 'PENDING_REVIEW' | 'APPROVED'
  whatsapp_from    TEXT,
  raw_message      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS field_notes_org_id_idx     ON field_notes(org_id);
CREATE INDEX IF NOT EXISTS field_notes_paddock_id_idx ON field_notes(paddock_id);
CREATE INDEX IF NOT EXISTS field_notes_created_by_idx ON field_notes(created_by);

-- ──────────────────────────────────────────────────────────────────────────────
-- grazing_plan_entries: Entradas/asistentes dentro de un plan de pastoreo
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grazing_plan_entries (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
);

CREATE INDEX IF NOT EXISTS grazing_plan_entries_plan_id_idx ON grazing_plan_entries(plan_id);
CREATE INDEX IF NOT EXISTS grazing_plan_entries_org_id_idx  ON grazing_plan_entries(org_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- notifications: Notificaciones in-app para usuarios
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
);

CREATE INDEX IF NOT EXISTS notifications_profile_id_idx ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_org_id_idx     ON notifications(org_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx    ON notifications(is_read);

-- ──────────────────────────────────────────────────────────────────────────────
-- invitations: Invitaciones de equipo a organizaciones
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  email            TEXT        NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'MEMBER',
  team_role        TEXT,
  permissions      JSONB,
  status           TEXT        NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  token            TEXT        UNIQUE,
  expires_at       TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON invitations(org_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx  ON invitations(email);
CREATE INDEX IF NOT EXISTS invitations_token_idx  ON invitations(token);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations(status);
`

async function run() {
  const client = new Client(DB_URL)
  await client.connect()
  console.log('✅ Conectado a la DB:', DB_URL.replace(/:[^:@]+@/, ':***@'))

  try {
    await client.query('BEGIN')
    await client.query(SQL)
    await client.query('COMMIT')
    console.log('✅ Todas las tablas creadas correctamente')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error durante la migración:', err.message)
    throw err
  } finally {
    await client.end()
  }
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
