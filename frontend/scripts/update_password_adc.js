require('dotenv').config({ path: '.env.local' });
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

const fs = require('fs');
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  console.log('Removing missing GOOGLE_APPLICATION_CREDENTIALS from env to fallback to ADC');
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID
});

async function run() {
  try {
    const user = await getAuth().getUserByEmail('superadmin@rodeo.app');
    await getAuth().updateUser(user.uid, {
      password: 'Rodeo@Admin2026!'
    });
    console.log('Successfully updated user password');
  } catch (error) {
    console.error('Error updating user:', error);
  }
}
run();
