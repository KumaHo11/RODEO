/**
 * cleanup_users.js
 * 
 * Limpia TODOS los usuarios y datos de la DB de producción
 * EXCEPTO el super admin y javi.osorio.1@gmail.com
 * 
 * Usage: node scripts/cleanup_users.js "$DATABASE_URL"
 */
const { Pool } = require('pg')

const connectionString = process.argv[2]
if (!connectionString) {
  console.error('Usage: node scripts/cleanup_users.js "$DATABASE_URL"')
  process.exit(1)
}

// Emails a preservar
const KEEP_EMAILS = [
  'javi.osorio.1@gmail.com',
]

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
    // 1. Get profiles to keep
    const keepProfiles = await client.query(
      `SELECT id, firebase_uid, email, organization_id, system_role FROM profiles 
       WHERE email = ANY($1) OR system_role = 'SUPER_ADMIN'`,
      [KEEP_EMAILS]
    )
    
    const keepProfileIds = keepProfiles.rows.map(p => p.id)
    const keepOrgIds = keepProfiles.rows.map(p => p.organization_id).filter(Boolean)
    const keepUids = keepProfiles.rows.map(p => p.firebase_uid).filter(Boolean)
    
    console.log('\n[cleanup] Usuarios a preservar:')
    keepProfiles.rows.forEach(p => console.log(`  ✓ ${p.email} (${p.system_role || 'regular'}) org=${p.organization_id}`))
    
    // 2. Get profiles to DELETE
    const deleteProfiles = await client.query(
      `SELECT id, firebase_uid, email, organization_id FROM profiles 
       WHERE id != ALL($1::uuid[])`,
      [keepProfileIds]
    )
    
    const deleteProfileIds = deleteProfiles.rows.map(p => p.id)
    const deleteOrgIds = deleteProfiles.rows
      .map(p => p.organization_id)
      .filter(Boolean)
      .filter(orgId => !keepOrgIds.includes(orgId))
    
    console.log(`\n[cleanup] Usuarios a eliminar: ${deleteProfiles.rows.length}`)
    deleteProfiles.rows.forEach(p => console.log(`  ✗ ${p.email} org=${p.organization_id}`))
    
    if (deleteProfiles.rows.length === 0) {
      console.log('\n[cleanup] No hay usuarios para eliminar. Todo limpio.')
      return
    }

    await client.query('BEGIN')

    // 3. Delete data from dependent tables (order matters for FK constraints)
    // Tables scoped to organizations to delete
    if (deleteOrgIds.length > 0) {
      const orgPlaceholders = deleteOrgIds.map((_, i) => `$${i + 1}`).join(',')
      
      // biological_monitoring (via paddocks)
      const bioResult = await client.query(
        `DELETE FROM biological_monitoring WHERE paddock_id IN (
          SELECT id FROM paddocks WHERE org_id IN (${orgPlaceholders})
        )`, deleteOrgIds
      )
      console.log(`  Deleted ${bioResult.rowCount} biological_monitoring records`)

      // historial_potrero (via paddocks)
      try {
        const histResult = await client.query(
          `DELETE FROM historial_potrero WHERE paddock_id IN (
            SELECT id FROM paddocks WHERE org_id IN (${orgPlaceholders})
          )`, deleteOrgIds
        )
        console.log(`  Deleted ${histResult.rowCount} historial_potrero records`)
      } catch { console.log('  historial_potrero: skipped (table may not exist)') }

      // climate_adjustment_snapshots
      try {
        const climResult = await client.query(
          `DELETE FROM climate_adjustment_snapshots WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${climResult.rowCount} climate_adjustment_snapshots`)
      } catch { console.log('  climate_adjustment_snapshots: skipped') }

      // grazing_plans
      const gpResult = await client.query(
        `DELETE FROM grazing_plans WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
      )
      console.log(`  Deleted ${gpResult.rowCount} grazing_plans`)

      // rainfall_logs
      const rainResult = await client.query(
        `DELETE FROM rainfall_logs WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
      )
      console.log(`  Deleted ${rainResult.rowCount} rainfall_logs`)

      // herds
      const herdsResult = await client.query(
        `DELETE FROM herds WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
      )
      console.log(`  Deleted ${herdsResult.rowCount} herds`)

      // paddocks
      const paddocksResult = await client.query(
        `DELETE FROM paddocks WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
      )
      console.log(`  Deleted ${paddocksResult.rowCount} paddocks`)

      // notifications
      try {
        const notifResult = await client.query(
          `DELETE FROM notifications WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${notifResult.rowCount} notifications`)
      } catch { console.log('  notifications: skipped') }

      // team_invitations
      try {
        const invResult = await client.query(
          `DELETE FROM team_invitations WHERE organization_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${invResult.rowCount} team_invitations`)
      } catch { console.log('  team_invitations: skipped') }

      // farm_events
      try {
        const feResult = await client.query(
          `DELETE FROM farm_events WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${feResult.rowCount} farm_events`)
      } catch { console.log('  farm_events: skipped') }

      // field_notes
      try {
        const fnResult = await client.query(
          `DELETE FROM field_notes WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${fnResult.rowCount} field_notes`)
      } catch { console.log('  field_notes: skipped') }

      // movements
      try {
        const movResult = await client.query(
          `DELETE FROM movements WHERE org_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${movResult.rowCount} movements`)
      } catch { console.log('  movements: skipped') }

      // payments
      try {
        const payResult = await client.query(
          `DELETE FROM payments WHERE organization_id IN (${orgPlaceholders})`, deleteOrgIds
        )
        console.log(`  Deleted ${payResult.rowCount} payments`)
      } catch { console.log('  payments: skipped') }
    }

    // 4. Delete user-scoped data
    if (deleteProfileIds.length > 0) {
      const profilePlaceholders = deleteProfileIds.map((_, i) => `$${i + 1}`).join(',')

      // terms_acceptances
      try {
        const taResult = await client.query(
          `DELETE FROM terms_acceptances WHERE profile_id IN (${profilePlaceholders})`, deleteProfileIds
        )
        console.log(`  Deleted ${taResult.rowCount} terms_acceptances`)
      } catch { console.log('  terms_acceptances: skipped') }

      // audit_logs
      try {
        const alResult = await client.query(
          `DELETE FROM audit_logs WHERE user_id IN (${profilePlaceholders})`, deleteProfileIds
        )
        console.log(`  Deleted ${alResult.rowCount} audit_logs`)
      } catch { console.log('  audit_logs: skipped') }
    }

    // 5. Delete the profiles
    const profileResult = await client.query(
      `DELETE FROM profiles WHERE id = ANY($1::uuid[])`, [deleteProfileIds]
    )
    console.log(`  Deleted ${profileResult.rowCount} profiles`)

    // 6. Delete orphaned organizations
    if (deleteOrgIds.length > 0) {
      const orgResult = await client.query(
        `DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [deleteOrgIds]
      )
      console.log(`  Deleted ${orgResult.rowCount} organizations`)
    }

    await client.query('COMMIT')
    
    // 7. Verify
    const remaining = await client.query('SELECT email, system_role FROM profiles ORDER BY email')
    console.log(`\n[cleanup] ✅ Usuarios restantes: ${remaining.rows.length}`)
    remaining.rows.forEach(r => console.log(`  ✓ ${r.email} (${r.system_role || 'regular'})`))

    console.log('\n[cleanup] ✅ Limpieza completada')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[cleanup] ❌ Error:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
