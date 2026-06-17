const { Pool } = require('pg')

// This connects to prod via the same Cloud SQL connection string used in the workflow
// We'll try to get it from env or use the one from the migration endpoint response
const DB_URL = process.argv[2]
if (!DB_URL) {
  console.error('Usage: node fix_timestamps.js "postgresql://..."')
  process.exit(1)
}

async function main() {
  const url = new URL(DB_URL.replace('postgresql://', 'http://'))
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split('?')[0],
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()
  
  const tables = ['paddocks','herds','farm_events','tasks','movements','field_notes',
    'grazing_plans','grazing_plan_entries','organizations','profiles',
    'invitations','notifications']
    
  for (const tbl of tables) {
    try {
      await client.query(`ALTER TABLE ${tbl} ALTER COLUMN updated_at SET DEFAULT NOW()`)
      console.log(`✅ updated_at fixed: ${tbl}`)
    } catch(e) { console.log(`⚠️  updated_at ${tbl}: ${e.message}`) }
    try {
      await client.query(`ALTER TABLE ${tbl} ALTER COLUMN created_at SET DEFAULT NOW()`)
      console.log(`✅ created_at fixed: ${tbl}`)
    } catch(e) { console.log(`⚠️  created_at ${tbl}: ${e.message}`) }
  }
  
  client.release()
  await pool.end()
}
main().catch(console.error)
