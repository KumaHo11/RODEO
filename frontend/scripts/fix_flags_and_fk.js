#!/usr/bin/env node
/**
 * RODEO — Fix Feature Flags + FK + Triggers
 * Runs multi-statement blocks that need $$ syntax as single queries.
 * Usage: DATABASE_URL=... node fix_flags_and_fk.js
 */
const { Pool } = require('pg')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('❌ DATABASE_URL required'); process.exit(1) }

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

async function run() {
  const client = await pool.connect()
  const masked = DB_URL.replace(/:[^:@]+@/, ':***@')
  console.log(`\n🔧 RODEO — Fix Feature Flags, FK & Triggers`)
  console.log(`📍 Target: ${masked}\n`)

  // 1. Fix FK constraints for climate_adjustment_snapshots
  try {
    await client.query(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE climate_adjustment_snapshots
            ADD CONSTRAINT fk_cas_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
          ALTER TABLE climate_adjustment_snapshots
            ADD CONSTRAINT fk_cas_paddock FOREIGN KEY (paddock_id) REFERENCES paddocks(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `)
    console.log('   ✅ FK constraints for climate_adjustment_snapshots')
  } catch (err) {
    console.log(`   ⚠️  FK constraints: ${err.message.substring(0, 100)}`)
  }

  // 2. Fix triggers
  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
    await client.query(`DROP TRIGGER IF EXISTS trg_historial_potrero_updated_at ON historial_potrero`)
    await client.query(`
      CREATE TRIGGER trg_historial_potrero_updated_at
        BEFORE UPDATE ON historial_potrero
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `)
    console.log('   ✅ Trigger: set_updated_at for historial_potrero')
  } catch (err) {
    console.log(`   ⚠️  Trigger historial_potrero: ${err.message.substring(0, 100)}`)
  }

  try {
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)
    await client.query(`DROP TRIGGER IF EXISTS set_custom_roles_updated_at ON custom_roles`)
    await client.query(`
      CREATE TRIGGER set_custom_roles_updated_at
        BEFORE UPDATE ON custom_roles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `)
    console.log('   ✅ Trigger: update_updated_at_column for custom_roles')
  } catch (err) {
    console.log(`   ⚠️  Trigger custom_roles: ${err.message.substring(0, 100)}`)
  }

  // 3. Fix feature flags — the real issue was the INSERT with CROSS JOIN
  // First, check current state
  const { rows: currentFlags } = await client.query('SELECT COUNT(*) as cnt FROM plan_feature_flags')
  console.log(`\n📊 Current feature flags: ${currentFlags[0].cnt}`)

  // Get plan IDs
  const { rows: plans } = await client.query(`SELECT id, slug FROM subscriptions_plans WHERE slug IN ('brote','planificador','holistico','latifundio')`)
  console.log(`📋 Plans found: ${plans.map(p => p.slug).join(', ')}`)

  const flagSets = {
    brote: [
      ['max_paddocks', '20', 'Máx. potreros', 'number'],
      ['max_herds', '1', 'Máx. rodeos', 'number'],
      ['max_team_members', '1', 'Miembros de equipo', 'number'],
      ['map', 'true', 'Mapa de campo + potreros', 'boolean'],
      ['clima', 'true', 'Módulo clima y alertas', 'boolean'],
      ['agenda', 'true', 'Agenda / eventos', 'boolean'],
      ['grazing_planner', 'false', 'Planificador de pastoreo', 'boolean'],
      ['tareas', 'false', 'Gestión de tareas', 'boolean'],
      ['equipo', 'false', 'Gestión de equipo', 'boolean'],
      ['voice_bitacora', 'false', 'Bitácora de voz + IA', 'boolean'],
      ['ai_insights', 'false', 'Insights IA (Gemini)', 'boolean'],
      ['advanced_reports', 'false', 'Reportes avanzados', 'boolean'],
      ['carbon_module', 'false', 'Módulo Carbono (MRV)', 'boolean'],
      ['offline_mode', 'false', 'App móvil offline', 'boolean'],
      ['ndvi_access', 'false', 'NDVI satelital (Sentinel)', 'boolean'],
      ['api_access', 'false', 'Acceso API corporativa', 'boolean'],
    ],
    planificador: [
      ['max_paddocks', '-1', 'Máx. potreros (ilimitado)', 'number'],
      ['max_herds', '5', 'Máx. rodeos', 'number'],
      ['max_team_members', '3', 'Miembros de equipo', 'number'],
      ['map', 'true', 'Mapa de campo + potreros', 'boolean'],
      ['clima', 'true', 'Módulo clima y alertas', 'boolean'],
      ['agenda', 'true', 'Agenda / eventos', 'boolean'],
      ['grazing_planner', 'true', 'Planificador de pastoreo', 'boolean'],
      ['tareas', 'true', 'Gestión de tareas', 'boolean'],
      ['equipo', 'true', 'Gestión de equipo', 'boolean'],
      ['voice_bitacora', 'false', 'Bitácora de voz + IA', 'boolean'],
      ['ai_insights', 'false', 'Insights IA (Gemini)', 'boolean'],
      ['advanced_reports', 'false', 'Reportes avanzados', 'boolean'],
      ['carbon_module', 'false', 'Módulo Carbono (MRV)', 'boolean'],
      ['offline_mode', 'true', 'App móvil offline', 'boolean'],
      ['ndvi_access', 'false', 'NDVI satelital (Sentinel)', 'boolean'],
      ['api_access', 'false', 'Acceso API corporativa', 'boolean'],
    ],
    holistico: [
      ['max_paddocks', '-1', 'Máx. potreros (ilimitado)', 'number'],
      ['max_herds', '-1', 'Máx. rodeos (ilimitado)', 'number'],
      ['max_team_members', '-1', 'Miembros de equipo', 'number'],
      ['map', 'true', 'Mapa de campo + potreros', 'boolean'],
      ['clima', 'true', 'Módulo clima y alertas', 'boolean'],
      ['agenda', 'true', 'Agenda / eventos', 'boolean'],
      ['grazing_planner', 'true', 'Planificador de pastoreo', 'boolean'],
      ['tareas', 'true', 'Gestión de tareas', 'boolean'],
      ['equipo', 'true', 'Gestión de equipo', 'boolean'],
      ['voice_bitacora', 'true', 'Bitácora de voz + IA', 'boolean'],
      ['ai_insights', 'true', 'Insights IA (Gemini)', 'boolean'],
      ['advanced_reports', 'true', 'Reportes avanzados', 'boolean'],
      ['carbon_module', 'false', 'Módulo Carbono (MRV)', 'boolean'],
      ['offline_mode', 'true', 'App móvil offline', 'boolean'],
      ['ndvi_access', 'true', 'NDVI satelital (Sentinel)', 'boolean'],
      ['api_access', 'false', 'Acceso API corporativa', 'boolean'],
    ],
    latifundio: [
      ['max_paddocks', '-1', 'Máx. potreros (ilimitado)', 'number'],
      ['max_herds', '-1', 'Máx. rodeos (ilimitado)', 'number'],
      ['max_team_members', '-1', 'Miembros de equipo', 'number'],
      ['map', 'true', 'Mapa de campo + potreros', 'boolean'],
      ['clima', 'true', 'Módulo clima y alertas', 'boolean'],
      ['agenda', 'true', 'Agenda / eventos', 'boolean'],
      ['grazing_planner', 'true', 'Planificador de pastoreo', 'boolean'],
      ['tareas', 'true', 'Gestión de tareas', 'boolean'],
      ['equipo', 'true', 'Gestión de equipo', 'boolean'],
      ['voice_bitacora', 'true', 'Bitácora de voz + IA', 'boolean'],
      ['ai_insights', 'true', 'Insights IA (Gemini)', 'boolean'],
      ['advanced_reports', 'true', 'Reportes avanzados', 'boolean'],
      ['carbon_module', 'true', 'Módulo Carbono (MRV)', 'boolean'],
      ['offline_mode', 'true', 'App móvil offline', 'boolean'],
      ['ndvi_access', 'true', 'NDVI satelital (Sentinel)', 'boolean'],
      ['api_access', 'true', 'Acceso API corporativa', 'boolean'],
    ],
  }

  let totalInserted = 0
  for (const plan of plans) {
    const flags = flagSets[plan.slug]
    if (!flags) continue
    for (const [flagKey, flagValue, label, flagType] of flags) {
      try {
        await client.query(
          `INSERT INTO plan_feature_flags (id, plan_id, flag_key, flag_value, label, flag_type)
           VALUES (uuid_generate_v4(), $1, $2, $3::jsonb, $4, $5)
           ON CONFLICT (plan_id, flag_key) DO UPDATE SET flag_value = $3::jsonb, label = $4`,
          [plan.id, flagKey, flagValue, label, flagType]
        )
        totalInserted++
      } catch (err) {
        console.log(`   ⚠️  Flag ${plan.slug}.${flagKey}: ${err.message.substring(0, 80)}`)
      }
    }
    console.log(`   ✅ ${plan.slug}: ${flags.length} flags inserted`)
  }

  // 4. System feature flag
  try {
    await client.query(
      `INSERT INTO system_feature_flags (id, flag_key, flag_type, flag_value, description)
       VALUES (uuid_generate_v4(), 'climate_adjustment', 'boolean', 'true'::jsonb, 'Habilita el motor de Ajuste Clima')
       ON CONFLICT (flag_key) DO NOTHING`
    )
    console.log('   ✅ System feature flag: climate_adjustment')
  } catch (err) {
    console.log(`   ⚠️  System flag: ${err.message.substring(0, 80)}`)
  }

  // 5. Audit log
  try {
    await client.query(
      `INSERT INTO audit_logs (id, actor_email, action, entity_type, new_value)
       VALUES (uuid_generate_v4(), 'system@rodeo.ag', 'EMERGENCY_MIGRATION_FIX', 'system', 
       '{"fix": "feature_flags_seeded", "total_flags": ${totalInserted}}'::jsonb)`
    )
    console.log('   ✅ Audit log entry')
  } catch (err) {
    console.log(`   ⚠️  Audit: ${err.message.substring(0, 80)}`)
  }

  // Final count
  const { rows: finalFlags } = await client.query('SELECT COUNT(*) as cnt FROM plan_feature_flags')
  console.log(`\n🏷️  Final feature flags count: ${finalFlags[0].cnt}`)

  client.release()
  await pool.end()
  console.log('\n🎉 Fix complete!\n')
}

run().catch(err => { console.error('❌', err.message); process.exit(1) })
