#!/usr/bin/env node
/**
 * RODEO — Create Super Admin (compatible with firebase-admin v14+)
 * Usage: FIREBASE_ADMIN_CREDENTIALS_BASE64=... DATABASE_URL=... SUPER_ADMIN_PASSWORD=... node create_superadmin.js
 */
const { initializeApp, getApps, cert } = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { Pool } = require('pg')

const SUPER_ADMIN = {
  email: 'superadmin@rodeo.app',
  password: process.env.SUPER_ADMIN_PASSWORD || (() => { console.error('❌ SUPER_ADMIN_PASSWORD required'); process.exit(1) })(),
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
  console.log('\n🌱 RODEO — Creating Super Admin...\n')

  const serviceAccount = getServiceAccount()
  if (!serviceAccount) {
    console.error('❌ No Firebase SA credential found.')
    process.exit(1)
  }

  // firebase-admin v14+
  if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) })
  }
  const auth = getAuth()

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // 1. Check if Super Admin already exists in DB
    const existingDb = await pool.query(
      `SELECT firebase_uid, email FROM profiles WHERE email = $1 AND system_role = 'SUPER_ADMIN'`,
      [SUPER_ADMIN.email]
    )

    if (existingDb.rows.length > 0) {
      console.log(`⚠️  Super Admin already exists in DB: ${SUPER_ADMIN.email}`)
      const uid = existingDb.rows[0].firebase_uid
      if (uid) {
        await auth.setCustomUserClaims(uid, { system_role: 'SUPER_ADMIN' })
        console.log('✅ Custom claims re-applied in Firebase.')
      }
    } else {
      // 2. Check Firebase Auth
      let fbUser = null
      try {
        fbUser = await auth.getUserByEmail(SUPER_ADMIN.email)
        console.log(`⚠️  User exists in Firebase Auth: ${fbUser.uid}`)
      } catch {
        console.log(`🔐 Creating user in Firebase Auth: ${SUPER_ADMIN.email}`)
        fbUser = await auth.createUser({
          email: SUPER_ADMIN.email,
          password: SUPER_ADMIN.password,
          displayName: `${SUPER_ADMIN.first_name} ${SUPER_ADMIN.last_name}`,
          emailVerified: true,
        })
        console.log(`   Firebase UID: ${fbUser.uid}`)
      }

      // 3. Set custom claim
      await auth.setCustomUserClaims(fbUser.uid, { system_role: 'SUPER_ADMIN' })
      console.log('   ✅ Custom claim system_role=SUPER_ADMIN set')

      // 4. Insert profile in Cloud SQL
      await pool.query(
        `INSERT INTO profiles (id, firebase_uid, email, first_name, last_name, system_role, is_active, onboarding_step, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true, 99, NOW(), NOW())
         ON CONFLICT (firebase_uid) DO UPDATE
         SET system_role = $5, is_active = true, first_name = $3, last_name = $4, updated_at = NOW()`,
        [fbUser.uid, SUPER_ADMIN.email, SUPER_ADMIN.first_name, SUPER_ADMIN.last_name, SUPER_ADMIN.system_role]
      )
      console.log('   ✅ Profile inserted in Cloud SQL')

      // 5. Audit log
      try {
        await pool.query(
          `INSERT INTO audit_logs (id, actor_email, action, entity_type, new_value)
           VALUES (uuid_generate_v4(), $1, 'SUPER_ADMIN_CREATED', 'profile', $2)`,
          ['seed-script', JSON.stringify({ email: SUPER_ADMIN.email, uid: fbUser.uid })]
        )
      } catch { console.log('   ℹ️  audit_logs entry skipped') }
    }

    console.log('\n🎉 Super Admin ready!\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Email:     ${SUPER_ADMIN.email}`)
    console.log(`  Password:  ********** (from env var)`)
    console.log(`  Panel:     /admin/dashboard`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n⚠️  Change the password after first login.\n')

  } catch (err) {
    console.error('❌ Error:', err.message || err)
    process.exit(1)
  } finally {
    await pool.end()
    process.exit(0)
  }
}

main()
