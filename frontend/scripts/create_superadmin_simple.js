/**
 * Script para crear el Super Admin en Firebase Auth + Cloud SQL.
 * Uso: node --env-file=.env.local scripts/create_superadmin_simple.js
 */
const { Pool } = require('pg')
const admin = require('firebase-admin')

const SUPER_ADMIN = {
  email: 'superadmin@rodeo.app',
  password: 'R0d30@Pr0d#2026!',
  first_name: 'Super',
  last_name: 'Admin',
}

async function main() {
  console.log('\n🔐 Creando Super Admin...\n')

  // Init Firebase Admin
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (!b64) { console.error('❌ FIREBASE_ADMIN_CREDENTIALS_BASE64 no encontrada'); process.exit(1) }
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) })

  // Connect to DB
  const connStr = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
  if (!connStr) { console.error('❌ DATABASE_URL no encontrada'); process.exit(1) }
  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } })

  try {
    // 1. Create or get Firebase Auth user
    let fbUser
    try {
      fbUser = await admin.auth().getUserByEmail(SUPER_ADMIN.email)
      console.log(`⚠️  Ya existe en Firebase Auth: ${fbUser.uid}`)
      // Update password in case it changed
      await admin.auth().updateUser(fbUser.uid, { password: SUPER_ADMIN.password })
      console.log('   ✅ Password actualizado')
    } catch {
      fbUser = await admin.auth().createUser({
        email: SUPER_ADMIN.email,
        password: SUPER_ADMIN.password,
        displayName: 'Super Admin',
        emailVerified: true,
      })
      console.log(`✅ Creado en Firebase Auth: ${fbUser.uid}`)
    }

    // 2. Set custom claims
    await admin.auth().setCustomUserClaims(fbUser.uid, { system_role: 'SUPER_ADMIN' })
    console.log('✅ Custom claim: system_role=SUPER_ADMIN')

    // 3. Create profile in Cloud SQL
    await pool.query(
      `INSERT INTO profiles (firebase_uid, email, first_name, last_name, system_role, is_active, onboarding_step)
       VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', true, 99)
       ON CONFLICT (firebase_uid) DO UPDATE
       SET system_role = 'SUPER_ADMIN', is_active = true, first_name = $3, last_name = $4`,
      [fbUser.uid, SUPER_ADMIN.email, SUPER_ADMIN.first_name, SUPER_ADMIN.last_name]
    )
    console.log('✅ Perfil insertado/actualizado en Cloud SQL')

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Email:     ${SUPER_ADMIN.email}`)
    console.log(`  Password:  ${SUPER_ADMIN.password}`)
    console.log(`  UID:       ${fbUser.uid}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
    process.exit(0)
  }
}

main()
