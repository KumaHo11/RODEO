#!/usr/bin/env node
/**
 * run_v19_team_invitations.js
 * ============================
 * Crea la tabla team_invitations si no existe.
 * Requiere un usuario con permisos CREATE TABLE (postgres o MIGRATION_DATABASE_URL).
 *
 * Uso:
 *   node scripts/run_v19_team_invitations.js "postgresql://postgres:pass@host:5432/rodeo"
 *   node scripts/run_v19_team_invitations.js "$MIGRATION_DATABASE_URL"
 *
 * O con variable de entorno:
 *   MIGRATION_DATABASE_URL="..." node scripts/run_v19_team_invitations.js
 */
const { Client } = require('pg')

const DB_URL = process.argv[2] || process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ Proveer URL de base de datos como argumento o MIGRATION_DATABASE_URL')
  process.exit(1)
}

const SQL = `
-- v19: team_invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        DEFAULT 'OPERATOR',
  team_role   TEXT        DEFAULT 'CAPATAZ',
  permissions JSONB       DEFAULT '{}',
  status      TEXT        DEFAULT 'PENDING',
  token       TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMP WITH TIME ZONE,
  invited_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  first_name  TEXT,
  last_name   TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id    ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email     ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token     ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_inv_org_status        ON team_invitations(org_id, status);
`

async function main() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })

  const label = DB_URL.includes('35.247') ? 'STAGING' : DB_URL.includes('34.95') ? 'PROD' : 'DB'
  console.log(`🐄 RODEO — v19 team_invitations migration`)
  console.log(`🔗 Conectando a ${label}: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`)

  await client.connect()
  console.log('✅ Conexión OK\n')

  try {
    await client.query(SQL)
    console.log('✅ Tabla team_invitations creada/verificada')
    console.log('✅ Índices creados')

    // Verify
    const r = await client.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='team_invitations'
      ) as exists`
    )
    if (r.rows[0].exists) {
      console.log('\n🎉 Migración v19 completada exitosamente.')
    } else {
      console.error('\n❌ La tabla no existe después de crear — revisar permisos.')
      process.exit(1)
    }
  } catch (err) {
    console.error('❌ Error:', err.message)
    if (err.message.includes('permission denied')) {
      console.log('\n💡 Permiso denegado. Necesitás ejecutar con el usuario postgres o MIGRATION_DATABASE_URL.')
      console.log('   Alternativa: ejecutar el SQL directamente en Cloud SQL Console:')
      console.log(SQL)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
