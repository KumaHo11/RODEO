/**
 * test_eudr_endpoints.js
 * Prueba directamente las queries de los endpoints EUDR contra staging
 * usando el Cloud SQL Proxy en localhost:5432
 */
const path = require('path')
const { Client } = require('pg')

require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') })

const DB_URL = process.env.DATABASE_URL_SERVICE

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('✅ Conectado a staging\n')

  const tests = []

  // Test 1: eudr_documents (GET /api/eudr/documents)
  try {
    const r = await client.query(`
      SELECT d.id, d.doc_type, d.file_url, d.verified, d.expiry_date,
        p.name AS paddock_name
      FROM eudr_documents d
      LEFT JOIN paddocks p ON p.id = d.paddock_id
      LIMIT 3
    `)
    tests.push({ name: 'GET /api/eudr/documents', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'GET /api/eudr/documents', ok: false, error: e.message }) }

  // Test 2: feed_batches (GET /api/eudr/feed-batches)
  try {
    const r = await client.query(`
      SELECT id, feed_type, supplier_name, eudr_compliant, quantity_kg, received_date
      FROM feed_batches
      LIMIT 3
    `)
    tests.push({ name: 'GET /api/eudr/feed-batches', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'GET /api/eudr/feed-batches', ok: false, error: e.message }) }

  // Test 3: validate-paddocks (core query)
  try {
    const r = await client.query(`
      SELECT
        p.id, p.name, p.area_ha,
        p.geom IS NOT NULL AS has_geometry,
        p.eudr_area_ha, p.eudr_geom_type, p.eudr_validated_at,
        COALESCE(ST_Area(p.geom::geography) / 10000.0, p.area_ha) AS computed_area_ha,
        ST_IsValid(p.geom) AS geom_is_valid,
        dc.status AS deforestation_status
      FROM paddocks p
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status, confidence, checked_at
        FROM deforestation_checks
        ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.is_active = true
      LIMIT 5
    `)
    tests.push({ name: 'GET /api/eudr/validate-paddocks', ok: true, rows: r.rows.length, sample: r.rows[0] })
  } catch (e) { tests.push({ name: 'GET /api/eudr/validate-paddocks', ok: false, error: e.message }) }

  // Test 4: generate-dds (GET listing)
  try {
    const r = await client.query(`
      SELECT id, submission_type, status, created_at,
        array_length(paddock_ids, 1) AS paddock_count
      FROM eudr_dds_submissions
      ORDER BY created_at DESC LIMIT 3
    `)
    tests.push({ name: 'GET /api/eudr/generate-dds (list)', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'GET /api/eudr/generate-dds (list)', ok: false, error: e.message }) }

  // Test 5: animal_custody_timeline (view)
  try {
    const r = await client.query(`SELECT * FROM animal_custody_timeline LIMIT 1`)
    tests.push({ name: 'VIEW animal_custody_timeline', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'VIEW animal_custody_timeline', ok: false, error: e.message }) }

  // Test 6: traces-geojson (core query)
  try {
    const r = await client.query(`
      SELECT p.id, p.name,
        ST_AsGeoJSON(CASE WHEN p.eudr_geom_type = 'POINT' THEN ST_Centroid(p.geom) ELSE p.geom END)::json AS geometry,
        p.eudr_area_ha, p.eudr_geom_type,
        dc.status AS deforestation_status
      FROM paddocks p
      LEFT JOIN (
        SELECT DISTINCT ON (paddock_id) paddock_id, status
        FROM deforestation_checks ORDER BY paddock_id, checked_at DESC
      ) dc ON dc.paddock_id = p.id
      WHERE p.geom IS NOT NULL AND p.is_active = true
      LIMIT 3
    `)
    tests.push({ name: 'GET /api/eudr/traces-geojson', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'GET /api/eudr/traces-geojson', ok: false, error: e.message }) }

  // Test 7: eudr_documents with expiry status (same as route)
  try {
    const r = await client.query(`
      SELECT d.id, d.doc_type,
        CASE WHEN d.expiry_date < NOW() THEN 'EXPIRED'
             WHEN d.expiry_date < NOW() + INTERVAL '60 days' THEN 'EXPIRING_SOON'
             ELSE 'VALID' END AS expiry_status
      FROM eudr_documents d
      LIMIT 3
    `)
    tests.push({ name: 'GET /api/eudr/documents (with expiry_status)', ok: true, rows: r.rows.length })
  } catch (e) { tests.push({ name: 'GET /api/eudr/documents (with expiry_status)', ok: false, error: e.message }) }

  await client.end()

  // Reporte
  console.log('══════════════════════════════════════════════════════')
  console.log('📊 DIAGNÓSTICO DE ENDPOINTS EUDR EN STAGING')
  console.log('══════════════════════════════════════════════════════\n')
  
  let failures = 0
  for (const t of tests) {
    if (t.ok) {
      console.log(`✅ ${t.name}`)
      if (t.rows !== undefined) console.log(`   → ${t.rows} registros`)
      if (t.sample) console.log(`   → Muestra:`, JSON.stringify(t.sample).slice(0, 120))
    } else {
      failures++
      console.log(`❌ ${t.name}`)
      console.log(`   → ERROR: ${t.error}`)
    }
  }

  console.log('\n──────────────────────────────────────────────────────')
  if (failures === 0) {
    console.log('✅ Todos los endpoints EUDR tienen queries válidas.')
    console.log('   Si el frontend sigue dando 500, el problema es de AUTH/sesión,')
    console.log('   no de estructura de base de datos.')
  } else {
    console.log(`❌ ${failures} endpoint(s) con problemas de base de datos.`)
  }
  console.log('══════════════════════════════════════════════════════\n')
}

main().catch(e => {
  console.error('Error fatal:', e.message)
  process.exit(1)
})
