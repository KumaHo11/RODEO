/**
 * Script que crea la tabla team_invitations usando rodeo_service.
 * Uso: node --env-file=.env.local scripts/create_team_invitations.js
 */
const { Pool } = require('pg')

async function main() {
  const connStr = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
  if (!connStr) {
    console.error('❌ No se encontró DATABASE_URL_SERVICE ni DATABASE_URL')
    process.exit(1)
  }

  console.log('\n📦 Creando tabla team_invitations...')
  console.log(`   Conectando a: ${connStr.replace(/:[^@]+@/, ':***@')}`)

  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } })

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'OPERATOR',
        team_role TEXT DEFAULT 'CAPATAZ',
        permissions JSONB DEFAULT '{}',
        status TEXT DEFAULT 'PENDING',
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(org_id, email)
      )
    `)
    console.log('   ✅ Tabla creada/verificada')

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON team_invitations(org_id)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token)`)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_inv_org_status ON team_invitations(org_id, status)`)
    console.log('   ✅ Índices creados')

    console.log('\n🎉 ¡Listo!\n')
  } catch (err) {
    console.error('❌ Error:', err.message)
    if (err.message.includes('permission denied')) {
      console.log('\n💡 El usuario de la BD no tiene permisos de CREATE TABLE.')
      console.log('   Necesitás ejecutar esto con el usuario postgres o desde Cloud SQL Console.')
      console.log('   SQL a ejecutar:')
      console.log(`
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'OPERATOR',
  team_role TEXT DEFAULT 'CAPATAZ',
  permissions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'PENDING',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org_id ON team_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_inv_org_status ON team_invitations(org_id, status);
      `)
    }
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
