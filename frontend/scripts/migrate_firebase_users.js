/**
 * migrate_firebase_users.js
 * 
 * Migrates Firebase Auth users from rodeo-app-fac50 (staging) to rodeo-app-prod-v1 (production).
 * Preserves UIDs so database references remain valid.
 * 
 * Usage: node scripts/migrate_firebase_users.js
 * 
 * Requires:
 * - SA key for rodeo-app-fac50 (source) in env FIREBASE_SA_SOURCE_BASE64
 * - SA key for rodeo-app-prod-v1 (target) in env FIREBASE_SA_TARGET_BASE64
 */

const admin = require('firebase-admin')

// Decode SA keys from base64
const sourceKeyBase64 = process.env.FIREBASE_SA_SOURCE_BASE64
const targetKeyBase64 = process.env.FIREBASE_SA_TARGET_BASE64

if (!sourceKeyBase64 || !targetKeyBase64) {
  console.error('Set FIREBASE_SA_SOURCE_BASE64 and FIREBASE_SA_TARGET_BASE64')
  process.exit(1)
}

const sourceKey = JSON.parse(Buffer.from(sourceKeyBase64, 'base64').toString())
const targetKey = JSON.parse(Buffer.from(targetKeyBase64, 'base64').toString())

console.log(`Source project: ${sourceKey.project_id}`)
console.log(`Target project: ${targetKey.project_id}`)

// Initialize source app
const sourceApp = admin.initializeApp({
  credential: admin.credential.cert(sourceKey),
}, 'source')

// Initialize target app
const targetApp = admin.initializeApp({
  credential: admin.credential.cert(targetKey),
}, 'target')

const sourceAuth = sourceApp.auth()
const targetAuth = targetApp.auth()

async function listAllUsers(auth, nextPageToken) {
  const users = []
  const result = await auth.listUsers(1000, nextPageToken)
  users.push(...result.users)
  if (result.pageToken) {
    const moreUsers = await listAllUsers(auth, result.pageToken)
    users.push(...moreUsers)
  }
  return users
}

async function main() {
  try {
    // 1. List all users from source
    console.log('\n📥 Listing users from source project...')
    const sourceUsers = await listAllUsers(sourceAuth)
    console.log(`Found ${sourceUsers.length} users in ${sourceKey.project_id}`)

    if (sourceUsers.length === 0) {
      console.log('No users to migrate.')
      process.exit(0)
    }

    // Show users
    sourceUsers.forEach(u => {
      console.log(`  - ${u.email || '(no email)'} | UID: ${u.uid} | verified: ${u.emailVerified}`)
    })

    // 2. Check which users already exist in target
    console.log(`\n📤 Migrating users to ${targetKey.project_id}...`)
    
    let created = 0
    let skipped = 0
    let errors = 0

    for (const user of sourceUsers) {
      try {
        // Check if user already exists in target
        try {
          await targetAuth.getUser(user.uid)
          console.log(`  ⏭️  ${user.email} — already exists with same UID, skipping`)
          skipped++
          continue
        } catch (e) {
          // User doesn't exist — good, we'll create it
        }

        // Also check by email
        if (user.email) {
          try {
            const existing = await targetAuth.getUserByEmail(user.email)
            console.log(`  ⚠️  ${user.email} — exists with different UID (${existing.uid}), skipping`)
            skipped++
            continue
          } catch (e) {
            // Email doesn't exist — good
          }
        }

        // Create user in target with same UID
        const createRequest = {
          uid: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          displayName: user.displayName,
          photoURL: user.photoURL,
          phoneNumber: user.phoneNumber,
          disabled: user.disabled,
        }

        // Note: We can't migrate passwords this way.
        // Users will need to use "Forgot Password" to set a new password.
        
        await targetAuth.createUser(createRequest)
        console.log(`  ✅ ${user.email} — created (UID: ${user.uid})`)
        created++
      } catch (err) {
        console.error(`  ❌ ${user.email} — error: ${err.message}`)
        errors++
      }
    }

    console.log(`\n📊 Migration summary:`)
    console.log(`  Created: ${created}`)
    console.log(`  Skipped: ${skipped}`)
    console.log(`  Errors:  ${errors}`)
    
    if (created > 0) {
      console.log(`\n⚠️  IMPORTANT: Passwords were NOT migrated.`)
      console.log(`   Users will need to use "Forgot Password" to set a new password.`)
      console.log(`   Their UIDs are preserved, so all database data is intact.`)
    }

  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await sourceApp.delete()
    await targetApp.delete()
  }
}

main()
