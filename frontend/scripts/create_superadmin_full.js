require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Client } = require('pg');

async function main() {
  const email = 'superadmin@rodeo.app';
  const password = 'R0d30@Pr0d#2026!';

  // Initialize Firebase Admin
  let app;
  if (!getApps().length) {
    const credBase64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
    if (!credBase64) {
      console.error('❌ FIREBASE_ADMIN_CREDENTIALS_BASE64 is required');
      process.exit(1);
    }
    const saJson = JSON.parse(Buffer.from(credBase64, 'base64').toString('utf8'));
    app = initializeApp({ credential: cert(saJson) });
  } else {
    app = getApps()[0];
  }

  const auth = getAuth(app);
  let uid;

  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log(`✅ Firebase user already exists with UID: ${uid}`);
    // Update password just in case
    await auth.updateUser(uid, { password });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email,
        password,
        displayName: 'Super Admin',
        emailVerified: true,
      });
      uid = newUser.uid;
      console.log(`✅ Firebase user created with UID: ${uid}`);
    } else {
      console.error('❌ Firebase Error:', err);
      process.exit(1);
    }
  }

  // Database part
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Check if profile exists
    const profileRes = await client.query('SELECT id, organization_id FROM profiles WHERE email = $1', [email]);
    let orgId;
    
    if (profileRes.rows.length > 0) {
      console.log(`✅ Profile already exists in database.`);
      orgId = profileRes.rows[0].organization_id;
      // Update role
      await client.query('UPDATE profiles SET role = $1, firebase_uid = $2 WHERE email = $3', ['superadmin', uid, email]);
      console.log(`✅ Profile updated to superadmin.`);
    } else {
      // Create Organization
      const orgRes = await client.query(
        `INSERT INTO organizations (name, plan_status, created_at, updated_at) VALUES ($1, 'active', NOW(), NOW()) RETURNING id`,
        ['SuperAdmin Org']
      );
      orgId = orgRes.rows[0].id;

      // Create Profile
      const insertProfileQuery = `
        INSERT INTO profiles (firebase_uid, email, first_name, last_name, role, organization_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `;
      await client.query(insertProfileQuery, [uid, email, 'Super', 'Admin', 'superadmin', orgId]);
      console.log(`✅ Profile created in database as superadmin.`);
    }
  } catch (dbErr) {
    console.error('❌ Database Error:', dbErr);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
