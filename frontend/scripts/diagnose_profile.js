/**
 * Diagnoses the profile 404 issue by checking:
 * 1. If the user exists in Firebase Auth (rodeo-app-prod-v1)
 * 2. The UID Firebase assigns to this user
 * 3. If a profile exists in the database with that UID or email
 */
const admin = require('firebase-admin')

const targetKeyBase64 = process.env.FIREBASE_SA_TARGET_BASE64
if (!targetKeyBase64) {
  console.error('Set FIREBASE_SA_TARGET_BASE64')
  process.exit(1)
}

const targetKey = JSON.parse(Buffer.from(targetKeyBase64, 'base64').toString())
const app = admin.initializeApp({ credential: admin.credential.cert(targetKey) })
const auth = app.auth()

const testEmail = process.argv[2] || 'javo.oso.m+99@gmail.com'

async function main() {
  console.log(`\n🔍 Diagnosing profile issue for: ${testEmail}`)
  console.log(`   Firebase project: ${targetKey.project_id}`)
  
  // 1. Check if user exists in Firebase Auth
  try {
    const user = await auth.getUserByEmail(testEmail)
    console.log(`\n✅ User EXISTS in Firebase Auth:`)
    console.log(`   UID: ${user.uid}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Email verified: ${user.emailVerified}`)
    console.log(`   Created: ${user.metadata.creationTime}`)
    console.log(`   Last login: ${user.metadata.lastSignInTime}`)
    console.log(`   Provider: ${user.providerData.map(p => p.providerId).join(', ')}`)
  } catch (err) {
    console.error(`\n❌ User NOT FOUND in Firebase Auth (${targetKey.project_id}):`, err.message)
    console.log(`\n   This means the user registered against a DIFFERENT Firebase project.`)
  }

  // 2. List all users in the project
  console.log(`\n📋 All users in ${targetKey.project_id}:`)
  try {
    const listResult = await auth.listUsers(100)
    if (listResult.users.length === 0) {
      console.log('   (no users found)')
    } else {
      listResult.users.forEach(u => {
        console.log(`   - ${u.email || '(no email)'} | UID: ${u.uid} | verified: ${u.emailVerified}`)
      })
    }
  } catch (err) {
    console.error('   Error listing users:', err.message)
  }

  await app.delete()
}

main().catch(console.error)
