-- ============================================================
-- v23: WhatsApp activation_token — VarChar(64) → Text
-- El token hex de 64 chars entraba justo al límite de VarChar(64).
-- Cambiamos a TEXT para eliminar cualquier riesgo de truncamiento.
-- Compatible con Prisma schema.prisma (activationToken @db.Text)
-- ============================================================

ALTER TABLE whatsapp_links
  ALTER COLUMN activation_token TYPE TEXT;

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'whatsapp_links'
  AND column_name = 'activation_token';
