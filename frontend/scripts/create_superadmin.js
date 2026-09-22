require('dotenv').config({ path: '.env.local' });
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Pool } = require('pg');

if (!getApps().length) {
  initializeApp(); // Uses GOOGLE_APPLICATION_CREDENTIALS from .env.local
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_SERVICE || process.env.DATABASE_URL
});

async function run() {
  const email = 'superadmin@rodeo.app';
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    console.error('SUPERADMIN_PASSWORD environment variable is missing.');
    process.exit(1);
  }
  
  let userRecord;
  try {
    userRecord = await getAuth().getUserByEmail(email);
    console.log('Firebase user already exists:', userRecord.uid);
    await getAuth().updateUser(userRecord.uid, { password });
    console.log('Password updated.');
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      userRecord = await getAuth().createUser({
        email,
        password,
        displayName: 'Super Admin'
      });
      console.log('Firebase user created:', userRecord.uid);
    } else {
      throw e;
    }
  }

  const res = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
  if (res.rows.length === 0) {
    await pool.query(
      `INSERT INTO profiles (firebase_uid, email, first_name, last_name, system_role, created_at, updated_at) 
       VALUES ($1, $2, 'Super', 'Admin', 'SUPER_ADMIN', NOW(), NOW())`,
      [userRecord.uid, email]
    );
    console.log('Added to PostgreSQL DB.');
  } else {
    await pool.query(
      `UPDATE profiles SET system_role = 'SUPER_ADMIN', firebase_uid = $1 WHERE email = $2`,
      [userRecord.uid, email]
    );
    console.log('Updated system_role to SUPER_ADMIN in DB.');
  }
  
  await getAuth().setCustomUserClaims(userRecord.uid, { system_role: 'SUPER_ADMIN' });
  console.log('Custom claims updated.');

  process.exit(0);
}

run().catch(console.error);
