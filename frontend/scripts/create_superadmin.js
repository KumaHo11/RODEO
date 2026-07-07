const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

async function createSuperadmin() {
  let app;
  
  // Try to init Firebase Admin
  if (process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64) {
    const saJson = JSON.parse(Buffer.from(process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64, 'base64').toString('utf8'));
    app = initializeApp({ credential: cert(saJson) });
  } else {
    console.error("Missing FIREBASE_ADMIN_CREDENTIALS_BASE64 in .env.local");
    process.exit(1);
  }

  const auth = getAuth(app);
  
  const email = 'superadmin@rodeo.app';
  const password = 'R0d30@Pr0d#2026!';
  
  let userRecord;
  try {
    console.log(`Checking if user ${email} exists...`);
    userRecord = await auth.getUserByEmail(email);
    console.log('User already exists in Firebase with UID:', userRecord.uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('Creating new user in Firebase...');
      userRecord = await auth.createUser({
        email,
        password,
        displayName: 'Super Admin',
      });
      console.log('Successfully created new user in Firebase:', userRecord.uid);
    } else {
      console.error('Error checking user:', error);
      process.exit(1);
    }
  }

  // Set custom claims (optional but good practice)
  await auth.setCustomUserClaims(userRecord.uid, { admin: true });

  console.log('Connecting to PostgreSQL database...');
  const connectionString = process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Set DATABASE_URL_SERVICE or DATABASE_URL in .env.local');
    process.exit(1);
  }
  
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query('SELECT id FROM profiles WHERE firebase_uid = $1', [userRecord.uid]);
    if (res.rows.length > 0) {
      console.log('Profile already exists in database. Updating role...');
      await client.query('UPDATE profiles SET role = $1, email = $2 WHERE firebase_uid = $3', ['superadmin', email, userRecord.uid]);
    } else {
      console.log('Creating profile in database...');
      await client.query(
        'INSERT INTO profiles (firebase_uid, email, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5)',
        [userRecord.uid, email, 'Super', 'Admin', 'superadmin']
      );
    }
    console.log('Superadmin creation complete!');
  } catch (dbError) {
    console.error('Database error:', dbError);
  } finally {
    await client.end();
  }
}

createSuperadmin().catch(console.error);
