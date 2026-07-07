/**
 * Script que ejecuta la migración v19 (team_invitations) y luego crea el super admin.
 * 
 * Uso:  node --env-file=.env.local scripts/run_v19_and_seed.js
 */
const { Pool } = require('pg')
const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// ── Config ────────────────────────────────────────────────────────────────────
const SUPER_ADMIN = {
  email: 'superadmin@rodeo.app',
  password: 'R0d30@Pr0d#2026!',
  first_name: 'Super',
  last_name: 'Admin',
  system_role: 'SUPER_ADMIN',
}

function getServiceAccount() {
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
  if (b64) {
    try { return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) } catch {}
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    try { return JSON.parse(json) } catch {}
  }
  return null
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  RODEO — Migración v19 + Seed Super Admin')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Para DDL (CREATE TABLE) necesitamos el superuser postgres
  // Para DML (INSERT/UPDATE) usamos rodeo_service
  const serviceConnStr = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
  if (!serviceConnStr) {
    console.error('❌ No se encontró DATABASE_URL ni DATABASE_URL_SERVICE')
    process.exit(1)
  }

  // Construir connection string de postgres a partir del service URL
  // Construir connection string de postgres a partir del service URL (ahora requiere DATABASE_URL_ADMIN para ddl)
  const postgresConnStr = process.env.DATABASE_URL_ADMIN || serviceConnStr;

  // Pool para DDL (postgres superuser)
  const ddlPool = new Pool({ connectionString: postgresConnStr, ssl: { rejectUnauthorized: false } })
  // Pool para DML (rodeo_service)
  const pool = new Pool({ connectionString: serviceConnStr, ssl: { rejectUnauthorized: false } })

  try {
    // ── PASO 1: Migración team_invitations ─────────────────────────────────
    console.log('📦 Paso 1: Creando tabla team_invitations...')
    const sqlPath = path.join(__dirname, '..', '..', 'v19_team_invitations.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await ddlPool.query(sql)
    console.log('   ✅ Tabla team_invitations lista\n')

    // ── PASO 2: Super Admin ──────────────────────────────────────────────
    console.log('🔐 Paso 2: Creando Super Admin...')

    const serviceAccount = getServiceAccount()
    if (!serviceAccount) {
      console.error('❌ No se encontró FIREBASE_ADMIN_CREDENTIALS_BASE64')
      process.exit(1)
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    }

    // Verificar si ya existe en la DB
    const existingDb = await pool.query(
      `SELECT firebase_uid, email FROM profiles WHERE email = $1 AND system_role = 'SUPER_ADMIN'`,
      [SUPER_ADMIN.email]
    )

    if (existingDb.rows.length > 0) {
      console.log(`   ⚠️  Super Admin ya existe: ${SUPER_ADMIN.email}`)
      const uid = existingDb.rows[0].firebase_uid
      if (uid) {
        await admin.auth().setCustomUserClaims(uid, { system_role: 'SUPER_ADMIN' })
        console.log('   ✅ Custom claims re-aplicados')
      }
    } else {
      // Crear en Firebase Auth
      let fbUser = null
      try {
        fbUser = await admin.auth().getUserByEmail(SUPER_ADMIN.email)
        console.log(`   ⚠️  Ya existe en Firebase Auth: ${fbUser.uid}`)
      } catch {
        console.log(`   🔐 Creando en Firebase Auth: ${SUPER_ADMIN.email}`)
        fbUser = await admin.auth().createUser({
          email: SUPER_ADMIN.email,
          password: SUPER_ADMIN.password,
          displayName: `${SUPER_ADMIN.first_name} ${SUPER_ADMIN.last_name}`,
          emailVerified: true,
        })
        console.log(`   UID: ${fbUser.uid}`)
      }

      // Custom claims
      await admin.auth().setCustomUserClaims(fbUser.uid, { system_role: 'SUPER_ADMIN' })
      console.log('   ✅ Custom claim system_role=SUPER_ADMIN')

      // Insertar perfil
      await pool.query(
        `INSERT INTO profiles (firebase_uid, email, first_name, last_name, system_role, is_active, onboarding_step)
         VALUES ($1, $2, $3, $4, $5, true, 99)
         ON CONFLICT (firebase_uid) DO UPDATE
         SET system_role = $5, is_active = true, first_name = $3, last_name = $4`,
        [fbUser.uid, SUPER_ADMIN.email, SUPER_ADMIN.first_name, SUPER_ADMIN.last_name, SUPER_ADMIN.system_role]
      )
      console.log('   ✅ Perfil insertado en Cloud SQL')

      // Audit log
      try {
        await pool.query(
          `INSERT INTO audit_logs (actor_email, action, entity_type, new_value)
           VALUES ($1, 'SUPER_ADMIN_CREATED', 'profile', $2)`,
          ['seed-script', JSON.stringify({ email: SUPER_ADMIN.email, uid: fbUser.uid })]
        )
      } catch { /* audit_logs puede no existir */ }
    }

    console.log('\n🎉 ¡Todo listo!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Email:     ${SUPER_ADMIN.email}`)
    console.log(`  Password:  R0d30@Pr0d#2026!`)
    console.log(`  Panel:     /admin/dashboard`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  } catch (err) {
    console.error('❌ Error:', err.message || err)
    process.exit(1)
  } finally {
    await pool.end()
    await ddlPool.end()
    process.exit(0)
  }
}

main()
