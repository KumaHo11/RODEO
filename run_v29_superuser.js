/**
 * run_v29_superuser.js — Aplica la migración v29 con el superusuario postgres
 *
 * Uso: PGPASSWORD=<contraseña-postgres-GCP> node run_v29_superuser.js
 *
 * La contraseña del usuario 'postgres' de Cloud SQL se obtiene desde:
 * GCP Console → SQL → rodeo-db-preprod → Users → postgres
 */
const { Client } = require('pg');
const fs = require('fs');

const POSTGRES_PASS = process.env.PGPASSWORD;
if (!POSTGRES_PASS) {
  console.error('❌ Falta PGPASSWORD. Usá: PGPASSWORD=<pass> node run_v29_superuser.js');
  process.exit(1);
}

const connString = `postgresql://postgres:${POSTGRES_PASS}@127.0.0.1:5432/rodeo`;
const client = new Client({ connectionString: connString, connectionTimeoutMillis: 10000 });

const SQL = `
SET search_path TO public;

-- sender_name: ya puede existir de v28 (idempotente)
ALTER TABLE public.field_notes
  ADD COLUMN IF NOT EXISTS sender_name TEXT;

COMMENT ON COLUMN public.field_notes.sender_name IS
  'WhatsApp display name of the sender. Set by the webhook on ingest.';

-- GIN index sobre photo_urls para queries de álbumes
CREATE INDEX IF NOT EXISTS idx_field_notes_photo_urls_gin
  ON public.field_notes USING GIN (photo_urls)
  WHERE photo_urls IS NOT NULL AND photo_urls != '{}';

-- Índice compuesto para feed de WA
CREATE INDEX IF NOT EXISTS idx_field_notes_wa_feed
  ON public.field_notes (org_id, source, created_at DESC)
  WHERE source = 'WHATSAPP';
`;

async function run() {
  console.log('🔌 Conectando como postgres ...');
  await client.connect();
  const { current_user } = (await client.query('SELECT current_user')).rows[0];
  console.log('✅ Conectado como:', current_user);

  const stmts = SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    process.stdout.write('  ► ' + stmt.slice(0, 70).replace(/\s+/g, ' ') + ' ... ');
    await client.query(stmt);
    console.log('✓');
  }

  console.log('\n✅ Migración v29_wa_album_batching aplicada exitosamente');
  await client.end();
}

run().catch(async e => {
  console.error('\n❌ Error:', e.message);
  await client.end().catch(() => {});
  process.exit(1);
});
