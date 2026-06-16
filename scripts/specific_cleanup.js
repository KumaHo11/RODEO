/**
 * specific_cleanup.js
 * Deletes specific test users and their related org data from the Postgres DB and Firebase Auth.
 */
const { Client } = require('pg')
const { initializeApp, cert } = require('../frontend/node_modules/firebase-admin/lib/app/index.js')
const { getAuth } = require('../frontend/node_modules/firebase-admin/lib/auth/index.js')
const fs = require('fs')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('❌ ERROR: DATABASE_URL no está definida.')
  process.exit(1)
}

const TARGET_EMAILS = [
  'javi.osorio.1@gmail.com',
  'javo.oso.m@gmail.com',
  'javo.oso.n@gmail.com',
  'josorio@rodeoagtech.com'
]

async function run() {
  const content = fs.readFileSync('./frontend/.env.local', 'utf8')
  const match = content.match(/FIREBASE_ADMIN_CREDENTIALS_BASE64=(.+)/)
  const saJson = JSON.parse(Buffer.from(match[1].trim(), 'base64').toString())
  const app = initializeApp({ credential: cert(saJson) })
  const auth = getAuth(app)

  const client = new Client(DB_URL)
  await client.connect()
  console.log('✅ Conectado a la DB')

  try {
    await client.query('BEGIN')

    for (const email of TARGET_EMAILS) {
      console.log(`\\n--- Procesando: ${email} ---`)
      
      // 1. Delete from Firebase Auth
      let uid = null
      try {
        const fbUser = await auth.getUserByEmail(email)
        uid = fbUser.uid
        await auth.deleteUser(uid)
        console.log(`🔥 Borrado de Firebase Auth (UID: ${uid})`)
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          console.log(`ℹ️  No encontrado en Firebase Auth`)
        } else {
          console.error(`❌ Error en Firebase:`, err.message)
        }
      }

      // 2. Encontrar Profile(s) en la DB
      const profileRes = await client.query('SELECT id, organization_id, firebase_uid FROM profiles WHERE email = $1', [email])
      
      for (const p of profileRes.rows) {
        console.log(`🗑️  Eliminando profile DB (ID: ${p.id}, Org: ${p.organization_id})`)
        
        // Delete all data associated with the org ID if it exists and is not superadmin org
        if (p.organization_id) {
          const orgId = p.organization_id
          
          // Check if it's superadmin org to protect it
          const saCheck = await client.query('SELECT email FROM profiles WHERE organization_id = $1 AND system_role = $2', [orgId, 'SUPER_ADMIN'])
          if (saCheck.rowCount > 0 && email !== 'superadmin@rodeoagtech.com') {
            console.log(`⚠️  ADVERTENCIA: La organización ${orgId} pertenece a un SUPER_ADMIN. Solo se borrará el perfil de este usuario, no la org.`)
          } else {
            // Delete dependent data
            await client.query('DELETE FROM movements WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM field_notes WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM farm_events WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM weather_events WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM invitations WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM tasks WHERE org_id = $1', [orgId])
            
            await client.query('DELETE FROM grazing_plans WHERE herd_id IN (SELECT id FROM herds WHERE org_id = $1)', [orgId])
            await client.query('DELETE FROM grazing_plans WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)', [orgId])
            await client.query('DELETE FROM biological_monitoring WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)', [orgId])
            await client.query('DELETE FROM weather_event_paddocks WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)', [orgId])
            
            await client.query('DELETE FROM herds WHERE org_id = $1', [orgId])
            await client.query('DELETE FROM paddocks WHERE org_id = $1', [orgId])
            
            // Delete profiles that belong only to this org (excluding other target emails which will be handled in their loop)
            await client.query('DELETE FROM profiles WHERE organization_id = $1 AND id != $2', [orgId, p.id])
            
            // Unlink organization from this profile before deleting the profile
            await client.query('UPDATE profiles SET organization_id = NULL WHERE id = $1', [p.id])
            
            // Delete the org
            await client.query('DELETE FROM organizations WHERE id = $1', [orgId])
            console.log(`   Org y datos relacionados eliminados (${orgId})`)
          }
        }
        
        // Final delete of the profile
        await client.query('DELETE FROM user_terms_acceptances WHERE profile_id = $1', [p.id])
        await client.query('DELETE FROM profiles WHERE id = $1', [p.id])
        console.log(`   Profile eliminado`)
      }
      
      // Also delete any orphaned profiles matching the email (if org delete was skipped or didn't exist)
      await client.query('DELETE FROM profiles WHERE email = $1', [email])
    }

    await client.query('COMMIT')
    console.log('\\n✅ Limpieza completada con éxito')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('\\n❌ ERROR DB:', err.message)
    throw err
  } finally {
    await client.end()
  }
}

run().catch(console.error)
