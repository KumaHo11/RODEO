-- ============================================================
-- MIGRACIÓN: WhatsApp → Bitácora de Campo
-- ============================================================

-- 1. Extender field_notes con columnas de WhatsApp
ALTER TABLE field_notes
  ADD COLUMN IF NOT EXISTS source          VARCHAR(20)  NOT NULL DEFAULT 'APP',
  ADD COLUMN IF NOT EXISTS status          VARCHAR(30)  NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS whatsapp_phone  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS whatsapp_msg_id VARCHAR(100);

-- Índice de deduplicación (evita procesar el mismo mensaje dos veces)
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_notes_wa_msg_id
  ON field_notes (whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;

-- Índice para la bandeja de revisión
CREATE INDEX IF NOT EXISTS idx_field_notes_pending
  ON field_notes (org_id, status, created_at DESC)
  WHERE source = 'WHATSAPP';

-- 2. Tabla de vinculos: número de teléfono → perfil de la org
CREATE TABLE IF NOT EXISTS whatsapp_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       VARCHAR(30) NOT NULL UNIQUE,   -- E.164: +549...
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage whatsapp links" ON whatsapp_links
  FOR ALL USING (org_id = get_user_org_id());

-- 3. Función helper: lookup phone → {profile_id, org_id}
CREATE OR REPLACE FUNCTION get_profile_by_whatsapp(p_phone TEXT)
RETURNS TABLE(profile_id UUID, org_id UUID) AS $$
  SELECT profile_id, org_id FROM whatsapp_links WHERE phone = p_phone LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;
