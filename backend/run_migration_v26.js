/**
 * run_migration_v26.js
 * Ejecuta v26_eudr_main.sql (tablas + vista + RLS) como rodeo_service.
 * La parte de ALTER TABLE paddocks se ejecuta separadamente via gcloud sql connect.
 */
const path = require('path')
const fs   = require('fs')
const { Client } = require('pg')

require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') })

async function main() {
  const dbUrl = process.env.DATABASE_URL_SERVICE

  if (!dbUrl) {
    console.error('❌ DATABASE_URL_SERVICE not set')
    process.exit(1)
  }

  console.log(`\n🚀 Ejecutando v26_eudr_main.sql en STAGING`)
  console.log(`   DB: ${dbUrl.replace(/:([^:@]+)@/, ':***@')}\n`)

  const sqlPath = path.join(__dirname, '..', 'v26_eudr_main.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    // Run in a transaction so partial failures roll back cleanly
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('✅ Migración v26 completada exitosamente.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Error en migración — ROLLBACK ejecutado.')
    console.error('   ', err.message)
    console.error('\n   Hint:', err.detail || err.hint || '')
    process.exit(1)
  } finally {
    await client.end()
  }
}

main().catch(e => {
  console.error('Error fatal:', e.message)
  process.exit(1)
})
