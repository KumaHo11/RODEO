/**
 * run-v22-wa-migration.js
 * Aplica la migración v22 (WhatsApp zero-friction) a la DB local.
 * USO: Con el proxy/túnel activo → node run-v22-wa-migration.js
 *
 * Nota: Si falla con "must be owner of table", ejecutar con el usuario
 * administrador de la DB (ej. via TablePlus, pgAdmin o psql como postgres).
 * El SQL está en: /Users/javi/RODEO/v22_whatsapp_zero_friction.sql
 */
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ Necesitás DATABASE_URL_SERVICE o DATABASE_URL en .env.local')
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

const sql = `
-- v22: WhatsApp Zero-Friction Invitations
ALTER TABLE whatsapp_links
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'CAPATAZ';

ALTER TABLE whatsapp_links
  ALTER COLUMN activation_token TYPE VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_wa_links_activation_token
  ON whatsapp_links (activation_token)
  WHERE activation_token IS NOT NULL AND is_active = false;

CREATE INDEX IF NOT EXISTS idx_wa_links_org_pending
  ON whatsapp_links (org_id, is_active);
`

pool.query(sql)
  .then(() => {
    console.log('✅ Migración v22 aplicada correctamente')
    console.log('   - Columna `role` agregada a whatsapp_links')
    console.log('   - activation_token expandido a VARCHAR(64)')
    console.log('   - Índices de búsqueda creados')
  })
  .catch(err => {
    console.error('❌ Error en migración v22:', err.message)
    if (err.message.includes('must be owner')) {
      console.error('   → Ejecutar el SQL manualmente en TablePlus/pgAdmin como superusuario')
      console.error('   → Archivo: /Users/javi/RODEO/v22_whatsapp_zero_friction.sql')
    }
  })
  .finally(() => pool.end())
