/**
 * migrate_v26_via_proxy.js
 *
 * Ejecuta la migración EUDR v26 completa en STAGING
 * usando el Cloud SQL Auth Proxy que ya corre en localhost:5432.
 *
 * Pasos en orden:
 *   1. v26_paddocks_eudr_columns.sql  → user: rodeo_service (con IF NOT EXISTS es idempotente)
 *   2. v26_eudr_main.sql              → user: rodeo_service
 *
 * ⚠️  SOLO staging — el proxy que corre en :5432 apunta a rodeo-db-preprod
 *
 * USO: node migrate_v26_via_proxy.js
 */
const path = require('path')
const fs   = require('fs')
const { Client } = require('pg')

require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') })

const ROOT = path.join(__dirname, '..')
const SQL_STEP1 = path.join(ROOT, 'v26_paddocks_eudr_columns.sql')
const SQL_STEP2 = path.join(ROOT, 'v26_eudr_main.sql')

// El proxy local conecta a staging (rodeo-db-preprod)
// DATABASE_URL_SERVICE = postgresql://rodeo_service:...@localhost:5432/rodeo
const DB_URL = process.env.DATABASE_URL_SERVICE

async function runSQL(client, sqlPath, label) {
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(`\n📄 Ejecutando: ${path.basename(sqlPath)} (${label})`)
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`✅ ${label} — COMPLETADO`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(`❌ ${label} — ERROR (ROLLBACK ejecutado)`)
    console.error('   Mensaje:', err.message)
    if (err.detail)   console.error('   Detail:', err.detail)
    if (err.hint)     console.error('   Hint:',   err.hint)
    throw err
  }
}

async function checkExisting(client) {
  // Chequear cuáles tablas/columnas EUDR ya existen
  const res = await client.query(`
    SELECT 
      (SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_name = 'eudr_documents' AND table_schema = 'public') AS has_eudr_documents,
      (SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_name = 'feed_batches' AND table_schema = 'public') AS has_feed_batches,
      (SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_name = 'eudr_dds_submissions' AND table_schema = 'public') AS has_eudr_dds,
      (SELECT COUNT(*) FROM information_schema.columns 
       WHERE table_name = 'paddocks' AND column_name = 'eudr_area_ha') AS has_eudr_area_ha,
      (SELECT COUNT(*) FROM information_schema.views 
       WHERE table_name = 'animal_custody_timeline') AS has_timeline_view
  `)
  return res.rows[0]
}

async function main() {
  if (!DB_URL) {
    console.error('❌ DATABASE_URL_SERVICE no está en .env.local')
    process.exit(1)
  }

  console.log('\n══════════════════════════════════════════════════════')
  console.log('🐄 RODEO — Migración EUDR v26 → STAGING (via proxy local)')
  console.log(`   DB: ${DB_URL.replace(/:([^:@]+)@/, ':***@')}`)
  console.log('   ⚠️  SOLO staging — proxy apunta a rodeo-db-preprod')
  console.log('══════════════════════════════════════════════════════\n')

  // Verificar archivos SQL
  for (const f of [SQL_STEP1, SQL_STEP2]) {
    if (!fs.existsSync(f)) {
      console.error(`❌ No encontrado: ${f}`)
      process.exit(1)
    }
  }

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('✅ Conectado a staging via Cloud SQL Proxy (localhost:5432)\n')

  // Diagnóstico previo
  console.log('🔍 Estado actual de la base de datos (ANTES de migrar):')
  const before = await checkExisting(client)
  console.log(`   eudr_documents tabla:      ${before.has_eudr_documents > 0 ? '✅ existe' : '❌ NO existe'}`)
  console.log(`   feed_batches tabla:        ${before.has_feed_batches > 0 ? '✅ existe' : '❌ NO existe'}`)
  console.log(`   eudr_dds_submissions:      ${before.has_eudr_dds > 0 ? '✅ existe' : '❌ NO existe'}`)
  console.log(`   paddocks.eudr_area_ha:     ${before.has_eudr_area_ha > 0 ? '✅ existe' : '❌ NO existe'}`)
  console.log(`   animal_custody_timeline:   ${before.has_timeline_view > 0 ? '✅ existe' : '❌ NO existe'}`)

  const allExist = Object.values(before).every(v => parseInt(v) > 0)
  if (allExist) {
    console.log('\n✅ ¡La migración ya fue aplicada! Todas las tablas y columnas EUDR existen.')
    console.log('   No es necesario volver a ejecutar la migración.\n')
    await client.end()
    return
  }

  console.log('\n🚀 Iniciando migración...\n')

  // ── PASO 1: Columnas en paddocks ──
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PASO 1/2: Columnas EUDR en paddocks + función GIS + trigger')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  await runSQL(client, SQL_STEP1, 'paddocks EUDR columns')

  // ── PASO 2: Tablas + Vista + RLS ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PASO 2/2: Tablas EUDR + Vista + RLS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  await runSQL(client, SQL_STEP2, 'EUDR tables + view + RLS')

  // Verificación post-migración
  console.log('\n🔍 Estado DESPUÉS de la migración:')
  const after = await checkExisting(client)
  console.log(`   eudr_documents:            ${after.has_eudr_documents > 0 ? '✅' : '❌'}`)
  console.log(`   feed_batches:              ${after.has_feed_batches > 0 ? '✅' : '❌'}`)
  console.log(`   eudr_dds_submissions:      ${after.has_eudr_dds > 0 ? '✅' : '❌'}`)
  console.log(`   paddocks.eudr_area_ha:     ${after.has_eudr_area_ha > 0 ? '✅' : '❌'}`)
  console.log(`   animal_custody_timeline:   ${after.has_timeline_view > 0 ? '✅' : '❌'}`)

  await client.end()

  console.log('\n══════════════════════════════════════════════════════')
  console.log('✅ MIGRACIÓN v26 EUDR COMPLETADA EN STAGING')
  console.log('\n👉 Siguiente paso: abrir staging.rodeoagtech.com/dashboard/eudr')
  console.log('══════════════════════════════════════════════════════\n')
}

main().catch(e => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})
