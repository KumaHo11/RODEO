#!/usr/bin/env node
/**
 * RODEO — Migration runner v22 + v23 (usa DO $$ para ejecutar SQL completo)
 * Aplica v22_metrics_module.sql y v23_animals.sql a la DB activa.
 */
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Auto-load .env.local solo si DATABASE_URL no está ya en el entorno
if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_SERVICE) {
  try {
    const envPath = path.resolve(__dirname, '../.env.local')
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
      if (m) process.env[m[1]] = m[2]
    }
    console.log('📂 Cargado .env.local')
  } catch {
    console.error('❌ No se encontró DATABASE_URL ni .env.local')
    process.exit(1)
  }
}

const DB_URL = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
console.log('📍 Conectando a:', DB_URL.replace(/:[^:@]+@/, ':***@'))

const pool = new Pool({
  connectionString: DB_URL,
  ssl: false, // Cloud SQL Auth Proxy maneja TLS a nivel túnel
  connectionTimeoutMillis: 15000,
})

const MIGRATIONS = [
  path.resolve(__dirname, '../../v22_metrics_module.sql'),
  path.resolve(__dirname, '../../v23_animals.sql'),
]

async function runMigration(client, filePath) {
  const fileName = path.basename(filePath)
  console.log(`\n🔄 Aplicando ${fileName}...`)

  const sql = fs.readFileSync(filePath, 'utf-8')

  // Ejecutar TODO el archivo SQL de una vez como una sola transacción
  // Esto evita el problema del splitter con multiline statements
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`  ✅ ${fileName}: aplicado correctamente`)
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`  ❌ Error en ${fileName}: ${err.message}`)
    // Si ya existe (idempotent re-run), no es fatal
    if (err.message.includes('already exists')) {
      console.log(`  ⚠️  Tablas ya existían — OK`)
      return true
    }
    return false
  }
}

async function main() {
  console.log('🐄 RODEO Metrics — Migration Runner v22+v23')
  console.log('============================================')

  let client
  try {
    client = await pool.connect()
    console.log('✅ Conexión exitosa')

    // PostGIS check
    try {
      const r = await client.query("SELECT PostGIS_Version()")
      console.log(`✅ PostGIS ${r.rows[0].postgis_version?.split(' ')[0] || 'OK'} disponible`)
    } catch {
      console.log('⚠️  PostGIS no detectado')
    }

    // Verificar tablas base
    const { rows: existingTables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('paddocks', 'organizations', 'profiles', 'herds')
      ORDER BY table_name
    `)
    const existing = existingTables.map(r => r.table_name)
    console.log('📦 Tablas base presentes:', existing.join(', '))

    const missing = ['paddocks', 'organizations', 'profiles'].filter(t => !existing.includes(t))
    if (missing.length > 0) {
      console.error(`❌ Tablas faltantes: ${missing.join(', ')} — aplicá el schema base primero`)
      process.exit(1)
    }

    // Verificar si ya existen las tablas nuevas (re-run idempotente)
    const { rows: preCheck } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('metric_snapshots','metric_trends','metric_subscriptions','deforestation_checks','animals','animal_events')
    `)
    if (preCheck.length > 0) {
      console.log(`\nℹ️  Tablas ya existentes: ${preCheck.map(r=>r.table_name).join(', ')}`)
      console.log('   Continuando de todas formas (IF NOT EXISTS en CREATE TABLE)')
    }

    // Aplicar migrations
    let allOk = true
    for (const migPath of MIGRATIONS) {
      const ok = await runMigration(client, migPath)
      if (!ok) allOk = false
    }

    // Verificar resultado final
    const { rows: newTables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'metric_snapshots', 'metric_trends', 'metric_subscriptions',
          'deforestation_checks', 'animals', 'animal_events'
        )
      ORDER BY table_name
    `)

    const created = newTables.map(r => r.table_name)
    const expected = ['metric_snapshots', 'metric_trends', 'metric_subscriptions', 'deforestation_checks', 'animals', 'animal_events']

    console.log('\n📋 Tablas verificadas post-migration:')
    for (const t of expected) {
      console.log(`  ${created.includes(t) ? '✅' : '❌'} ${t}`)
    }

    if (created.length === expected.length) {
      console.log('\n🎉 Migrations v22 y v23 aplicadas correctamente!')
    } else {
      console.log('\n⚠️  Algunas tablas no se crearon — revisá los errores arriba')
      process.exit(1)
    }

  } catch (err) {
    console.error('\n❌ Error fatal:', err.message)
    process.exit(1)
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

main()
