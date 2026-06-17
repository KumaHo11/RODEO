/**
 * clean_all_test_users.js
 * 
 * Limpia TODOS los usuarios de prueba de una base de datos + Firebase Auth.
 * Elimina profiles, organizations, y todas las tablas relacionadas.
 * 
 * Uso:
 *   # Staging (usa .env.local):
 *   node clean_all_test_users.js staging
 * 
 *   # Producción (requiere DATABASE_URL_PROD como argumento):
 *   node clean_all_test_users.js prod "postgresql://user:pass@host:5432/rodeo?schema=public"
 * 
 *   # Todos los usuarios no-admin en staging:
 *   node clean_all_test_users.js staging --all
 */

require('dotenv').config({ path: './frontend/.env.local' })

const { Client } = require('pg')

// Emails conocidos de prueba
const TEST_EMAILS = [
  'javi.osorio.1@gmail.com',
  'javo.oso.m@gmail.com',
  'josorio@rodeoagtech.com',
]

// Si se pasa '--all', limpia TODOS los usuarios que no son SUPER_ADMIN
const CLEAN_ALL_NON_ADMIN = process.argv.includes('--all')

async function initFirebaseAdmin() {
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (!b64) {
    console.warn('FIREBASE_ADMIN_CREDENTIALS_BASE64 no configurado — se omite limpieza de Firebase Auth')
    return null
  }
  const serviceAccount = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  }
  return admin.auth()
}

async function getEmailsToClean(client) {
  if (CLEAN_ALL_NON_ADMIN) {
    const res = await client.query(
      `SELECT email FROM profiles WHERE system_role IS DISTINCT FROM 'SUPER_ADMIN' AND email IS NOT NULL`
    )
    return res.rows.map(r => r.email)
  }
  return TEST_EMAILS
}

async function cleanDB(client, emailsToClean) {
  console.log('\nLimpiando base de datos SQL...')
  console.log(`   Usuarios a limpiar: ${emailsToClean.length}`)

  for (const email of emailsToClean) {
    console.log(`\n  ${email}`)
    const profileRes = await client.query(
      'SELECT id, organization_id FROM profiles WHERE email = $1', [email]
    )
    if (profileRes.rows.length === 0) {
      console.log(`     Sin perfil SQL`)
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
        ['completed_tours',       `WHERE profile_id IN (SELECT id FROM profiles WHERE organization_id = '${orgId}')`],
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
      await client.query(`DELETE FROM completed_tours WHERE profile_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM user_terms_acceptances WHERE profile_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM impersonation_sessions WHERE target_user_id = $1 OR admin_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM notifications WHERE user_id = $1`, [profileId]).catch(() => {})
      await client.query(`DELETE FROM profiles WHERE id = $1`, [profileId])
      console.log(`     Perfil huerfano eliminado`)
    }
  }
  console.log('\nLimpieza SQL completada')
}

async function cleanFirebaseAuth(authAdmin, emailsToClean) {
  if (!authAdmin) return
  console.log('\nLimpiando Firebase Auth...')
  for (const email of emailsToClean) {
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
  const env = process.argv[2] || 'staging'
  let DATABASE_URL

  if (env === 'prod' || env === 'production') {
    DATABASE_URL = process.argv[3]
    if (!DATABASE_URL) {
      console.error('Para produccion, pasar la DATABASE_URL como 3er argumento:')
      console.error('   node clean_all_test_users.js prod "postgresql://..."')
      process.exit(1)
    }
  } else {
    DATABASE_URL = process.env.DATABASE_URL
  }

  if (!DATABASE_URL) {
    console.error('DATABASE_URL no configurado')
    process.exit(1)
  }

  const dbHost = DATABASE_URL.replace(/:([^:@]+)@/, ':***@')
  console.log('=======================================================')
  console.log(`LIMPIEZA DE USUARIOS — ${env.toUpperCase()}`)
  console.log('=======================================================')
  console.log(`DB: ${dbHost}`)
  console.log(`Modo: ${CLEAN_ALL_NON_ADMIN ? 'TODOS los usuarios (excepto SUPER_ADMIN)' : `Solo emails de prueba (${TEST_EMAILS.length})`}`)

  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  try {
    const emailsToClean = await getEmailsToClean(client)
    console.log(`\nUsuarios encontrados para limpiar: ${emailsToClean.length}`)
    emailsToClean.forEach(e => console.log(`  - ${e}`))

    if (emailsToClean.length === 0) {
      console.log('\nNo hay usuarios para limpiar.')
      return
    }

    const authAdmin = await initFirebaseAdmin()
    await cleanDB(client, emailsToClean)
    await cleanFirebaseAuth(authAdmin, emailsToClean)
    console.log('\n=======================================================')
    console.log('Limpieza completa. Los usuarios pueden registrarse de nuevo desde cero.')
    console.log('=======================================================')
  } finally {
    await client.end()
  }
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1) })
