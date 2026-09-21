#!/usr/bin/env node
/**
 * Aplica la migración whatsapp_integration directamente usando pg
 * (sin requerir psql instalado localmente).
 * 
 * Uso: node scripts/apply_whatsapp_migration.js
 */
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const url = new URL(
  (process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL)
    .replace('postgresql://', 'http://')
)
const socketHost = url.searchParams.get('host')

const pool = new Pool({
  host:     socketHost || url.hostname,
  port:     parseInt(url.port || '5432'),
  user:     url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1).split('?')[0],
  ssl:      false,
})

const SQL = `
-- 1. Extender field_notes
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

-- 2. Extender whatsapp_links con columnas de activación
ALTER TABLE whatsapp_links
  ADD COLUMN IF NOT EXISTS activation_token  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT false;

-- Los vínculos existentes se marcan como activos para no romper el flujo actual
UPDATE whatsapp_links SET is_active = true WHERE is_active = false;

-- 3. Recrear FK con CASCADE (alinear con el schema de Prisma)
ALTER TABLE whatsapp_links
  DROP CONSTRAINT IF EXISTS whatsapp_links_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS whatsapp_links_org_id_fkey;

ALTER TABLE whatsapp_links
  ADD CONSTRAINT whatsapp_links_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT whatsapp_links_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
`

async function run() {
  console.log('🔌 Conectando a la base de datos...')
  const client = await pool.connect()
  try {
    console.log('🚀 Aplicando migración whatsapp_integration...')
    // Ejecutar sentencias una por una para mejor reporte de errores
    const statements = SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const stmt of statements) {
      try {
        await client.query(stmt)
        console.log(`  ✅ ${stmt.substring(0, 60).replace(/\n/g, ' ')}...`)
      } catch (e) {
        console.error(`  ❌ Error en: ${stmt.substring(0, 80)}`)
        console.error(`     ${e.message}`)
      }
    }
    console.log('\n✅ Migración completada.')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => {
  console.error('Error fatal:', e)
  process.exit(1)
})
