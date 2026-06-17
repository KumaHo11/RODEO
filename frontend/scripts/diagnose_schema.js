#!/usr/bin/env node
/**
 * RODEO — Schema Diagnostic Tool
 * Lists all tables and their column counts in the target database.
 * Usage: DATABASE_URL=... node diagnose_schema.js
 */
const { Pool } = require('pg')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ DATABASE_URL required')
  process.exit(1)
}

async function diagnose() {
  const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  try {
    const client = await pool.connect()
    const masked = DB_URL.replace(/:[^:@]+@/, ':***@')
    console.log(`\n✅ Connected to: ${masked}\n`)

    // 1. List all tables
    const { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    console.log(`📦 Tables found (${tables.length}):`)
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`))

    // 2. Check for specific critical tables
    const EXPECTED_TABLES = [
      'subscriptions_plans', 'organizations', 'profiles', 'paddocks', 'herds',
      'grazing_plans', 'biological_monitoring', 'rainfall_logs', 'payments',
      'farm_events', 'tasks', 'field_notes', 'notifications', 'invitations',
      'market_prices', 'ndvi_logs', 'carbon_assessments', 'carbon_certificates',
      'climate_adjustment_snapshots', 'system_feature_flags', 'weather_cache',
      'plan_feature_flags', 'audit_logs', 'impersonation_sessions', 'system_config',
      'custom_roles', 'historial_potrero', 'whatsapp_links',
      'terms_and_conditions_versions', 'user_terms_acceptances',
      'weather_events', 'weather_event_paddocks', 'movements', 'climate_projections',
      'grazing_plan_entries'
    ]

    const existingNames = tables.map(t => t.table_name)
    const missing = EXPECTED_TABLES.filter(t => !existingNames.includes(t))
    const present = EXPECTED_TABLES.filter(t => existingNames.includes(t))

    console.log(`\n📊 Expected: ${EXPECTED_TABLES.length} | Present: ${present.length} | Missing: ${missing.length}`)
    
    if (missing.length > 0) {
      console.log(`\n❌ MISSING TABLES (${missing.length}):`)
      missing.forEach(t => console.log(`   ❌ ${t}`))
    } else {
      console.log(`\n🎉 All expected tables are present!`)
    }

    // 3. Check critical columns on key tables
    const CRITICAL_COLUMNS = [
      { table: 'profiles', columns: ['system_role', 'is_first_login', 'completed_tours', 'firebase_uid'] },
      { table: 'herds', columns: ['physiological_category', 'grupo_manejo_id', 'categoria', 'version'] },
      { table: 'paddocks', columns: ['is_active', 'dry_matter_kg_ha', 'version', 'technical_data'] },
      { table: 'grazing_plans', columns: ['org_id', 'plan_type', 'source_origin', 'version', 'herd_ids'] },
      { table: 'organizations', columns: ['plan_status', 'trial_ends_at', 'field_name', 'technical_data'] },
      { table: 'subscriptions_plans', columns: ['slug', 'trial_days', 'price_yearly', 'is_active'] },
      { table: 'farm_events', columns: ['category', 'all_day', 'version', 'assigned_to'] },
    ]

    console.log('\n🔍 Critical Column Check:')
    for (const check of CRITICAL_COLUMNS) {
      if (!existingNames.includes(check.table)) {
        console.log(`   ⏭️  ${check.table}: TABLE MISSING (skipped)`)
        continue
      }
      const { rows: cols } = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
      `, [check.table])
      const colNames = cols.map(c => c.column_name)
      const missingCols = check.columns.filter(c => !colNames.includes(c))
      if (missingCols.length > 0) {
        console.log(`   ⚠️  ${check.table}: missing [${missingCols.join(', ')}]`)
      } else {
        console.log(`   ✅ ${check.table}: all critical columns present`)
      }
    }

    // 4. Row counts for existing tables
    console.log('\n📈 Row counts:')
    for (const t of existingNames) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) as cnt FROM "${t}"`)
        console.log(`   ${t}: ${rows[0].cnt} rows`)
      } catch {
        console.log(`   ${t}: (count failed)`)
      }
    }

    client.release()
    await pool.end()
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

diagnose()
