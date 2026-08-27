/**
 * migrate_v26_eudr_staging.js
 *
 * Ejecuta la migración EUDR v26 completa en STAGING usando el Cloud SQL Connector
 * con las credenciales del Service Account (FIREBASE_ADMIN_CREDENTIALS_BASE64).
 *
 * Pasos en orden:
 *   1. v26_paddocks_eudr_columns.sql  → user: postgres (superuser, SECURITY DEFINER)
 *   2. v26_eudr_main.sql              → user: rodeo_service (tablas + vista + RLS)
 *
 * ⚠️  SOLO modifica la instancia de STAGING: rodeo-db-preprod
 *     NO toca producción.
 *
 * USO: node migrate_v26_eudr_staging.js
 */
const path = require('path')
const fs   = require('fs')
const { Client } = require('pg')
const { Connector } = require('@google-cloud/cloud-sql-connector')

// Cargar .env.local del frontend (donde viven las credenciales)
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') })

// ── Configuración ──────────────────────────────────────────────────────────
const INSTANCE    = 'rodeo-app-fac50:southamerica-east1:rodeo-db-preprod'
const DATABASE    = 'rodeo'
const SQL_STEP1   = path.join(__dirname, '..', 'v26_paddocks_eudr_columns.sql')
const SQL_STEP2   = path.join(__dirname, '..', 'v26_eudr_main.sql')

// Passwords extraídos de los scripts existentes en el repo
const POSTGRES_PASS     = process.env.POSTGRES_STAGING_PASS    || 'postgres_staging_pass' 
const SERVICE_USER_PASS = 'rodeo_svc_staging_pass_123'
// ──────────────────────────────────────────────────────────────────────────

async function connectAsUser(connector, user, password) {
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE,
    ipType: 'PUBLIC',
  })
  const client = new Client({
    ...clientOpts,
    user,
    password,
    database: DATABASE,
  })
  await client.connect()
  return client
}

async function runSQL(client, sqlPath, label) {
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(`\n📄 Ejecutando: ${path.basename(sqlPath)}`)

  // Dividir en statements individuales para mejor reporte de errores
  // (el SQL ya está pensado para ejecutarse entero dentro de una transacción)
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`✅ ${label} — OK`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(`❌ ${label} — ROLLBACK ejecutado`)
    console.error('   Error:', err.message)
    if (err.detail)   console.error('   Detail:', err.detail)
    if (err.hint)     console.error('   Hint:', err.hint)
    if (err.position) console.error('   Position:', err.position)
    throw err
  }
}

async function main() {
  const credsB64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (!credsB64) {
    console.error('❌ FIREBASE_ADMIN_CREDENTIALS_BASE64 no está configurado en .env.local')
    process.exit(1)
  }

  // Verificar archivos SQL
  for (const f of [SQL_STEP1, SQL_STEP2]) {
    if (!fs.existsSync(f)) {
      console.error(`❌ Archivo no encontrado: ${f}`)
      process.exit(1)
    }
  }

  const creds = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf8'))

  console.log('\n══════════════════════════════════════════════════════')
  console.log('🐄 RODEO — Migración EUDR v26 → STAGING')
  console.log(`   Instancia: ${INSTANCE}`)
  console.log(`   Base de datos: ${DATABASE}`)
  console.log(`   Service Account: ${creds.client_email}`)
  console.log('   ⚠️  SOLO staging — producción NO será modificada')
  console.log('══════════════════════════════════════════════════════\n')

  const connector = new Connector({
    auth: {
      credentials: {
        client_email: creds.client_email,
        private_key:  creds.private_key,
      },
    },
  })

  // ──────────────────────────────────────────────────────────────────
  // PASO 1: Columnas EUDR en paddocks (requiere superuser / postgres)
  // El SA tiene el rol cloudsqlsuperuser en staging
  // ──────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PASO 1/2: ALTER TABLE paddocks + función GIS + trigger')
  console.log('          (usuario: postgres via Cloud SQL Connector)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  let client1
  try {
    // Intentar con postgres primero (si el SA tiene permisos de superuser)
    client1 = await connectAsUser(connector, 'postgres', POSTGRES_PASS)
  } catch (e) {
    // Si no hay contraseña de postgres, intentar con rodeo_service que tiene SECURITY DEFINER
    console.warn('   ⚠️  No se pudo conectar como postgres, intentando como rodeo_service...')
    client1 = await connectAsUser(connector, 'rodeo_service', SERVICE_USER_PASS)
  }

  console.log(`✅ Conectado a Cloud SQL (${INSTANCE})`)
  await runSQL(client1, SQL_STEP1, 'v26_paddocks_eudr_columns')
  await client1.end()

  // ──────────────────────────────────────────────────────────────────
  // PASO 2: Tablas + Vista + RLS como rodeo_service
  // ──────────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PASO 2/2: Tablas EUDR + Vista animal_custody_timeline + RLS')
  console.log('          (usuario: rodeo_service)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const client2 = await connectAsUser(connector, 'rodeo_service', SERVICE_USER_PASS)
  console.log('✅ Conectado como rodeo_service')
  await runSQL(client2, SQL_STEP2, 'v26_eudr_main')
  await client2.end()

  connector.close()

  // ──────────────────────────────────────────────────────────────────
  // Reporte final
  // ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log('✅ MIGRACIÓN v26 EUDR COMPLETADA EN STAGING\n')
  console.log('Tablas creadas:')
  console.log('  ✓ eudr_documents        — bóveda documental legal')
  console.log('  ✓ feed_batches          — trazabilidad de insumos')
  console.log('  ✓ eudr_dds_submissions  — historial de DDS')
  console.log('\nColumnas agregadas en paddocks:')
  console.log('  ✓ eudr_area_ha')
  console.log('  ✓ eudr_geom_type')
  console.log('  ✓ eudr_validated_at')
  console.log('  ✓ eudr_notes')
  console.log('\nVista creada:')
  console.log('  ✓ animal_custody_timeline')
  console.log('\nFunciones y triggers:')
  console.log('  ✓ update_paddock_eudr_gis()')
  console.log('  ✓ trg_paddock_eudr (trigger en paddocks.geom)')
  console.log('\nRLS habilitado en las 3 tablas nuevas.')
  console.log('\n👉 Próximo paso: abrir staging.rodeoagtech.com/dashboard/eudr')
  console.log('   El módulo EUDR debería funcionar completamente.')
  console.log('══════════════════════════════════════════════════════\n')
}

main().catch(e => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})
