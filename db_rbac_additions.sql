-- ============================================================
-- RODEO — RBAC Additions Migration v2
-- Tabla custom_roles, is_first_login, mejoras en notifications
-- Ejecutar en Cloud SQL (PostgreSQL)
-- ============================================================

-- ── 1. Columna is_first_login en profiles ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true;

-- Para usuarios existentes (owners que ya hicieron onboarding), marcar como false
UPDATE profiles
SET is_first_login = false
WHERE is_first_login IS NULL OR (onboarding_step >= 4 AND team_role IS NULL);

-- ── 2. Tabla de roles custom ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,           -- key interno ej. 'ENCARGADO_CAMPO'
  label       TEXT        NOT NULL,           -- display ej. 'Encargado de campo'
  description TEXT,
  permissions JSONB       NOT NULL DEFAULT '{}',
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- ── 3. Mejoras en tabla notifications (trazabilidad) ─────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS entity_id   UUID,   -- ID del recurso involucrado (task_id, paddock_id, etc.)
  ADD COLUMN IF NOT EXISTS entity_type TEXT;   -- 'task' | 'paddock' | 'invitation' | 'field_note'

-- ── 4. Columnas faltantes en team_invitations ────────────────────────────────
-- Algunas columnas pueden no existir en instalaciones previas
ALTER TABLE team_invitations
  ADD COLUMN IF NOT EXISTS team_role   TEXT NOT NULL DEFAULT 'CAPATAZ',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invited_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 5. Índices de performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_custom_roles_org_id      ON custom_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_team_inv_org_status      ON team_invitations(org_id, status);

-- ── 6. Trigger: updated_at automático para custom_roles ──────────────────────
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
