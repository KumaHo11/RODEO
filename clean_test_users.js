/**
 * clean_test_users.js
 * Elimina completamente los datos de los usuarios de prueba:
 *   - javi.osorio.1@gmail.com
 *   - javo.oso.m@gmail.com
 *   - josorio@rodeoagtech.com
 */

require('dotenv').config({ path: './frontend/.env.local' })

const { Client } = require('pg')

const TEST_EMAILS = [
  'javi.osorio.1@gmail.com',
  'javo.oso.m@gmail.com',
  'josorio@rodeoagtech.com',
]

async function initFirebaseAdmin() {
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (!b64) {
    console.warn('FIREBASE_ADMIN_CREDENTIALS_BASE64 no configurado')
    return null
  }
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }
  return admin.auth()
}

async function cleanDB(client) {
  console.log('\nLimpiando base de datos SQL...')

  for (const email of TEST_EMAILS) {
    console.log(`\n  Procesando: ${email}`)
    const profileRes = await client.query(
      'SELECT id, organization_id FROM profiles WHERE email = $1', [email]
    )
    if (profileRes.rows.length === 0) {
      console.log(`     Sin perfil SQL — nada que borrar`)
      continue
    }
    const { id: profileId, organization_id: orgId } = profileRes.rows[0]
    console.log(`     Profile ID: ${profileId} | Org ID: ${orgId || 'sin org'}`)

    if (orgId) {
      const steps = [
        ['audit_logs',            `WHERE org_id = '${orgId}'`],
        ['grazing_plans',         `WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = '${orgId}')`],
        ['farm_events',           `WHERE org_id = '${orgId}'`],
        ['tasks',                 `WHERE org_id = '${orgId}'`],
        ['field_notes',           `WHERE org_id = '${orgId}'`],
        ['season_plans',          `WHERE org_id = '${orgId}' OR created_by IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['grazing_tracks',        `WHERE org_id = '${orgId}'`],
        ['movements',             `WHERE org_id = '${orgId}'`],
        ['historial_potrero',     `WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = '${orgId}')`],
        ['herds',                 `WHERE org_id = '${orgId}'`],
        ['paddocks',              `WHERE org_id = '${orgId}'`],
        ['team_invitations',      `WHERE org_id = '${orgId}'`],
        ['notifications',         `WHERE user_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['impersonation_sessions',`WHERE target_user_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}') OR admin_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['user_terms_acceptances',`WHERE profile_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
        ['profiles',              `WHERE organization_id = '${orgId}'`],
        ['organizations',         `WHERE id = '${orgId}'`],
      ]
      for (const [table, condition] of steps) {
        try {
          const res = await client.query(`DELETE FROM ${table} ${condition}`)
          if (res.rowCount > 0) console.log(`     ${table}: ${res.rowCount} fila(s) eliminada(s)`)
        } catch (e) {
          if (!e.message.includes('does not exist')) {
            console.warn(`     WARN ${table}: ${e.message}`)
          }
        }
      }
    } else {
      await client.query(`DELETE FROM user_terms_acceptances WHERE profile_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM impersonation_sessions WHERE target_user_id = $1 OR admin_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM profiles WHERE id = $1`, [profileId])
      console.log(`     Perfil huerfano eliminado`)
    }
  }
  console.log('\nLimpieza SQL completada')
}

async function cleanFirebaseAuth(authAdmin) {
  if (!authAdmin) return
  console.log('\nLimpiando Firebase Auth...')
  for (const email of TEST_EMAILS) {
    try {
      const user = await authAdmin.getUserByEmail(email)
      await authAdmin.deleteUser(user.uid)
      console.log(`  Firebase Auth eliminado: ${email} (uid: ${user.uid})`)
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`  No existe en Firebase Auth: ${email}`)
      } else {
        console.warn(`  Error con ${email}: ${e.message}`)
      }
    }
  }
  console.log('Limpieza Firebase Auth completada')
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) { console.error('DATABASE_URL no configurado'); process.exit(1) }

  console.log('Iniciando limpieza de usuarios de prueba...')
  console.log(`Usuarios: ${TEST_EMAILS.join(', ')}`)
  console.log(`DB: ${DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`)

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const authAdmin = await initFirebaseAdmin()
    await cleanDB(client)
    await cleanFirebaseAuth(authAdmin)
    console.log('\nLimpieza completa. Los usuarios pueden registrarse de nuevo desde cero.')
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
