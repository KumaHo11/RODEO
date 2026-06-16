/**
 * clean_db_keep_superadmin.js
 * Limpia la DB de staging conservando solo el superadmin.
 * Uso: node frontend/scripts/clean_db_keep_superadmin.js
 */
const { Client } = require('pg')

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:RodeoDB2026Secure@35.247.199.183:5432/rodeo?schema=public'
const SUPERADMIN_EMAIL = 'superadmin@rodeoagtech.com'

async function run() {
  const client = new Client(DB_URL)
  await client.connect()
  console.log('✅ Conectado a la DB de staging')

  try {
    // ── 1. Encontrar al superadmin ────────────────────────────────────────────
    const saResult = await client.query(
      `SELECT p.id as profile_id, p.organization_id, p.firebase_uid, p.email
       FROM profiles p
       WHERE p.system_role = 'SUPER_ADMIN' OR p.email = $1
       LIMIT 1`,
      [SUPERADMIN_EMAIL]
    )

    let saProfileId, saOrgId

    if (saResult.rows.length === 0) {
      console.log('⚠️  Superadmin no encontrado en la DB. Creando...')
      const ids = await createSuperAdmin(client)
      saProfileId = ids.profileId
      saOrgId = ids.orgId
      console.log('✅ Superadmin creado exitosamente')
    } else {
      const sa = saResult.rows[0]
      saProfileId = sa.profile_id
      saOrgId = sa.organization_id
      console.log(`✅ Superadmin encontrado: ${sa.email}`)
      console.log(`   profile_id: ${saProfileId}`)
      console.log(`   org_id:     ${saOrgId}`)
    }

    console.log('\n🗑️  Iniciando limpieza de datos...\n')

    // ── 2. Borrado en orden correcto (respetando FK constraints) ─────────────

    // Hijos de grazing_plans
    const r1 = await client.query(`DELETE FROM grazing_plans WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id != $1)`, [saOrgId])
    console.log(`   grazing_plans (by paddock): ${r1.rowCount} eliminados`)

    const r1b = await client.query(`DELETE FROM grazing_plans WHERE herd_id IN (SELECT id FROM herds WHERE org_id != $1)`, [saOrgId])
    console.log(`   grazing_plans (by herd): ${r1b.rowCount} eliminados`)

    const r2 = await client.query(`DELETE FROM biological_monitoring WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id != $1)`, [saOrgId])
    console.log(`   biological_monitoring: ${r2.rowCount} eliminados`)

    const r3 = await client.query(`DELETE FROM weather_event_paddocks WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id != $1)`, [saOrgId])
    console.log(`   weather_event_paddocks: ${r3.rowCount} eliminados`)

    const r4 = await client.query(`DELETE FROM weather_events WHERE org_id != $1`, [saOrgId])
    console.log(`   weather_events: ${r4.rowCount} eliminados`)

    const r5 = await client.query(`DELETE FROM rainfall_logs WHERE org_id != $1`, [saOrgId])
    console.log(`   rainfall_logs: ${r5.rowCount} eliminados`)

    const r6 = await client.query(`DELETE FROM farm_events WHERE org_id != $1`, [saOrgId])
    console.log(`   farm_events: ${r6.rowCount} eliminados`)

    const r7 = await client.query(`DELETE FROM tasks WHERE org_id != $1`, [saOrgId])
    console.log(`   tasks: ${r7.rowCount} eliminados`)

    const r8 = await client.query(`DELETE FROM payments WHERE org_id != $1`, [saOrgId])
    console.log(`   payments: ${r8.rowCount} eliminados`)

    const r9 = await client.query(`DELETE FROM herds WHERE org_id != $1`, [saOrgId])
    console.log(`   herds: ${r9.rowCount} eliminados`)

    const r10 = await client.query(`DELETE FROM paddocks WHERE org_id != $1`, [saOrgId])
    console.log(`   paddocks: ${r10.rowCount} eliminados`)

    const r11 = await client.query(`DELETE FROM user_terms_acceptances WHERE profile_id != $1`, [saProfileId])
    console.log(`   user_terms_acceptances: ${r11.rowCount} eliminados`)

    const r12 = await client.query(`DELETE FROM profiles WHERE id != $1`, [saProfileId])
    console.log(`   profiles: ${r12.rowCount} eliminados`)

    const r13 = await client.query(`DELETE FROM organizations WHERE id != $1`, [saOrgId])
    console.log(`   organizations: ${r13.rowCount} eliminados`)

    // Audit logs (tabla opcional)
    try {
      const r14 = await client.query(`DELETE FROM audit_logs WHERE profile_id IS NOT NULL AND profile_id != $1`, [saProfileId])
      console.log(`   audit_logs: ${r14.rowCount} eliminados`)
    } catch(e) { /* tabla puede no existir en este schema */ }

    // ── 3. Verificación final ─────────────────────────────────────────────────
    console.log('\n📊 Estado final de la DB:\n')
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM profiles) as profiles,
        (SELECT COUNT(*) FROM organizations) as organizations,
        (SELECT COUNT(*) FROM paddocks) as paddocks,
        (SELECT COUNT(*) FROM herds) as herds,
        (SELECT COUNT(*) FROM grazing_plans) as grazing_plans,
        (SELECT COUNT(*) FROM payments) as payments,
        (SELECT COUNT(*) FROM user_terms_acceptances) as terms_acceptances
    `)
    const c = counts.rows[0]
    console.log(`   profiles:              ${c.profiles}`)
    console.log(`   organizations:         ${c.organizations}`)
    console.log(`   paddocks:              ${c.paddocks}`)
    console.log(`   herds:                 ${c.herds}`)
    console.log(`   grazing_plans:         ${c.grazing_plans}`)
    console.log(`   payments:              ${c.payments}`)
    console.log(`   terms_acceptances:     ${c.terms_acceptances}`)

    const saCheck = await client.query(
      `SELECT p.email, p.system_role, p.role, o.name as org_name
       FROM profiles p JOIN organizations o ON p.organization_id = o.id
       WHERE p.id = $1`,
      [saProfileId]
    )
    const sa = saCheck.rows[0]
    console.log(`\n✅ Superadmin verificado e intacto:`)
    console.log(`   Email:       ${sa?.email}`)
    console.log(`   system_role: ${sa?.system_role}`)
    console.log(`   role:        ${sa?.role}`)
    console.log(`   Org:         ${sa?.org_name}`)
    console.log('\n🎉 Limpieza completada exitosamente. DB lista para pruebas.\n')

  } catch (err) {
    console.error('❌ Error durante la limpieza:', err.message)
    throw err
  } finally {
    await client.end()
  }
}

async function createSuperAdmin(client) {
  const orgRes = await client.query(`
    INSERT INTO organizations (id, name, plan_status, updated_at)
    VALUES (gen_random_uuid(), 'Rodeo SuperAdmin Org', 'active', NOW())
    RETURNING id
  `)
  const orgId = orgRes.rows[0].id

  const profRes = await client.query(`
    INSERT INTO profiles (id, email, first_name, last_name, role, system_role, organization_id, is_active, updated_at)
    VALUES (gen_random_uuid(), $1, 'Super', 'Admin', 'OWNER', 'SUPER_ADMIN', $2, true, NOW())
    RETURNING id
  `, [SUPERADMIN_EMAIL, orgId])
  const profId = profRes.rows[0].id

  await client.query(`UPDATE organizations SET owner_id = $1 WHERE id = $2`, [profId, orgId])

  const termsRes = await client.query(`SELECT id FROM terms_and_conditions_versions WHERE is_active = true LIMIT 1`)
  if (termsRes.rows.length > 0) {
    await client.query(`
      INSERT INTO user_terms_acceptances (id, profile_id, version_id, ip_address)
      VALUES (gen_random_uuid(), $1, $2, '127.0.0.1')
    `, [profId, termsRes.rows[0].id])
  }

  return { profileId: profId, orgId }
}

run().catch(err => {
  process.exit(1)
})
