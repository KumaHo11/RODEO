/**
 * Script para forzar verificación de email de un usuario en Firebase prod
 * y verificar su perfil en la DB
 * 
 * Usage: FIREBASE_ADMIN_CREDENTIALS_BASE64="..." DATABASE_URL="..." node scripts/fix_user.js email@example.com
 */
const { initializeApp, cert } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { Pool } = require('pg')

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/fix_user.js email@example.com')
  process.exit(1)
}

const credBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64
const dbUrl = process.env.DATABASE_URL

if (!credBase64) {
  console.error('FIREBASE_ADMIN_CREDENTIALS_BASE64 env var required')
  process.exit(1)
}

async function main() {
  // Init Firebase Admin
  const saJson = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf8'))
  const app = initializeApp({ credential: cert(saJson) })
  const auth = getAuth(app)

  console.log(`Looking up Firebase user: ${email}`)
  try {
    const userRecord = await auth.getUserByEmail(email)
    console.log(`Firebase user found:`)
    console.log(`  UID: ${userRecord.uid}`)
    console.log(`  Email verified: ${userRecord.emailVerified}`)
    console.log(`  Disabled: ${userRecord.disabled}`)
    console.log(`  Created: ${userRecord.metadata.creationTime}`)

    if (!userRecord.emailVerified) {
      await auth.updateUser(userRecord.uid, { emailVerified: true })
      console.log(`✅ Email marked as VERIFIED`)
    } else {
      console.log(`ℹ️  Email was already verified`)
    }

    // Check DB if URL provided
    if (dbUrl) {
      const url = new URL(dbUrl.replace('postgresql://', 'http://'))
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
        const result = await client.query(
          `SELECT p.id, p.firebase_uid, p.email, p.onboarding_step, p.is_active, p.organization_id
           FROM profiles p WHERE p.email = $1`,
          [email]
        )
        if (result.rows.length === 0) {
          console.log(`\n❌ NO PROFILE IN DB for ${email}`)
          console.log('Creating profile...')
          // Create org first
          const orgRes = await client.query(
            `INSERT INTO organizations (id, name, updated_at) VALUES (gen_random_uuid(), $1, NOW()) RETURNING id`,
            [`${email.split('@')[0]}'s Ranch`]
          )
          const orgId = orgRes.rows[0].id
          await client.query(
            `INSERT INTO profiles (id, firebase_uid, email, organization_id, role, onboarding_step, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, 'OWNER', 0, NOW())`,
            [userRecord.uid, email, orgId]
          )
          await client.query(`UPDATE organizations SET owner_id = (SELECT id FROM profiles WHERE email = $1) WHERE id = $2`, [email, orgId])
          console.log(`✅ Profile created with onboarding_step=0`)
        } else {
          const p = result.rows[0]
          console.log(`\n✅ Profile found in DB:`)
          console.log(JSON.stringify(p, null, 2))
          
          // Fix UID mismatch if any
          if (p.firebase_uid !== userRecord.uid) {
            await client.query(
              `UPDATE profiles SET firebase_uid = $1, updated_at = NOW() WHERE email = $2`,
              [userRecord.uid, email]
            )
            console.log(`✅ UID mismatch fixed: ${p.firebase_uid} → ${userRecord.uid}`)
          }
        }
      } finally {
        client.release()
        await pool.end()
      }
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`❌ User NOT FOUND in Firebase: ${email}`)
    } else {
      console.error('Error:', err.message)
    }
    process.exit(1)
  }
  process.exit(0)
}

main()
