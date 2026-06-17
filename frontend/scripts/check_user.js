/**
 * Script temporal para verificar un usuario específico en la DB de producción
 * Usage: node scripts/check_user.js "$DATABASE_URL" "email@example.com"
 */
const { Pool } = require('pg')

const connectionString = process.argv[2]
const email = process.argv[3]

if (!connectionString || !email) {
  console.error('Usage: node scripts/check_user.js "$DATABASE_URL" "email"')
  process.exit(1)
}

async function main() {
  const url = new URL(connectionString.replace('postgresql://', 'http://'))
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT p.id, p.firebase_uid, p.email, p.first_name, p.last_name, 
              p.organization_id, p.onboarding_step, p.is_active, p.role,
              p.created_at
       FROM profiles p
       WHERE p.email = $1`,
      [email]
    )
    
    if (result.rows.length === 0) {
      console.log(`❌ NO PROFILE FOUND for ${email}`)
    } else {
      console.log(`✅ Profile found:`)
      console.log(JSON.stringify(result.rows[0], null, 2))
    }

    // Also check by firebase_uid if we can get it
    const orgResult = await client.query(
      `SELECT o.id, o.name, o.plan_status, o.created_at
       FROM organizations o
       JOIN profiles p ON p.organization_id = o.id
       WHERE p.email = $1`,
      [email]
    )
    if (orgResult.rows.length > 0) {
      console.log('\n✅ Organization:')
      console.log(JSON.stringify(orgResult.rows[0], null, 2))
    } else {
      console.log('\n❌ NO ORGANIZATION found')
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
