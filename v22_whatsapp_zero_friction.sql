-- ============================================================
-- v22: WhatsApp Zero-Friction Invitations
-- Agrega columna role a whatsapp_links para stagear el rol del
-- operario entre la creación de la invitación y su activación.
-- Al activar, el rol se copia a Profile.team_role.
-- ============================================================

-- 1. Columna role en whatsapp_links (valor por defecto: CAPATAZ)
ALTER TABLE whatsapp_links
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'CAPATAZ';

-- 2. Índice para búsqueda rápida por token de activación
CREATE INDEX IF NOT EXISTS idx_wa_links_activation_token
  ON whatsapp_links (activation_token)
  WHERE activation_token IS NOT NULL AND is_active = false;

-- 3. Índice para listar invitaciones pendientes por organización
CREATE INDEX IF NOT EXISTS idx_wa_links_org_pending
  ON whatsapp_links (org_id, is_active, created_at DESC);

-- Verificación
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'whatsapp_links'
  AND column_name IN ('role', 'activation_token', 'token_expires_at', 'is_active')
ORDER BY column_name;
