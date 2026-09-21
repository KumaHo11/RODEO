-- ============================================================
-- MIGRACIÓN: whatsapp_integration
-- Ejecutar como superusuario (postgres) desde tu cliente de DB
-- (TablePlus, DBeaver, pgAdmin, etc.)
-- ============================================================

-- 1. field_notes: limpiar columnas legacy y agregar las nuevas
ALTER TABLE field_notes
  DROP COLUMN IF EXISTS whatsapp_from,
  DROP COLUMN IF EXISTS raw_message;

ALTER TABLE field_notes
  ADD COLUMN IF NOT EXISTS audio_duration_secs INTEGER,
  ADD COLUMN IF NOT EXISTS occurred_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_phone       TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_msg_id      VARCHAR(100);

-- Índice único para deduplicación de mensajes (wamid)
CREATE UNIQUE INDEX IF NOT EXISTS idx_field_notes_wa_msg_id
  ON field_notes (whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;

-- Índice para la bandeja de revisión
CREATE INDEX IF NOT EXISTS idx_field_notes_pending
  ON field_notes (org_id, status, created_at DESC)
  WHERE source = 'WHATSAPP';

-- 2. whatsapp_links: agregar columnas de activación
ALTER TABLE whatsapp_links
  ADD COLUMN IF NOT EXISTS activation_token  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT false;

-- Los vínculos existentes (si los hay) se marcan como activos
UPDATE whatsapp_links SET is_active = true WHERE is_active = false;

-- 3. Recrear FK con ON DELETE CASCADE (alinear con Prisma)
ALTER TABLE whatsapp_links
  DROP CONSTRAINT IF EXISTS whatsapp_links_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS whatsapp_links_org_id_fkey;

ALTER TABLE whatsapp_links
  ADD CONSTRAINT whatsapp_links_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT whatsapp_links_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Verificación: mostrar las columnas nuevas en field_notes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'field_notes'
  AND column_name IN ('audio_duration_secs', 'occurred_at', 'whatsapp_phone', 'whatsapp_msg_id')
ORDER BY column_name;

-- 5. Verificación: mostrar las columnas nuevas en whatsapp_links
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_links'
  AND column_name IN ('activation_token', 'token_expires_at', 'is_active')
ORDER BY column_name;
